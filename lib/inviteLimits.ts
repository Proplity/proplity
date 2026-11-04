// How many new people one manager or landlord may start a tenancy for by email address in a day
// (ISS-154). Kept apart from systemSettings.ts so the admin screen can import it without pulling
// in the database.
export const INVITE_LIMITS = { perDay: { min: 0, max: 200, default: 10 } } as const;
