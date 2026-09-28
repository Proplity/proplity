import type { User } from '@/context/AuthContext';

// Required before a tenant can apply to a property -- collected once here
// instead of re-asked on every PropertyApplicationForm submission. Previous
// landlord details are deliberately NOT required: a first-time renter
// genuinely may not have one, so gating on it would block a real user for
// no reason. Everything else here is either identity (yearOfBirth) or
// safety-critical vetting data (emergency contact, ID) a serious applicant
// should provide regardless of rental history.
const REQUIRED_FIELDS = [
  'phoneNumber',
  'yearOfBirth',
  'emergencyContactName',
  'emergencyContactRelationship',
  'emergencyContactPhone',
  'idDocumentUrl',
] as const satisfies readonly (keyof User)[];

export function isTenantProfileComplete(user: Pick<User, (typeof REQUIRED_FIELDS)[number]>) {
  return REQUIRED_FIELDS.every((field) => {
    const value = user[field];
    return value !== null && value !== undefined && value !== '';
  });
}

export function missingTenantProfileFields(
  user: Pick<User, (typeof REQUIRED_FIELDS)[number]>,
): (typeof REQUIRED_FIELDS)[number][] {
  return REQUIRED_FIELDS.filter((field) => {
    const value = user[field];
    return value === null || value === undefined || value === '';
  });
}
