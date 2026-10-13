# 0011 — Managers can sign up without a landlord and link to several

Status: Proposed
Decided by: roji-tech (pending acceptance) · Date: 2026-10-13
Recorded: 2026-10-13

## Context

A property manager could register only with a landlord's invite code (ADR-0003), and `ManagerInviteCode.linkedManagerId` was `@unique`, so one manager could be recorded against exactly one code and therefore one landlord. A manager who works for several landlords, or who signs up before any landlord has invited them, was blocked (ISS-040, ISS-041). Redeeming a second code as an already-linked manager hit the unique constraint and would have returned a 500.

## Decision

1. A manager may register **without** a code. The account is created normally (email verification applies) and has no landlord link and an empty portfolio. If a code is supplied it must still be active and unused.
2. `linkedManagerId` is no longer unique: a manager can redeem **one code per landlord**, so they can link to several landlords. A code stays single-use (the write only matches `linkedManagerId IS NULL`).
3. Redeeming a second code from a landlord the manager is already linked to returns 409 `ALREADY_LINKED` with the landlord's name.
4. `GET /api/v1/manager-codes/linked` lists a manager's landlords (revoked links flagged). The manager dashboard shows them and always offers the code box.
5. A link is still only a record of the relationship. Access to a property continues to come from `Property.managerId`, set by the landlord or admin.

## Alternatives Considered

- **Relationship table (`ManagerLandlord`) instead of code-based links:** the cleaner model if links ever need their own lifecycle (revoke without touching the code, per-landlord permissions). Rejected for now: it adds a table and a backfill for no behaviour the code row cannot already carry.
- **Keep the invite-only rule:** rejected, it blocks managers who sign up first and anyone serving several landlords.
- **Block unlinked managers from creating properties:** considered and not done here because seeded demo managers and existing tests rely on creating properties; new listings are already unpublished until an admin approves them. Revisit if open manager signup is abused.

## Consequences

- Anyone can now create a manager account, so an unlinked manager is a self-service role like tenant or vendor. Listings still need admin moderation before publishing.
- The user-facing guide and the manager sign-up screen say a code is optional.
- **Revisit if:** links need per-landlord permissions or independent revocation (move to a relationship table), or open manager signup is abused.

## Enforced by

`tests/api/manager-links.test.ts` (several landlords, already-linked, single-use code, unlinked manager) and `tests/api/auth.test.ts` ("MANAGER registration accepts no code …").
