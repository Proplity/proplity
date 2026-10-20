# Architecture Decision Records (ADR) — Proplity

Architecture Decision Records capture important architectural choices made in the Proplity project, their context, and consequences.

## Index of Decisions

| ADR                                                                                           | Title                                                                                                   | Status             | Date       | Decided by |
| :-------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ | :----------------- | :--------- | :--------- |
| [0001](0001-user-facing-app-url-and-email-verification.md)                                    | User-Facing APP_URL for Emails and Web Links                                                            | Accepted           | 2026-10-10 | roji-tech  |
| [0002](0002-streamlined-landlord-registration.md)                                             | Landlord Registration Excludes Upfront Banking & Property Creation                                      | Accepted           | 2026-10-10 | roji-tech  |
| [0003](0003-email-based-manager-invitations.md)                                               | Property Manager Codes Support Direct Email Invitations                                                 | Accepted           | 2026-10-10 | roji-tech  |
| [0004](0004-native-nextjs-links-over-imperative-navigation.md)                                | Native Next.js Link Components Over Imperative Navigation                                               | Accepted           | 2026-10-10 | roji-tech  |
| [0005](0005-email-links-never-derive-from-the-request-host.md)                                | Email links never derive their origin from the request host in production                               | Accepted           | 2026-10-11 | roji-tech  |
| [0006](0006-emails-are-case-insensitive-and-stored-lowercase.md)                              | Emails are normalised to lowercase and looked up case-insensitively                                     | Accepted           | 2026-10-11 | roji-tech  |
| [0007](0007-identity-documents-are-private-cloudinary-assets.md)                              | Identity and application documents are private assets behind an authorised, expiring link               | Superseded by 0010 | 2026-10-11 | roji-tech  |
| [0008](0008-private-uploads-are-namespaced-by-owner-behind-a-storage-driver.md)               | Private uploads are namespaced by owner, behind a storage-driver interface                              | Superseded by 0010 | 2026-10-11 | roji-tech  |
| [0009](0009-uploads-support-several-storage-providers-through-one-gateway.md)                 | Uploads support several storage providers through one gateway                                           | Superseded by 0010 | 2026-10-11 | roji-tech  |
| [0010](0010-uploads-are-storedfile-rows-behind-one-file-gateway.md)                           | Uploads are StoredFile rows served through one file gateway                                             | Accepted           | 2026-10-11 | roji-tech  |
| [0011](0011-managers-sign-up-without-a-landlord-and-link-to-many.md)                          | Managers can sign up without a landlord and link to several                                             | Accepted           | 2026-10-13 | roji-tech  |
| [0012](0012-identity-documents-are-deleted-after-a-retention-period.md)                       | Identity documents are deleted after a retention period                                                 | Accepted           | 2026-10-13 | roji-tech  |
| [0013](0013-staged-property-and-unit-edits-are-stored-in-metadata-json.md)                    | Staged Property and Unit Edits Are Stored in Property Metadata JSON                                     | Accepted           | 2026-10-18 | roji-tech  |
| [0014](0014-a-repair-can-be-raised-by-the-property-team-and-need-not-have-a-tenant.md)        | A repair can be raised by the property team and need not have a tenant                                  | Accepted           | 2026-10-20 | the owner  |
| [0015](0015-auto-pay-and-retention-have-admin-switches-and-retention-periods-are-settings.md) | Auto-pay charging and ID-document retention have admin switches, and the retention periods are settings | Accepted           | 2026-10-20 | roji-tech  |

---

## Authoring Guidelines

See [template.md](template.md) for the document structure and the 11 Golden Rules of ADRs.
