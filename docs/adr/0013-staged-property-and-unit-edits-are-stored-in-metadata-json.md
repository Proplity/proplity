# 0013 — Staged Property and Unit Edits Are Stored in Property Metadata JSON

Status: Accepted
Decided by: roji-tech · Date: 2026-10-18
Recorded: 2026-10-18

## Context

When landlords or property managers update a live, published listing (e.g. changing property title, description, address, or modifying unit rents, bed/bath counts, and availability), these edits require administrative moderation if critical identity/location fields are altered.

Previously, `Property.moderationNotes` (a `TEXT` column originally designed for human reviewer feedback, rejection explanations, and duplicate fingerprint notes) was overloaded with string tags such as `[APPROVED:<ISO>]` and `[EDITED on <Date>]`. Proposing to serialize draft changes into `moderationNotes` as embedded JSON strings (e.g., `[PENDING_CHANGES:{"property":...}]`) caused major issues:
1. **String pollution & fragility**: String manipulation via regular expressions to strip and extract notes was error-prone, vulnerable to malformed JSON, and truncated admin review comments.
2. **Loss of unit hierarchy**: A flat text string on `Property` could not cleanly capture staged changes across multiple child `Unit` rows (e.g. rent adjustments on Unit A, bedroom additions on Unit B, or draft units awaiting creation).
3. **Premature unpublishing & lack of draft support**: Overwriting live rows in PostgreSQL forced immediate unpublishing even when landlords only wanted to save unsent drafts or tweak minor content.

## Decision

We introduce a structured JSON column `Property.metadata` (`metadata Json?` in Prisma) validated by Zod schemas (`lib/api/propertySchemas.ts`) to store pending changes (`metadata.pendingChanges`) for both the parent property and child units.

1. **Structured Staging Architecture**:
   - Proposed edits to property identity and unit specs are staged in `property.metadata.pendingChanges` without overwriting the live published database columns.
   - The live listing remains published and active on the marketplace with its existing verified details while edits are in draft or awaiting moderation.
2. **Lifecycle & State Machine**:
   - **Save as Draft (`saveAsDraft: true`)**: Saves proposed changes with `status: 'DRAFT'`. Keeps the live listing published, suppresses admin email alerts, and allows iterative editing.
   - **Submit for Review (`submitForReview: true`)**: Promotes staged edits to `status: 'PENDING_REVIEW'`. Unpublishes the listing only if critical identity or location fields are modified (e.g. address, city, state, type); minor content edits keep the listing live. Dispatches review notification emails to platform administrators.
   - **Cancel Pending Edits (`cancelPendingEdits: true`)**: Cancels the active approval request, restores the listing's published/approved status, and safely demotes edits back to `DRAFT`.
   - **Delete Pending Edits (`deletePendingEdits: true`)**: Discards draft edits completely.
   - **Strict Under-Review Guard**: Edits currently under review cannot be deleted directly; the landlord must cancel the approval request first before deleting (the API rejects direct deletion with HTTP 400 `UNDER_REVIEW_CANNOT_DELETE`).
3. **Preservation of `moderationNotes`**:
   - `Property.moderationNotes` returns to its original purpose: human reviewer feedback, rejection reasons sent in email notifications, and automated duplicate listing flags (`Possible duplicate of: ...`).

## Alternatives Considered

- **Store JSON inside `Property.moderationNotes` string**: Rejected because regex parsing of embedded JSON strings in a human-facing text field is fragile, breaks when administrators edit notes, and risks silent string truncation.
- **Dedicated relational tables (`PropertyDraft` and `UnitDraft`)**: Rejected for excessive schema overhead and foreign key cascading complexity for staging short-lived proposed edits.
- **Direct database column overwrite with revert snapshots**: Rejected because live public marketplace listings would display unverified or draft data to prospective tenants before admin approval.

## Consequences

- Staged property and unit modifications are strictly type-checked and validated via Zod schemas on all API inputs.
- Market listings maintain continuous uptime for prospective tenants while revisions undergo private drafting or administrative moderation.
- Landlords have clear lifecycle controls: Save Draft, Submit for Review, Cancel Approval Request, and Delete Pending Edits.
- **Revisit if:** Multi-stage version control with full audit history for every draft revision across historical years is required beyond single active pending changes.

## Enforced by

- Database migration: `prisma/migrations/20261018200000_property_metadata/migration.sql`
- Zod validators: `lib/api/propertySchemas.ts` (`propertyMetadataSchema`, `pendingChangesSchema`)
- Integration tests: `tests/api/properties.test.ts` (`properties: pending changes metadata, draft staging, cancel approval, and delete lifecycle`)
- TypeScript compiler: `pnpm typecheck` (`tsc --noEmit`)

## Binds

- `prisma/schema/property.prisma`
- `app/api/v1/properties/[id]/route.ts`
- `app/api/v1/properties/[id]/units/[unitId]/route.ts`
- `app/api/v1/properties/[id]/moderation/route.ts`
- `lib/api/propertySchemas.ts`
- `lib/api/types.ts`
- `lib/apiClient.ts`
- `app/components/PropertyDetail.tsx`
- `app/admin/properties/PropertyReviewDrawer.tsx`
- `tests/api/properties.test.ts`
