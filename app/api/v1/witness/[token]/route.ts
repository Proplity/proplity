import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { validateCSRF } from '@/lib/auth/csrf';
import { getClientIp, reserveAttempt } from '@/lib/auth/rateLimit';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { getSystemSettings } from '@/lib/systemSettings';
import { hashWitnessToken } from '@/lib/agreementWitness';
import { announceFullySigned, completeSigningIfReady } from '@/lib/agreementExecution';
import { notifyPropertyTeam, notifyAndEmail } from '@/lib/notifications';

// The witness's own page talks to these two endpoints. They are public: the long random token in
// the link is the only credential, so everything here is read-only except the one signature, each
// call is rate limited per client address, and a token that is unknown, expired or for a
// withdrawn agreement tells the caller nothing about why beyond that.

type RouteCtx = { params: Promise<{ token: string }> };

// A person opens a link a handful of times; this stops one address from trying tokens in bulk.
const MAX_PER_HOUR = 60;
const WINDOW_MS = 60 * 60 * 1000;

const gone = (code: string, error: string) => NextResponse.json({ error, code }, { status: 410 });

async function load(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return prisma.agreementWitness.findUnique({
    where: { tokenHash: hashWitnessToken(token) },
    include: {
      agreement: {
        include: {
          rent: {
            include: {
              tenant: { select: { name: true } },
              unit: {
                include: { property: { select: { name: true, address: true, city: true } } },
              },
            },
          },
        },
      },
    },
  });
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  try {
    const { allowed } = await reserveAttempt(
      `witness:${getClientIp(req)}`,
      undefined,
      MAX_PER_HOUR,
      WINDOW_MS,
    );
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }
    const { token } = await ctx.params;
    const witness = await load(token);
    if (!witness) return NextResponse.json({ error: 'This link is not valid' }, { status: 404 });

    const { agreement } = witness;
    const base = {
      side: witness.side,
      witnessName: witness.name,
      unit: agreement.rent.unit.unitNumber,
      property: agreement.rent.unit.property.name,
    };
    if (witness.status === 'SIGNED') {
      return NextResponse.json({ data: { state: 'SIGNED', ...base, signedAt: witness.signedAt } });
    }
    if (agreement.status === 'VOID') {
      return gone(
        'AGREEMENT_WITHDRAWN',
        'This agreement was withdrawn, so it no longer needs a witness',
      );
    }
    if (witness.tokenExpiresAt < new Date()) {
      return gone('LINK_EXPIRED', 'This link has expired. Ask for a new one.');
    }
    return NextResponse.json({
      data: {
        state: 'READY',
        ...base,
        address: `${agreement.rent.unit.property.address}, ${agreement.rent.unit.property.city}`,
        landlordName: agreement.landlordName,
        agentName: agreement.agentName,
        tenantName: agreement.rent.tenant.name,
        clauses: agreement.clauses,
        specialConditions: agreement.specialConditions,
        expiresAt: witness.tokenExpiresAt,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const signSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Type your full name').max(160),
    confirm: z.literal(true, { error: 'Tick the box to confirm' }),
  })
  .strict();

export async function POST(req: NextRequest, ctx: RouteCtx) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }
  try {
    const { allowed } = await reserveAttempt(
      `witness:${getClientIp(req)}`,
      undefined,
      MAX_PER_HOUR,
      WINDOW_MS,
    );
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }
    const { token } = await ctx.params;
    const found = await load(token);
    if (!found) return NextResponse.json({ error: 'This link is not valid' }, { status: 404 });

    const validated = await validateBody(req, signSchema);
    if (!validated.success) return validated.response;

    const settings = await getSystemSettings();
    const rentId = found.agreement.rentId;

    const outcome = await prisma.$transaction(async (tx) => {
      // The same lock the parties' signatures take, so the last signature of any kind sees the others.
      await tx.$queryRaw`SELECT "id" FROM "Rent" WHERE "id" = ${rentId} FOR UPDATE`;
      const witness = await tx.agreementWitness.findUnique({
        where: { id: found.id },
        include: { agreement: { select: { status: true } } },
      });
      if (!witness) return { kind: 'INVALID' } as const;
      if (witness.status === 'SIGNED') return { kind: 'ALREADY' } as const;
      if (witness.agreement.status === 'VOID') return { kind: 'WITHDRAWN' } as const;
      if (witness.tokenExpiresAt < new Date()) return { kind: 'EXPIRED' } as const;
      await tx.agreementWitness.update({
        where: { id: witness.id },
        data: {
          status: 'SIGNED',
          signedAt: new Date(),
          signedName: validated.data.fullName,
          signedIp: getClientIp(req),
        },
      });
      const signing = await completeSigningIfReady(tx, rentId, settings);
      return { kind: 'SIGNED', signing } as const;
    });

    if (outcome.kind === 'INVALID') {
      return NextResponse.json({ error: 'This link is not valid' }, { status: 404 });
    }
    if (outcome.kind === 'ALREADY') {
      return NextResponse.json(
        { error: 'You have already signed this agreement as a witness', code: 'ALREADY_SIGNED' },
        { status: 409 },
      );
    }
    if (outcome.kind === 'WITHDRAWN') {
      return gone('AGREEMENT_WITHDRAWN', 'This agreement was withdrawn');
    }
    if (outcome.kind === 'EXPIRED') {
      return gone('LINK_EXPIRED', 'This link has expired. Ask for a new one.');
    }

    // Tell the people it concerns. Best effort: the signature is already saved.
    const { rent } = found.agreement;
    const property = await prisma.property.findUnique({
      where: { id: rent.unit.propertyId },
      select: { name: true, managerId: true, landlordId: true },
    });
    if (property) {
      const side = found.side === 'LANDLORD' ? "the landlord's" : "the tenant's";
      const note = {
        title: 'A witness signed',
        body: `${validated.data.fullName} signed as ${side} witness on the rent agreement for unit ${rent.unit.unitNumber} at ${property.name}.`,
      };
      await notifyPropertyTeam(
        property,
        { ...note, link: `/dashboard/tenants/${rentId}` },
        { email: false },
      );
      await notifyAndEmail(rent.tenantId, { ...note, link: '/dashboard' }, { email: false });
      if (outcome.signing === 'EXECUTED') {
        await announceFullySigned({
          id: rentId,
          tenantId: rent.tenantId,
          unit: { unitNumber: rent.unit.unitNumber, property },
        });
      }
    }
    return NextResponse.json({ data: { signed: true } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
