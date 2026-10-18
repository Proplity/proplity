import { z } from 'zod';
import { PropertyType, PaymentFrequency, UnitStatus } from '@prisma/client';
import { safeUrl, safeUrlList } from '@/lib/api/urlField';

export const pendingChangesPropertySchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  type: z.nativeEnum(PropertyType).optional(),
  description: z.string().optional(),
  imageUrl: safeUrl.optional(),
  video360Url: safeUrl.optional(),
  exteriorPhotoUrl: safeUrl.optional(),
  photoUrls: safeUrlList.optional(),
});

export const pendingChangesUnitSchema = z.object({
  unitNumber: z.string().min(1).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  sqft: z.number().int().positive().nullable().optional(),
  rentAmount: z.number().positive().optional(),
  depositAmount: z.number().nonnegative().nullable().optional(),
  serviceCharge: z.number().nonnegative().nullable().optional(),
  listedPaymentFrequency: z.nativeEnum(PaymentFrequency).optional(),
  status: z.nativeEnum(UnitStatus).optional(),
  amenities: z.array(z.string()).optional(),
});

export const pendingNewUnitSchema = pendingChangesUnitSchema.extend({
  unitNumber: z.string().min(1),
  rentAmount: z.number().positive(),
});

export const pendingChangesSchema = z.object({
  status: z.enum(['DRAFT', 'PENDING_REVIEW']),
  submittedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  property: pendingChangesPropertySchema.optional(),
  units: z.record(z.string(), pendingChangesUnitSchema).optional(),
  newUnits: z.array(pendingNewUnitSchema).optional(),
});

export const propertyMetadataSchema = z
  .object({
    pendingChanges: pendingChangesSchema.nullable().optional(),
  })
  .passthrough();

export type PropertyPendingChangesInput = z.infer<typeof pendingChangesSchema>;
export type PropertyMetadataInput = z.infer<typeof propertyMetadataSchema>;
