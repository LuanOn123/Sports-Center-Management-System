# SCMS use-case overview

Reviewed 1 November 2026 against the current checkout, replacing the obsolete branch comparison. [Mermaid source](sports-center-use-cases.mmd) · [SVG](../diagram-audit/exports/sports-center-use-cases.svg) · [Detailed sequences](../sequence-diagrams/INDEX.md).

Stored roles are **ADMIN, MANAGER, COACH, RECEPTIONIST, MEMBER**. Guest is unauthenticated and is not a stored role. STAFF is obsolete. The overview groups related implemented API capabilities; it is not an exhaustive permission matrix or proof that every frontend control is mounted.

Mermaid has no native UML use-case type. This source retains the existing flowchart approximation: labelled actors, oval capability groups, system boundary and directed dashed include relationships. Native presentation SVGs provide stick-figure actors. Do not call the Mermaid actor rectangles formal UML actor glyphs. The existing [presentation role views](../presentation/diagrams.md) provide smaller report figures.

| Actor | Implemented responsibility | Important restriction |
|---|---|---|
| Guest | Register/login/reset password and public catalogue | Registration sends no verification OTP; reset-password OTP is separate. |
| Member | Own subscriptions/payments/invoices, whole-course registration, booking/waitlist management, QR attendance, support and class leave | Ownership and server eligibility apply. A course registration creates per-session Enrollment rows. FREE door entry is distinct from class entitlement. |
| Coach | Assigned schedule/roster, limited member training profile, attendance/QR, replacement requests and viewing ratings | General leave creation is rejected for Coach; use coach-change requests. Effective session assignment is checked. |
| Receptionist | Members, counter sales/collection, subscriptions/refund confirmation, facility visits, attendance monitoring/warnings/reports, staff leave and support | Does not create/edit/cancel/complete schedules or assign class Coaches through Manager-only endpoints. Several API actions lack a verified reachable UI. |
| Center Manager | Scoped staff/resources/classes, class Coach assignments, sessions, attendance decisions, issue/leave review and facility reports | Global members/subscriptions/invoices are blocked by app middleware. Reports are limited to revenue and memberships. |
| Admin | Global users/facilities/assignments, plan/sport catalogues, global reports/payment reconciliation and permitted shared administration | Inherited authorize permissions do not bypass authorizeExact. Coach-change decisions and schedule writes remain Manager operations. |

Own profile/password/logout, notifications and authorized chat apply to all five authenticated roles. Backend guards and services enforce access; navigation is not the security boundary. Evidence: `BE/src/app.ts`, `BE/src/middlewares/authorize.ts`, `BE/src/config/prisma.ts` and the module route/controller/service files linked in the traceability matrix.

Changes from the obsolete diagram:

- Added Admin and replaced STAFF with Receptionist.
- Named the Member registration operation as whole-course enrollment, retaining per-session booking/waitlist management in its group.
- Removed obsolete yellow/dashed “develop only” distinctions for implemented QR, cancellation and feedback.
- Removed unimplemented training plans/results. The limited training profile is a different feature.
- Removed subscription resume; terminal subscriptions are not resumed. Purchase/renewal creates a new period.
- Separated shared resource administration from Manager-only schedule and class-Coach mutations.
- Corrected Manager/global report scope and Coach replacement/leave terminology.

The master overview uses grouped capabilities; [the audit](../diagram-audit/REPORT.md) records bulk/single-booking guard differences, term-policy conflicts and unverified UI paths. Missing original capabilities are documented rather than replaced with fictional services or endpoints.
