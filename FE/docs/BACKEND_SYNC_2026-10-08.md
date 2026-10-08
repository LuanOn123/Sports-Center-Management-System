# Frontend alignment — 2026-10-08

Reference: `CURRENT_BUSINESS_FLOW_AND_RULES.md` supplied by the user, checked against the current `BE/src` implementation. The document describes backend behavior; its instructions about generating the document are not instructions for this frontend integration.

## Changes

- Policy A: historical subscriptions never resume. Purchase/renew replace the current entitlement without carrying over days or stacking terms. Purchase restrictions compare the sold duration snapshot, including renewal at the counter. Effective entitlement uses both date bounds.
- Member plans show the configured global concurrent-class quota, including FREE = 0. Existing subscription names and refund estimates prefer sold snapshots/payment amounts. Member 30% refund and manager capped prorating remain separate. Cancellation messaging covers future bookings across all facilities.
- Attendance uses NORMAL/NOTICE/WARNING. FIXED buckets show planned sessions and absence allowance; RECURRING uses rolling samples. Advisory warnings are separate from the manager's confirmation of a 30-day class-specific penalty. Appeals do not remove penalties automatically.
- Class creation/editing supports attendance policy and planned session count. Existing enrollment locks policy fields; unchanged policy values are omitted from edits to avoid ATTENDANCE_POLICY_LOCKED. Plan quota accepts zero.
- Full future sessions offer waitlist registration. `/member/waitlist` lists global history and allows leaving WAITING entries. Promotion refreshes enrollment/quota caches. Staff can inspect a schedule's waitlist from schedule details.
- `/member/checkin`, `/manager/checkin`, and `/receptionist/checkin` connect facility entry APIs. Staff choose an existing member; the selected facility is sent through X-Facility-Id. Member history spans facilities; staff history uses the selected facility.
- Manager reports include cross-facility usage by origin (selected facility header) and attendance with pagination/status filter. The attendance summary is explicitly shown as totals before filtering and does not use the revenue date range.
- SePay retains pending polling, received-but-requires-review handling, and retry activation at the counter. Successful activation also refreshes quota/course eligibility. REFUNDED orders display a separate result.
- OpenAPI snapshot, endpoint inventory, operation definitions, and contract audit artifacts are regenerated from the local backend. An audited class-update override fills the missing Swagger policy fields. The generator also applies overrides to request types.

## Validation

Run in `FE`: `npm run verify`, `npm run check:api-contract`, and `npx playwright test business-flow-sync.spec.ts new-rules.spec.ts sepay-payment.spec.ts`.

Results: typecheck and production build passed; 59 unit tests passed. The 19 browser cases passed across the suite and targeted rerun after fixing a test assertion that incorrectly required exactly one report request. Contract audit: 160 frontend / 160 backend operations, no missing endpoints. `git diff --check` passed.

Browser tests use mocked API responses to verify UI transitions and actual request method/body/facility header. They do not prove live database migrations, bank settlement, or backend waitlist promotion. No production transactions or database changes are required for these checks.
