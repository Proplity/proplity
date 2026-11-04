import crypto from 'crypto';
import type { AgreementWitness, WitnessSide } from '@prisma/client';
import { appUrl } from '@/lib/appUrl';

// Witnesses who sign through an emailed link. The link holds a random token; only its SHA-256 is
// kept, so reading the table cannot sign for anyone. The token is the whole credential, so it is
// long (256 bits), expires, and is replaced whenever the link is sent again.

export const WITNESS_MAX_SENDS = 5;
export const WITNESS_LINK_DAYS = { min: 1, max: 90, default: 14 } as const;

export function newWitnessToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hash: hashWitnessToken(raw) };
}

export function hashWitnessToken(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export const witnessLinkExpiry = (days: number, from = new Date()) =>
  new Date(from.getTime() + days * 86_400_000);

/** Which side of the agreement a witness is for, in the words the document uses. */
export const SIDE_WORDS: Record<WitnessSide, string> = {
  LANDLORD: "the Landlord's",
  TENANT: "the Tenant's",
};

export function witnessEmail(
  witness: { name: string; email: string; side: WitnessSide },
  context: { property: string; unit: string; party: string },
  rawToken: string,
  days: number,
  req?: Parameters<typeof appUrl>[1],
) {
  return {
    to: witness.email,
    subject: `Please witness a rent agreement signature: ${context.property}`,
    body: `Hello ${witness.name},\n\n${context.party} has asked you to act as a witness to ${SIDE_WORDS[witness.side]} signature on the rent agreement for unit ${context.unit} at ${context.property}.\n\nRead the agreement and add your name here (no account needed):\n${appUrl(`/witness/${rawToken}`, req)}\n\nThe link works for ${days} day${days === 1 ? '' : 's'} and only for you. If you were not expecting this, ignore this email and nothing will happen.`,
  };
}

/** What the property team and the tenant see of a witness: never the token. */
export function serializeWitness(w: AgreementWitness) {
  return {
    id: w.id,
    side: w.side,
    name: w.name,
    email: w.email,
    address: w.address,
    status: w.status,
    lastSentAt: w.lastSentAt,
    sendCount: w.sendCount,
    expiresAt: w.tokenExpiresAt,
    signedAt: w.signedAt,
    signedName: w.signedName,
  };
}

export type WitnessView = ReturnType<typeof serializeWitness>;
