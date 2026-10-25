import { NextResponse } from 'next/server';
import { emailSchema, findUserByEmail } from '@/lib/auth/email';
import { appUrl } from '@/lib/appUrl';
import { z } from 'zod';
import { RentStatus, PaymentFrequency, LateFeeType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty, PUBLIC_PROPERTY, propertyScopeWhere } from '@/lib/api/propertyAccess';
import { sendEmail } from '@/lib/email';
import { notifyAndEmail } from '@/lib/notifications';
import { getSystemSettings } from '@/lib/systemSettings';
import { listJurisdictions } from '@/lib/agreements';
import { checkTenancyRules, jurisdictionFor, type JurisdictionRules } from '@/lib/tenancyRules';
import {
  InviteLimitError,
  createWaitingTenant,
  inviteLimitMessage,
  invitationEmail,
  invitationState,
  issueInvitation,
  mayInviteNewTenant,
} from '@/lib/tenantInvitations';

// VENDOR has no legitimate reason to list rents -- everyone else's access
// is scoped below, not gated by role.
export const GET = withAuth(
  async (req, { session }) => {
    try {
      const { searchParams } = req.nextUrl;
      const { skip, take, page, limit } = parsePagination(searchParams);
      const status = searchParams.get('status');

      const where: Prisma.RentWhereInput = {
        ...(status ? { status: status as RentStatus } : {}),
      };

      if (session.role === 'TENANT') {
        where.tenantId = session.sub;
      } else if (session.role === 'MANAGER' || session.role === 'LANDLORD') {
        where.unit = {
          property: { ...propertyScopeWhere(session.scope) },
        };
      }
      // ADMIN: no extra scoping.

      const [rents, total] = await Promise.all([
        prisma.rent.findMany({
          where,
          skip,
          take,
          include: {
            unit: { include: { property: PUBLIC_PROPERTY } },
            tenant: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                avatarUrl: true,
                status: true,
                verificationToken: { select: { expiresAt: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.rent.count({ where }),
      ]);

      // Say where each tenant is in joining (the property team sends or resends invitations from
      // it); the token and the account status themselves stay on the server.
      const data = rents.map(({ tenant, ...rent }) => {
        const { status: _status, verificationToken: _token, ...person } = tenant;
        return { ...rent, tenant: person, invitation: invitationState(tenant) };
      });
      return NextResponse.json({ data, meta: buildMeta(total, page, limit) });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT'] },
);

class ApplicationAlreadyUsedError extends Error {}

const createRentSchema = z
  .object({
    unitId: z.string(),
    // Either an existing tenant by id, or invite-a-new-tenant by email --
    // resolved server-side so callers (e.g. AddTenantForm) don't need to
    // know in advance whether the tenant already has an account.
    tenantId: z.string().optional(),
    tenantEmail: emailSchema.optional(),
    tenantName: z.string().optional(),
    tenantPhone: z.string().optional(),
    // Creating the tenancy from an APPROVED application (ISS-046): the
    // applicant becomes the tenant and the application is linked to the rent.
    applicationId: z.string().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    // Full amount for the payment cycle, per CLAUDE.md rule 5 -- never
    // multiplied by 12 or otherwise normalized here.
    rentAmount: z.number().positive(),
    serviceCharge: z.number().nonnegative().optional(),
    paymentFrequency: z.nativeEnum(PaymentFrequency).optional(),
    deposit: z.number().nonnegative(),
    // Landlord/manager autonomy, deliberately unbounded -- no platform-
    // imposed min/max on either field.
    gracePeriodDays: z.number().int().nonnegative().optional(),
    lateFeeType: z.nativeEnum(LateFeeType).optional(),
    lateFeePercentage: z.number().nonnegative().optional(),
    lateFeeFlatAmount: z.number().nonnegative().optional(),
  })
  .refine((d) => d.applicationId || d.tenantId || (d.tenantEmail && d.tenantName), {
    message: 'Either applicationId, tenantId, or both tenantEmail and tenantName, are required',
    path: ['tenantId'],
  });

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, createRentSchema);
      if (!validated.success) return validated.response;
      const {
        unitId,
        tenantId: inputTenantId,
        tenantEmail,
        tenantName,
        tenantPhone,
        applicationId,
        ...rest
      } = validated.data;

      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        include: { property: true },
      });
      if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      if (!canManageProperty(session, unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // The place's tenancy rules (advance rent beyond the cap, a long tenancy, an area the law does
      // not cover): a blocking one stops the rent, a warning is returned with it.
      const jurisdiction = jurisdictionFor(unit.property, await listJurisdictions());
      const findings = jurisdiction
        ? checkTenancyRules(jurisdiction as JurisdictionRules, {
            paymentFrequency: rest.paymentFrequency ?? 'ANNUAL',
            startDate: rest.startDate,
            endDate: rest.endDate,
            address: unit.property.address,
            city: unit.property.city,
          })
        : [];
      const blocking = findings.filter((f) => f.mode === 'BLOCK');
      if (blocking.length > 0) {
        return NextResponse.json(
          { error: blocking.map((f) => f.message).join(' '), code: 'TENANCY_RULE', findings },
          { status: 422 },
        );
      }

      let tenantId = inputTenantId;
      let invited = false;

      if (applicationId) {
        const application = await prisma.application.findUnique({ where: { id: applicationId } });
        if (!application || application.unitId !== unitId) {
          return NextResponse.json(
            { error: 'Application not found for this unit' },
            { status: 404 },
          );
        }
        if (application.status !== 'APPROVED' || application.rentId) {
          return NextResponse.json(
            { error: 'Only an approved application without a rent can start a tenancy' },
            { status: 409 },
          );
        }
        tenantId = application.applicantId;
      }

      if (tenantId) {
        const tenant = await prisma.user.findUnique({ where: { id: tenantId } });
        if (!tenant || tenant.role !== 'TENANT') {
          return NextResponse.json(
            { error: 'tenantId must reference a TENANT user' },
            { status: 400 },
          );
        }
      } else {
        // tenantEmail path: reuse an existing, already-verified TENANT if
        // the email matches one -- never merge into a still-pending
        // account, only ever link a real one. Otherwise, invite: create a
        // PENDING_VERIFICATION user with an unusable random password and
        // send a (console-logged) verification link that lets them set
        // their own password. login already 403s PENDING_VERIFICATION
        // accounts, so nothing else needs to change to keep them out until
        // they verify.
        const existing = await findUserByEmail(tenantEmail!);
        if (existing) {
          if (existing.role !== 'TENANT') {
            return NextResponse.json(
              { error: 'An account with this email exists but is not a TENANT' },
              { status: 400 },
            );
          }
          tenantId = existing.id;
        } else {
          // Emailing a stranger in Proplity's name needs an approved listing (or, for a property
          // kept for management only, the admin's switch), and is limited per day (ISS-154).
          const settings = await getSystemSettings();
          const mayInvite = mayInviteNewTenant(session, unit.property, settings);
          if (!mayInvite.allowed) {
            return NextResponse.json(
              { error: mayInvite.error, code: mayInvite.code },
              { status: 403 },
            );
          }

          const { newTenant, rawToken } = await prisma.$transaction(async (tx) => {
            const created = await createWaitingTenant(tx, {
              email: tenantEmail!,
              name: tenantName!,
              phoneNumber: tenantPhone,
            });
            const { rawToken } = await issueInvitation(tx, {
              actor: { id: session.sub, role: session.role },
              tenant: created,
              unitId,
              dailyLimit: settings.tenantInvitesPerDay,
            });
            return { newTenant: created, rawToken };
          });

          await sendEmail(invitationEmail(newTenant, rawToken, req));

          tenantId = newTenant.id;
          invited = true;
        }
      }

      // Initial RENT invoice created in the same transaction -- a rent
      // shouldn't be able to exist with no corresponding first bill. Service
      // charge is billed as its own InvoiceType.SERVICE_CHARGE line, not
      // merged into the RENT invoice's amount (see CLAUDE.md).
      const result = await prisma.$transaction(async (tx) => {
        const rent = await tx.rent.create({ data: { unitId, tenantId: tenantId!, ...rest } });
        if (applicationId) {
          // Claim the application in the same write that checks it is still free: two requests for
          // one application at once (a double-click) otherwise each make a rent and an invoice
          // (ISS-140). The loser changes nothing: throwing rolls its rent back.
          const claimed = await tx.application.updateMany({
            where: { id: applicationId, status: 'APPROVED', rentId: null },
            data: { rentId: rent.id },
          });
          if (claimed.count === 0) throw new ApplicationAlreadyUsedError();
        }
        const invoice = await tx.invoice.create({
          data: {
            rentId: rent.id,
            type: 'RENT',
            amount: rent.rentAmount,
            dueDate: rent.startDate,
            description: 'Initial rent invoice',
          },
        });
        if (rent.serviceCharge > 0) {
          await tx.invoice.create({
            data: {
              rentId: rent.id,
              type: 'SERVICE_CHARGE',
              amount: rent.serviceCharge,
              dueDate: rent.startDate,
              description: 'Initial service charge invoice',
            },
          });
        }
        return { rent, invoice };
      });

      // If the tenant already existed (not invited with token), notify them of their new rent
      if (!invited && tenantId) {
        try {
          const [existingTenantUser, unitDetails] = await Promise.all([
            prisma.user.findUnique({
              where: { id: tenantId },
              select: { email: true, name: true },
            }),
            prisma.unit.findUnique({
              where: { id: unitId },
              include: { property: { select: { name: true } } },
            }),
          ]);
          if (existingTenantUser && unitDetails) {
            await sendEmail({
              to: existingTenantUser.email,
              subject: `New Rent Agreement Ready for Review: Unit ${unitDetails.unitNumber}`,
              body: `Hi ${existingTenantUser.name},\n\nA new rent agreement has been prepared for you for unit ${unitDetails.unitNumber} at ${unitDetails.property.name}.\n\nPlease sign in to your Proplity dashboard to review and digitally sign your rent:\n${appUrl('/dashboard', req)}`,
            });
          }
        } catch (rentEmailErr) {
          console.error('Failed to email tenant about new rent', rentEmailErr);
        }
      }

      // The tenant has a rent to read and sign, and an invoice to pay: tell them in the app
      // (the invite or rent email above already went by email).
      const where = `unit ${unit.unitNumber} at ${unit.property.name}`;
      await notifyAndEmail(
        tenantId!,
        {
          title: 'Rent ready to sign',
          body: `A rent for ${where} was prepared for you. Review it and add your signature.`,
          link: '/dashboard',
        },
        { email: false },
      );
      await notifyAndEmail(
        tenantId!,
        {
          title: `Invoice ${result.invoice.invoiceNumber} issued`,
          body: `Your first rent invoice for ${where} is ₦${result.invoice.amount.toLocaleString()}, due ${result.invoice.dueDate.toDateString()}.`,
          link: '/dashboard',
        },
        { email: false },
      );

      return NextResponse.json(
        {
          data: {
            ...result.rent,
            initialInvoice: result.invoice,
            tenantInvited: invited,
            warnings: findings,
          },
        },
        { status: 201 },
      );
    } catch (err) {
      if (err instanceof InviteLimitError) {
        return NextResponse.json(
          {
            error: inviteLimitMessage(err.limit),
            code: 'INVITE_LIMIT',
          },
          { status: 429 },
        );
      }
      if (err instanceof ApplicationAlreadyUsedError) {
        return NextResponse.json(
          { error: 'Only an approved application without a rent can start a tenancy' },
          { status: 409 },
        );
      }
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
