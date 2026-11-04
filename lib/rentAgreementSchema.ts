import { z } from 'zod';

const naira = z.number().min(0).max(1_000_000_000);
const person = z.object({
  name: z.string().trim().max(120).default(''),
  address: z.string().trim().max(300).default(''),
});

// The details of the witness on each side, typed by the property team. Printed on the agreement.
export const witnessesSchema = z
  .object({ landlord: person.optional(), tenant: person.optional() })
  .strict();

export const choicesSchema = z
  .object({
    omit: z.array(z.string().max(60)).max(60).optional(),
    include: z.array(z.string().max(60)).max(60).optional(),
    edits: z.record(z.string().max(60), z.string().trim().min(1).max(6000)).optional(),
  })
  .strict();

// What the manager decides about a generated agreement. The same fields are used to preview it,
// make it and change the draft.
const generatedFields = {
  templateId: z.string().min(1),
  landlordName: z.string().trim().min(1).max(160).optional(),
  agencyFee: naira.nullable().optional(),
  legalFee: naira.nullable().optional(),
  choices: choicesSchema.optional(),
  specialConditions: z.string().trim().max(4000).nullable().optional(),
  witnesses: witnessesSchema.optional(),
};

export const previewAgreementSchema = z.object(generatedFields).strict();

export const createAgreementSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('GENERATED'), ...generatedFields }).strict(),
  z
    .object({
      source: z.literal('UPLOADED'),
      fileUrl: z.string().min(1).max(500),
      witnesses: witnessesSchema.optional(),
    })
    .strict(),
]);

// A draft can change anything but its template; once issued only the witnesses can.
export const updateAgreementSchema = z
  .object({
    landlordName: generatedFields.landlordName,
    agencyFee: generatedFields.agencyFee,
    legalFee: generatedFields.legalFee,
    choices: generatedFields.choices,
    specialConditions: generatedFields.specialConditions,
    witnesses: generatedFields.witnesses,
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Send at least one field to change',
  });

export const confirmAgreementSchema = z.object({
  fullName: z.string().trim().min(1, 'Type your full name').max(160),
});

export const voidAgreementSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const stampDutySchema = z
  .object({
    status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'STAMPED']).optional(),
    reference: z.string().trim().max(120).nullable().optional(),
    amount: naira.nullable().optional(),
    receiptUrl: z.string().min(1).max(500).nullable().optional(),
    stampedAt: z.coerce.date().nullable().optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Send at least one field to change',
  });
