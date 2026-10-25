import type { Prisma } from '@prisma/client';

// Plain data, with no database import, so tests can seed the same rows.
// The first set of plans, used only while the Plan table is empty. The prices and limits are
// placeholders until real ones are chosen: an admin edits them in Admin > Plans & billing, and
// nothing else in the code mentions a price. The shape follows the pricing model the owner chose
// (a free plan, then plans with more units, more users and monthly credits, and a per-unit price
// beyond the included units).
export const DEFAULT_PLANS = [
  {
    key: 'small',
    name: 'Small',
    tagline: 'For you renting out one or two homes',
    monthlyPrice: 0,
    yearlyPrice: null,
    unitsIncluded: 2,
    usersIncluded: 1,
    overagePerUnit: null,
    monthlyCredits: 0,
    features: [
      'Upload your existing rent agreements',
      'Collect rent online',
      'Maintenance requests',
    ],
    isDefault: true,
    isPopular: false,
    sortOrder: 1,
  },
  {
    key: 'medium',
    name: 'Medium',
    tagline: 'For you with a growing portfolio',
    monthlyPrice: 29_999,
    yearlyPrice: 23_999 * 12,
    unitsIncluded: 50,
    usersIncluded: 5,
    overagePerUnit: 300,
    monthlyCredits: 20,
    features: ['Everything in Small', 'Team members', 'Credits every month'],
    isDefault: false,
    isPopular: true,
    sortOrder: 2,
  },
  {
    key: 'large',
    name: 'Large',
    tagline: 'For larger landlords and managers',
    monthlyPrice: 49_999,
    yearlyPrice: 39_999 * 12,
    unitsIncluded: 100,
    usersIncluded: 10,
    overagePerUnit: 250,
    monthlyCredits: 50,
    features: ['Everything in Medium', 'More team members', 'More credits every month'],
    isDefault: false,
    isPopular: false,
    sortOrder: 3,
  },
] satisfies Prisma.PlanCreateManyInput[];

// What a manager or landlord can spend credits on. The admin adds, prices and switches these off.
export const DEFAULT_SERVICES = [
  {
    key: 'rent_agreement',
    name: 'Generate a rent agreement',
    description: 'A rent agreement made from the rent terms, ready for both sides to sign.',
    creditCost: 1,
    sortOrder: 1,
  },
] satisfies Prisma.PaidServiceCreateManyInput[];

// Credit packs on sale while the CreditPack table is empty. Placeholders like the plans above:
// an admin sets the real sizes and prices in Admin > Plans & billing.
export const DEFAULT_CREDIT_PACKS = [
  { key: 'credits-5', name: '5 credits', credits: 5, price: 2_500, sortOrder: 1 },
  { key: 'credits-20', name: '20 credits', credits: 20, price: 8_000, sortOrder: 2 },
  { key: 'credits-50', name: '50 credits', credits: 50, price: 17_500, sortOrder: 3 },
] satisfies Prisma.CreditPackCreateManyInput[];
