// The shortest password Proplity accepts, for sign-up, reset, first sign-in and change (ISS-155).
// Kept in one place so the forms and the routes cannot drift apart. Existing, shorter passwords
// keep working at sign-in; the rule applies when a password is set.
export const MIN_PASSWORD_LENGTH = 8;
export const PASSWORD_TOO_SHORT = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
