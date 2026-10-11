# Architecture Decision Records (ADR) — Proplity

Architecture Decision Records capture important architectural choices made in the Proplity project, their context, and consequences.

## Index of Decisions

| ADR                                                              | Title                                                                                     | Status   | Date       | Decided by               |
| :--------------------------------------------------------------- | :---------------------------------------------------------------------------------------- | :------- | :--------- | :----------------------- |
| [0001](0001-user-facing-app-url-and-email-verification.md)       | User-Facing APP_URL for Emails and Web Links                                              | Accepted | 2026-10-10 | Abdullah Jamiu           |
| [0002](0002-streamlined-landlord-registration.md)                | Landlord Registration Excludes Upfront Banking & Property Creation                        | Accepted | 2026-10-10 | Abdullah Jamiu           |
| [0003](0003-email-based-manager-invitations.md)                  | Property Manager Codes Support Direct Email Invitations                                   | Accepted | 2026-10-10 | Abdullah Jamiu           |
| [0004](0004-native-nextjs-links-over-imperative-navigation.md)   | Native Next.js Link Components Over Imperative Navigation                                 | Accepted | 2026-10-10 | Abdullah Jamiu           |
| [0005](0005-email-links-never-derive-from-the-request-host.md)   | Email links never derive their origin from the request host in production                 | Proposed | 2026-10-11 | Abdullah Jamiu (pending) |
| [0006](0006-emails-are-case-insensitive-and-stored-lowercase.md) | Emails are normalised to lowercase and looked up case-insensitively                       | Proposed | 2026-10-11 | Abdullah Jamiu (pending) |
| [0007](0007-identity-documents-are-private-cloudinary-assets.md) | Identity and application documents are private assets behind an authorised, expiring link | Proposed | 2026-10-11 | Abdullah Jamiu (pending) |

---

## Authoring Guidelines

See [template.md](template.md) for the document structure and the 11 Golden Rules of ADRs.
