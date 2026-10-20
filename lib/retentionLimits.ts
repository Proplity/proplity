// How short a retention period may be set. Deleting identity documents cannot be undone, so a
// typo (3 instead of 365) is refused rather than deleting everything that has been idle a few
// days. The upper limit is ten years. Kept apart from systemSettings.ts so the admin screen can
// import it without pulling in the database.
export const RETENTION_LIMITS = {
  tenancyDays: { min: 30, max: 3650, default: 365 },
  rejectionDays: { min: 7, max: 3650, default: 90 },
} as const;
