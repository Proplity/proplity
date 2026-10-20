# 0015 — Auto-pay charging and ID-document retention have admin switches, and the retention periods are settings

Status: Proposed
Decided by: the owner (roji-tech) answered the questions below on 2026-10-20; awaiting formal acceptance
Recorded: 2026-10-20 (drafted by an agent)
Amends: 0012 (the periods and the switch), and the way ADR-0012 and ISS-011 describe `AUTOPAY_WORKER_ENABLED` and `RETENTION_ENABLED`

## Context

Two daily jobs do things that are hard to undo: the auto-pay charger charges real cards, and retention deletes identity documents for good. Both were guarded only by an environment variable, so turning one on or off meant a deployment change, and the retention periods (12 months, 90 days) were constants in code that ADR-0012 itself called a proposal for whoever owns compliance to confirm.

The owner asked for both to stay off for now, for the switch to be available in Platform Settings, and for the retention periods to be settings too.

## Decision

1. **Two gates, both must be open.** A job acts only when the deployment allows it (`AUTOPAY_WORKER_ENABLED=true` / `RETENTION_ENABLED=true`, unchanged) **and** an admin has switched it on in Platform Settings (`SystemSettings.autopayChargingEnabled` / `retentionEnabled`, both default off). With either gate closed the job only reports what it would do, as before. The environment flag is the lock only whoever runs the deployment can open; the switch is the day-to-day control.
2. **The retention periods are settings:** `retentionAfterTenancyDays` (default 365) and `retentionAfterRejectionDays` (default 90), editable in Platform Settings. The API refuses fewer than 30 and 7 days and more than 3650, and non-whole numbers, so a typo cannot delete everything.
3. **The screen asks once more** before turning on charging or deletion, and says when the deployment flag is what holds a switch shut.
4. **Every settings change is audit-logged** (`SETTINGS_CHANGED`, with each changed field's old and new value and who changed it).

## Alternatives Considered

- **Admin switch only, no environment flag:** simplest, but any admin click could start charging cards or deleting documents on a deployment that was never meant to (a staging copy, a database restored somewhere else).
- **Environment flag only (as before):** needs a deployment change to flip, and the periods stay in code.

## Consequences

- Turning either job on is two steps: set the environment variable once for the deployment, then switch it on in Platform Settings. A switch that is on while the deployment flag is off does nothing, and the screen says so.
- Existing deployments keep their behaviour: both switches default off, so a job that was running because its environment flag was true stops until an admin switches it on. **If a production deployment already has either flag set, the admin must switch it on after this ships.**
- Not built: a preview of what retention would delete before switching it on (the job's report shows the count once it runs in report-only mode).
- Compliance still has to confirm the periods before retention is switched on in production.
