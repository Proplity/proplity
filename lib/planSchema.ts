import { z } from 'zod';

const naira = z.number().int('Enter whole naira').min(0, 'Cannot be negative').max(1_000_000_000);

// The fields an admin sets on a plan, shared by the create and update routes.
export const planFields = {
  key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,30}$/, 'Use lower-case letters, numbers and dashes'),
  name: z.string().trim().min(1, 'Give the plan a name').max(60),
  tagline: z.string().trim().max(160).nullable(),
  monthlyPrice: naira,
  yearlyPrice: naira.nullable(),
  unitsIncluded: z.number().int().min(0).max(100_000),
  usersIncluded: z.number().int().min(1).max(10_000),
  overagePerUnit: naira.nullable(),
  monthlyCredits: z.number().int().min(0).max(1_000_000),
  features: z.array(z.string().trim().min(1).max(120)).max(12),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  isPopular: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
};

const planObject = z.object(planFields);

// A new plan needs a key, a name, a price and its included units; the rest has defaults.
export const createPlanSchema = planObject
  .partial()
  .required({ key: true, name: true, monthlyPrice: true, unitsIncluded: true })
  .strict();

// Any field can change on its own. The key is fixed once created: checkout and the pricing page
// refer to it.
export const updatePlanSchema = planObject
  .omit({ key: true })
  .partial()
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Send at least one field to change',
  });
