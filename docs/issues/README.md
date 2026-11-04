# Issue Register — Proplity

A living list of problems found (or suspected) in the application, so debugging can be prioritised in one place while other issues are still being searched for. **Add to it whenever something odd is noticed — even unconfirmed.** Update the status in the same pass as the fix, and link the PR/commit.

Not a replacement for GitHub issues once something is actively being worked: copy the ID into the PR title (`ISS-012: …`).

## How to use

1. **Add** a row to the right table below, next ID, status `Suspected` or `Confirmed`.
2. **Triage** by Priority then Likelihood (rubric below). Re-sort the "Priority queue" at the top when it changes.
3. **Fix** on a small branch off `dev`; set status `In progress` → `Fixed (PR #n)`; on release `Released`.
4. **Never delete** a row. `Won't fix` and `Not a bug` stay, with the reason — it stops the same report being re-investigated.
5. Fixed decisions that change architecture also get an ADR (`docs/adr/`).

## Rubric

| Priority | Meaning                                                                                   |
| -------- | ----------------------------------------------------------------------------------------- |
| **P0**   | Live harm: account takeover, data loss/leak, money wrongly moved, app unusable for a role |
| **P1**   | A core flow cannot be completed, or wrong data shown for a role                           |
| **P2**   | Flow works with friction/workaround; degraded but usable                                  |
| **P3**   | Cleanup: cosmetic, copy, docs, dev-only                                                   |

"Live on prod?" separates what is hurting users now from what is only on a branch or in staging.

| Likelihood   | Meaning                              |
| ------------ | ------------------------------------ |
| **Certain**  | Reproduced                           |
| **Likely**   | Code review shows it; not reproduced |
| **Possible** | Depends on config/timing/data        |

| Status                | Meaning                             |
| --------------------- | ----------------------------------- |
| Suspected             | Noticed, not verified               |
| Confirmed             | Verified in code or by reproduction |
| In progress           | Being fixed                         |
| Fixed                 | Fix merged to `dev` (PR noted)      |
| Released              | In `prod`                           |
| Not a bug / Won't fix | Reason in the Notes column          |

## Categories (what tends to go wrong here)

Auth & sessions · Email & links · Payments · Data integrity · Authorisation (RBAC) · Uploads · Notifications & messaging · Background jobs · UI/UX flow · Performance · Deployment & config · Testing & CI · Documentation drift

## Checklist of issue types to search each review

For every review pass, look in each of these for the app's own failure modes:

- **Data exposure** — API responses returning fields a role shouldn't see (password hashes, other tenants' data, tokens in logs)
- **Access control** — each route's role/ownership check; IDOR on `[id]` routes
- **Auth & sessions** — rotation, logout, rate limits, enumeration, email normalisation
- **Email & links** — origin trust, dead links, wrong environment, deliverability
- **Payments** — webhook idempotency, amount/currency, mock gateway leaking into prod
- **Data integrity** — missing transactions, unit/rent status drift, orphan rows, unique-key edge cases
- **Uploads** — signing scope, size/type limits, public URLs
- **Next.js 16 specifics** — `proxy.ts`, caching of dynamic routes, `NEXT_PUBLIC_*` inlined at build
- **Background jobs** — idempotency, timezone, partial failure
- **Notifications & messaging** — duplicates, missed events, polling cost
- **UI/UX flow** — dead ends, buttons that do nothing, mobile tab bar limits
- **Performance** — N+1 queries, unpaginated lists, large assets
- **Deployment & config** — env vars at build vs runtime, secrets, migration order
- **Testing & CI** — flaky/parallel-unsafe specs, unrun suites, format drift
- **Documentation drift** — docs claiming what the code no longer does
- **Accessibility** — labels, focus, keyboard

Record rows for findings **in the same pass you find them**. No secrets and no customer emails in this register.

## Detailed issue files

Small issues stay as a row. When one needs evidence, a root cause and a fix plan, copy [template.md](template.md) to `ISSUE-NNNN-short-title.md` (same number as the `ISS-NNN` row) and link it from the Notes column.

## Row template

```
| ISS-000 | Short title | Category | P? | Likelihood | Status | Where (file:line / route) | Notes / repro / fix link |
```

See [issues.md](issues.md) for the register itself.
