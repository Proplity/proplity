# Building out the 5 orphaned models: Violation, Announcement, ConditionReport, Equipment, BankAccount

**Status:** Complete and verified. **Date:** 2026-08-26.

## Why

`out/project-audit.md` flagged five real, PRD-named Prisma models with zero application code — no routes, no UI, nothing reading or writing them despite being fully defined in the schema (relations, indexes, and even comments explaining their design were all already in place from whenever the schema was originally authored). User asked to build out all five in one pass rather than pick one at a time.

No migration was needed — `prisma migrate status` confirmed the database was already in sync; these tables have existed since the original schema, just unused.

## Scope decisions (made directly, following existing codebase conventions — not asked as separate questions since each mirrors an established pattern)

- **Announcement**: property-wide, posted by manager/landlord/admin (`canManageProperty()`), readable by any tenant with an active lease on the property. Hard delete allowed (unlike `AccessCode`, nothing cascades from it and there's no audit-trail requirement over it).
- **Violation**: unit-scoped, reported by manager/landlord/admin against a unit's tenant, `OPEN → UNDER_REVIEW → RESOLVED` lifecycle (`resolvedAt` stamped on resolution). The unit's own active-lease tenant can read violations reported against them; a stranger cannot.
- **ConditionReport**: unit-scoped, filed by manager/landlord/admin (e.g. move-in/move-out inspection), tenant of the unit can read. `aiFlags` is **never populated by any code path** — no AI/image-analysis integration exists anywhere in this codebase, so it stays `null` rather than faking a detection result (same "honest zero" principle as ad campaigns' stats).
- **Equipment**: property-scoped (manager/landlord/admin only), supports both property-wide assets (generator, elevator — `unitId` omitted) and unit-specific ones (HVAC, appliance — `unitId` set, validated to belong to the property). Enforces the schema's own "one of unitId/propertyId" rule at create time (CLAUDE.md's documented multi-FK app-level-validation gap).
- **BankAccount**: self-service only (LANDLORD/MANAGER/VENDOR/ADMIN — the roles that realistically receive money). Real storage with a real single-default invariant (creating with `isDefault: true` or as the first account clears/sets defaults transactionally; deleting the default promotes the next most recent). **No Paystack/payout automation reads this table** — an honest gap, not faked, matching CLAUDE.md's own note that "no autopay/payment route references them."

## What was built

**Backend** (all under `canManageProperty()`/active-lease scoping, following the existing route conventions exactly):
- `app/api/v1/properties/[id]/announcements/route.ts` + `[announcementId]/route.ts` — GET/POST/PATCH/DELETE.
- `app/api/v1/properties/[id]/units/[unitId]/violations/route.ts` + `[violationId]/route.ts` — GET/POST/PATCH (status + resolution).
- `app/api/v1/properties/[id]/units/[unitId]/condition-reports/route.ts` — GET/POST.
- `app/api/v1/properties/[id]/equipment/route.ts` + `[equipmentId]/route.ts` — GET/POST/PATCH/DELETE.
- `app/api/v1/bank-accounts/route.ts` + `[id]/route.ts` — GET/POST/PATCH (set default)/DELETE.

**Frontend**: `lib/api/types.ts` gained all 5 model types + Create*Input types; `lib/apiClient.ts` gained matching methods (`properties.announcements.*`, `properties.violations.*`, `properties.conditionReports.*`, `properties.equipment.*`, `bankAccounts.*`); 5 new hook files (`useAnnouncements`, `useViolations`, `useConditionReports`, `useEquipment`, `useBankAccounts`) mirroring the existing hook shape.

**UI surfaces** (real, wired, not stubs):
- `PropertyDetail.tsx`: new **Announcements** card (main column, visible to all with access, post/pin form for managers) and **Equipment** card (manager sidebar, add form with type/serial number).
- `TenantDetail.tsx`: new **Violations** card (report form, resolve action) and **Condition Reports** card (free-text room-notes form, mapped into the JSON `rooms` field) — both scoped to the lease's specific unit.
- `BankAccount` has hooks and API wiring but **no UI form** — no account-settings page exists anywhere in the app yet to host it, the same situation `useAccessCodes`/`useCreateAccessCode` were in before their own UI landed. Flagged here rather than building a settings page as a side effect of this pass.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm test` — full suite, 183/183 passing (168 → 183: new `tests/api/orphaned-models.test.ts` covering all 5 domains — ownership/role scoping, tenant read access, the pin-sort/resolve/default-promotion behaviors, and the equipment unitId-cross-property-rejection case).
- `pnpm build` — production build succeeds; all 9 new routes present in the route manifest.

## What's next

Remaining from `out/project-audit.md`: repo-wide CSRF coverage, real AI/LLM integration, CSV/Excel import-export, e-signature support. A `BankAccount` UI (account-settings page) is now unblocked backend-wise whenever that surface gets built.
