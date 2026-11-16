# SCMS use-case overview

Reviewed 1 November 2026 against the current checkout, replacing the obsolete branch comparison. [Mermaid source](sports-center-use-cases.mmd) · [SVG](../diagram-audit/exports/sports-center-use-cases.svg) · [Detailed sequences](../sequence-diagrams/INDEX.md).

Stored roles are **ADMIN, MANAGER, COACH, RECEPTIONIST, MEMBER**. Guest is unauthenticated and is not a stored role. STAFF is obsolete. The overview groups related implemented API capabilities; it is not an exhaustive permission matrix or proof that every frontend control is mounted.

Mermaid has no native UML use-case type. This source retains the existing flowchart approximation: labelled actors, oval capability groups, system boundary and directed dashed include relationships. Native presentation SVGs provide stick-figure actors. Do not call the Mermaid actor rectangles formal UML actor glyphs. The existing [presentation role views](../presentation/diagrams.md) provide smaller report figures.

| Actor | Implemented responsibility | Important restriction |
|---|---|---|
| Guest | Register/login/reset password and public catalogue | Registration sends no verification OTP; reset-password OTP is separate. |
| Member | Own subscriptions/payments/invoices, whole-course registration and cancellation, waitlists, QR attendance, support and class leave, assigned training plans, progress and personal AI assistant | Course booking and cancellation work on per-session Enrollment rows in the selected term. The Member sees class plans and their own individual plans. |
| Coach | Assigned schedule/roster, attendance/QR, class and individual training plans, AI drafts, per-session results and progress, replacement requests and ratings | Class assignment is required for training plans. Effective session assignment is checked for evaluations. |
| Receptionist | Members, counter sales/collection, subscriptions/refunds, facility check-in, booking support, attendance warnings/reports and tickets on behalf of members | Works within the assigned facility. Schedule and Coach assignment writes remain Manager duties. |
| Center Manager | Scoped staff/resources/classes, class Coach assignments, sessions, attendance decisions, issue/leave review, audit log and facility reports | Facility reports cover revenue, membership usage and member/booking activity for the selected date range. |
| Admin | Global users/facilities/assignments, plan/sport catalogues, global reports/payment reconciliation and permitted shared administration | Inherited authorize permissions do not bypass authorizeExact. Coach-change decisions and schedule writes remain Manager operations. |

Own profile/password/logout, notifications and authorized chat apply to all five authenticated roles. Backend guards and services enforce access; navigation is not the security boundary. Evidence: `BE/src/app.ts`, `BE/src/middlewares/authorize.ts`, `BE/src/config/prisma.ts` and the module route/controller/service files linked in the traceability matrix.

Changes from the obsolete diagram:

- Added Admin and replaced STAFF with Receptionist.
- Named the Member registration operation as whole-course enrollment, retaining per-session booking/waitlist management in its group.
- Removed obsolete yellow/dashed “develop only” distinctions for implemented QR, cancellation and feedback.
- The later implementation adds class and individual training plans and records results per session alongside progress. The sequence diagram corpus still reflects the earlier audit snapshot.
- Removed subscription resume; terminal subscriptions are not resumed. Purchase/renewal creates a new period.
- Separated shared resource administration from Manager-only schedule and class-Coach mutations.
- Corrected Manager/global report scope and Coach replacement/leave terminology.

The master overview uses grouped capabilities; [the audit](../diagram-audit/REPORT.md) records bulk/single-booking guard differences, term-policy conflicts and unverified UI paths. Missing original capabilities are documented rather than replaced with fictional services or endpoints.
