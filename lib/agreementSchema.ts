import { z } from 'zod';
import { clauseProblems, clauseSchema, MAX_CLAUSES } from '@/lib/agreementFields';
import { stampDutyTiersSchema } from '@/lib/stampDuty';

const slug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,40}$/, 'Use lower-case letters, numbers and dashes');
const ruleMode = z.enum(['OFF', 'WARN', 'BLOCK']);

const noticeDays = z
  .object({
    MONTHLY: z.number().int().min(1).max(1095).optional(),
    QUARTERLY: z.number().int().min(1).max(1095).optional(),
    BI_ANNUAL: z.number().int().min(1).max(1095).optional(),
    ANNUAL: z.number().int().min(1).max(1095).optional(),
  })
  .strict();

const text = (max: number) => z.string().trim().max(max);
const list = (max: number) => z.array(z.string().trim().min(1).max(80)).max(max);

// The fields an admin sets on a jurisdiction, shared by the create and update routes.
export const jurisdictionFields = {
  key: slug,
  name: z.string().trim().min(1, 'Give the jurisdiction a name').max(80),
  states: list(40),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  advanceRentMaxMonths: z.number().int().min(1).max(60).nullable(),
  advanceRentMode: ruleMode,
  noticeDays,
  excludedAreas: list(40),
  excludedAreasMode: ruleMode,
  registrationThresholdYears: z.number().int().min(1).max(99).nullable(),
  stampDutyNote: text(1000).nullable(),
  stampDutyTiers: stampDutyTiersSchema,
  stampDutyBasis: z.enum(['ANNUAL_RENT', 'TERM_RENT']),
  sourceNote: text(2000).nullable(),
  rulesCheckedAt: z.coerce.date().nullable(),
  lawyerReviewed: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
};

const jurisdictionObject = z.object(jurisdictionFields);

export const createJurisdictionSchema = jurisdictionObject
  .partial()
  .required({ key: true, name: true })
  .strict();

// The key is fixed once created: templates and agreements refer to the row, and the key shows in
// links and exports.
export const updateJurisdictionSchema = jurisdictionObject
  .omit({ key: true })
  .partial()
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Send at least one field to change',
  });

const clauses = z
  .array(clauseSchema)
  .max(MAX_CLAUSES)
  .superRefine((value, ctx) => {
    for (const message of clauseProblems(value)) ctx.addIssue({ code: 'custom', message });
  });

export const templateFields = {
  key: slug,
  name: z.string().trim().min(1, 'Give the template a name').max(120),
  jurisdictionId: z.string().min(1),
  clauses,
  witnessRequired: z.boolean(),
  notes: text(1000).nullable(),
};

const templateObject = z.object(templateFields);

export const createTemplateSchema = templateObject
  .partial()
  .required({ key: true, name: true, jurisdictionId: true, clauses: true })
  .strict();

// The key and the jurisdiction are fixed once created. A template that has been approved is not
// edited at all: a change is a new version.
export const updateTemplateSchema = templateObject
  .omit({ key: true, jurisdictionId: true })
  .partial()
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Send at least one field to change',
  });
