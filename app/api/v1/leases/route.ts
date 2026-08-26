import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { LeaseStatus, PaymentFrequency, LateFeeType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { sendEmail } from '@/lib/email';

// VENDOR has no legitimate reason to list leases -- everyone else's access
// is scoped below, not gated by role.
export const GET = withAuth(
  async (req, { session }) => {
    try {
      const { searchParams } = req.nextUrl;
      const { skip, take, page, limit } = parsePagination(searchParams);
      const status = searchParams.get('status');

      const where: Prisma.LeaseWhereInput = {
        ...(status ? { status: status as LeaseStatus } : {}),
      };

      if (session.role === 'TENANT') {
        where.tenantId = session.sub;
      } else if (session.role === 'MANAGER' || session.role === 'LANDLORD') {
        where.unit = {
          property: { OR: [{ managerId: session.sub }, { landlordId: session.sub }] },
        };
      }
      // ADMIN: no extra scoping.

      const [leases, total] = await Promise.all([
        prisma.lease.findMany({
          where,
          skip,
          take,
          include: {
            unit: { include: { property: true } },
            tenant: { select: { id: true, name: true, email: true, phoneNumber: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.lease.count({ where }),
      ]);

      return NextResponse.json({ data: leases, meta: buildMeta(total, page, limit) });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT'] },
);

const createLeaseSchema = z
  .object({
    unitId: z.string(),
    // Either an existing tenant by id, or invite-a-new-tenant by email --
    // resolved server-side so callers (e.g. AddTenantForm) don't need to
    // know in advance whether the tenant already has an account.
    tenantId: z.string().optional(),
    tenantEmail: z.string().email().optional(),
    tenantName: z.string().optional(),
    tenantPhone: z.string().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    // Full amount for the payment cycle, per CLAUDE.md rule 5 -- never
    // multiplied by 12 or otherwise normalized here.
    rentAmount: z.number().positive(),
    paymentFrequency: z.nativeEnum(PaymentFrequency).optional(),
    deposit: z.number().nonnegative(),
    // Landlord/manager autonomy, deliberately unbounded -- no platform-
    // imposed min/max on either field.
    gracePeriodDays: z.number().int().nonnegative().optional(),
    lateFeeType: z.nativeEnum(LateFeeType).optional(),
    lateFeePercentage: z.number().nonnegative().optional(),
    lateFeeFlatAmount: z.number().nonnegative().optional(),
  })
  .refine((d) => d.tenantId || (d.tenantEmail && d.tenantName), {
    message: 'Either tenantId, or both tenantEmail and tenantName, are required',
    path: ['tenantId'],
  });

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, createLeaseSchema);
      if (!validated.success) return validated.response;
      const { unitId, tenantId: inputTenantId, tenantEmail, tenantName, tenantPhone, ...rest } = validated.data;

      const unit = await prisma.unit.findUnique({ where: { id: unitId }, include: { property: true } });
      if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      if (!canManageProperty(session, unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      let tenantId = inputTenantId;
      let invited = false;

      if (tenantId) {
        const tenant = await prisma.user.findUnique({ where: { id: tenantId } });
        if (!tenant || tenant.role !== 'TENANT') {
          return NextResponse.json({ error: 'tenantId must reference a TENANT user' }, { status: 400 });
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
        const existing = await prisma.user.findUnique({ where: { email: tenantEmail! } });
        if (existing) {
          if (existing.role !== 'TENANT') {
            return NextResponse.json(
              { error: 'An account with this email exists but is not a TENANT' },
              { status: 400 },
            );
          }
          tenantId = existing.id;
        } else {
          const randomPassword = crypto.randomBytes(24).toString('hex');
          const passwordHash = await bcrypt.hash(randomPassword, 12);
          const newTenant = await prisma.user.create({
            data: {
              email: tenantEmail!,
              name: tenantName!,
              phoneNumber: tenantPhone,
              passwordHash,
              role: 'TENANT',
              status: 'PENDING_VERIFICATION',
            },
          });

          const rawToken = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
          await prisma.verificationToken.create({
            data: { userId: newTenant.id, tokenHash, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
          });

          await sendEmail({
            to: newTenant.email,
            subject: 'You have been added as a tenant on Proplity',
            body: `Hi ${newTenant.name},\n\nYou've been added as a tenant on Proplity. Set your password and activate your account:\n\nhttp://localhost:3000/verify-email?token=${rawToken}\n\nThis link expires in 7 days.`,
          });

          tenantId = newTenant.id;
          invited = true;
        }
      }

      // Initial RENT invoice created in the same transaction -- a lease
      // shouldn't be able to exist with no corresponding first bill.
      const result = await prisma.$transaction(async (tx) => {
        const lease = await tx.lease.create({ data: { unitId, tenantId: tenantId!, ...rest } });
        const invoice = await tx.invoice.create({
          data: {
            leaseId: lease.id,
            type: 'RENT',
            amount: lease.rentAmount,
            dueDate: lease.startDate,
            description: 'Initial rent invoice',
          },
        });
        return { lease, invoice };
      });

      return NextResponse.json(
        { data: { ...result.lease, initialInvoice: result.invoice, tenantInvited: invited } },
        { status: 201 },
      );
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
