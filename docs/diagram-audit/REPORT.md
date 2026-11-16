# SCMS diagram audit and standardization

Reviewed on **1 November 2026**, against commit `4a9e6603e3aa2d3cd56e2c8785fd27a3430d9535` and the existing untracked sequence-diagram work. Changes are confined to documentation, diagram sources, exports and their verification tools. No application code, API contract, schema, migration, dependency or lockfile was changed. Nothing was committed, pushed or deployed.

## Scope and evidence

The repository contains **96 sequence diagrams**, **2 architecture Mermaid sources**, **8 presentation Mermaid blocks**, **5 existing native SVG diagrams**, and **7 PNG diagram renditions**. Two PNG-only architecture variants now have editable SVG sources. Logos, application artwork and uploaded chat images are not diagrams. The instructional example in `sequence-diagrams/AGENTS.md` is not a project workflow. No draw.io XML, PlantUML or other editable UML format was found.

- [Inventory and exact modified-file list](FILES.md)
- [Traceability matrix](TRACEABILITY.md), with [complete machine-readable records](traceability.json)
- [96 sequence statuses](../sequence-diagrams/INDEX.md)
- [Rendered SVG exports](exports/), one per Mermaid source/block
- [Parser, paint and geometry results](validation.json), [text-layout review](layout-review.json)
- [Classified findings and exact source ranges](findings.json)

The previous audit's **157 distinct implementation-file hashes all matched current code**. That establishes an unchanged evidence baseline, not runtime correctness. The current pass also inspected shared transaction routing, scope middleware, schema relationships, relevant service guards and frontend reachability. The matrix records 113 source/asset items and cites current file ranges extracted from the files and TypeScript AST. PNGs are linked renditions of their SVGs, rather than separate business workflows.

`SCMS_Business_Rules_AI_Spec.md` was not found. Available requirement references include [current business rules](../CURRENT_BUSINESS_FLOW_AND_RULES.md), [term-membership policy](../../BE/docs/term-membership-policy.md), [sequence guidance](../sequence-diagrams/AGENTS.md), API documentation and existing audit documents. Several older documents describe superseded roles, immediate replacement renewals or already-repaired security defects. They are not treated as current implementation evidence. Requirement IDs are reused only where an existing document actually supplies them; missing IDs are explicitly marked.

## Corrections made

| Classification | Finding and correction |
|---|---|
| DIAGRAM_ERROR | Default/neutral Mermaid styling and colored presentation assets did not guarantee white fills and black strokes. Embedded a shared monochrome configuration in every Mermaid source/block; standardized native SVGs and regenerated their PNGs. |
| DIAGRAM_ERROR | Sequence footers repeated participants. Disabled mirrored actors, kept headers at the top, aligned dashed lifelines and retained balanced activations. |
| DIAGRAM_ERROR | Mermaid's untrimmed 2000px lifeline placeholders could enlarge fitted exports. Export verification now ends every lifeline 18px after the actual final content and fits the SVG with a 12px margin. No interactions were removed to shorten the drawing. |
| DIAGRAM_ERROR | Guard labels already contained brackets, which Mermaid rendered twice. Removed redundant source brackets. Outer combined-fragment borders are solid; operand separators and return arrows remain dashed. |
| DIAGRAM_ERROR | The old ERD described 28 models / 18 enums. Rebuilt it from the current schema: **40 models, 21 enums, 1 implicit join table, 71 relationship edges**. Preserved all scalar attributes, marked nullable columns and actual keys, and used non-identifying relationships for ordinary foreign keys. |
| DIAGRAM_ERROR | The use-case overview omitted Admin, used the obsolete STAFF role, permitted incorrect role actions, implied subscription resume and included unsupported training-result flows. Corrected the overview and documented the mapping and exclusions in [USE_CASES.md](../architecture/USE_CASES.md). |
| DIAGRAM_ERROR | Five sequence workflows and the previous audit misread global Prisma calls or nested `$transaction` calls as independent transactions. Corrected membership scanning, role updates, term updates, coach-change decisions and schedule patterns to account for **ambient transaction routing**. |
| DIAGRAM_ERROR | Bulk registration displayed eligibility reads even after the stale-session check failed. Put those reads inside an explicit fresh-session guard. Retained rollback, idempotent enrollment reuse, the term grant and post-commit quota-read behavior. |
| DIAGRAM_ERROR | Sport creation named a nonexistent `SportRequirement` model. Corrected it to `SubjectRequirement`. |
| DIAGRAM_ERROR | Renewal showed an outbox write absent from `renewSubscription`. Removed that invented interaction; subscription, collected payment and invoice remain. |
| DIAGRAM_ERROR | A presentation use case described general Coach leave. Current code requires a teaching-replacement request, so the label now states that operation. |
| UNVERIFIED | Presentation diagrams asserted Mobile framework versions although no Mobile source exists in this checkout. Retained the external-client boundary, explicitly marked its implementation unavailable and removed unsupported version claims. |

The request's strict monochrome requirement overrides the local sequence guidance's default-theme/no-configuration rule. This is documented rather than silently relying on editor defaults. Mermaid sources remain single raw diagrams; the first executable diagram statement is `sequenceDiagram` after the configuration/comment lines. Direct draw.io import of the configuration has not been tested. Delivered SVGs carry their tested style and geometry independently of the editor's theme.

## Transaction correction

[BE/src/config/prisma.ts](../../BE/src/config/prisma.ts), lines 23–38, reuses `requestContext.transaction` for nested transactions. Lines 75–79 redirect global model operations into that same client, and lines 258–292 preserve context for lazy delegates. Consequently:

- `scanQrInternal` attendance writes share the wrapper's PostgreSQL transaction and member lock.
- `updateTermInternal` SQL writes share the term transaction.
- `updateSchedule` called by a coach-change decision reuses the request transaction. There is no independently committed nested schedule transaction in this default code path.
- A schedule pattern and its generated sessions commit or roll back together.
- PostgreSQL identity projections share the wrapper transaction, while MongoDB writes and socket disconnections remain separate effects.

An apparent nested schedule-lock deadlock identified during this review was **withdrawn after inspecting this wrapper**. It is not listed as an implementation defect. The old audit's contrary transaction claims have been replaced in its JSON, status report and sequence sources.

## Business discrepancies and unresolved problems

These findings are static code-path findings. No database, bank or production concurrency experiment was run. Source evidence and classifications are expanded in [findings.json](findings.json).

| ID | Classification | Actual behavior and implication |
|---|---|---|
| G01 | IMPLEMENTATION_GAP | `createAttendance` validates Coach access, attendance window and enrollment but does **not** recheck subscription/term entitlement. Member QR attendance performs that check. Staff attendance can therefore follow different eligibility rules. The diagram remains truthful and does not add the missing guard. |
| G02 | IMPLEMENTATION_GAP | Rejected manual-code scans insert failed-attempt records/increment misuse counters, then throw inside the ambient scan transaction. Those writes roll back with the rejection. The intended retry/revocation protection is not durably established by this path. This needs a database-backed regression check before calling it fixed. |
| G03 | IMPLEMENTATION_GAP | QR refresh is 55 seconds, signed QR lifetime is 600 seconds and manual-code lifetime is 90 seconds. Refresh revokes old manual codes, not old QR JWTs. A rotating session secret that invalidates earlier QR credentials every 2–3 minutes is absent. |
| G04 | IMPLEMENTATION_GAP | The manual reminder trigger has authentication and roles but no facility context; its service reads upcoming schedules globally. Its find-before-create deduplication is not a concurrent unique claim. It must not be described as facility-limited or exactly idempotent. |
| G05 | IMPLEMENTATION_GAP | Outbox rows are claimed `PENDING → SENDING`, but the worker has no lease or recovery of stranded SENDING rows. Notification creation and marking SENT are separate writes. Crash recovery and exactly-once delivery are not guaranteed by this implementation. |
| G06 | IMPLEMENTATION_GAP | Checkout checks for a matching PENDING order before creating one, without a lock/unique constraint covering the member-plan pending pair. Concurrent checkouts can bypass that sequential duplicate check. Settlement's payment lock and bank-allocation deduplication are separate protections and remain represented. |
| G07 | IMPLEMENTATION_GAP | Bulk enrollment's conflict candidate query only fetches bookings overlapping the whole-course time span. A booking immediately before the first or after the last session can be excluded before applying the cross-facility travel buffer. |
| G08 | IMPLEMENTATION_GAP | Single-session `assertCanBook` checks approved attendance-removal reports and facility member limits; `evaluateCourseEligibility` does not perform those checks. Bulk registration can reactivate cancelled rows without that removal-report blocker when its other conditions pass. This is separate from a still-active attendance penalty. |
| S01 | SPEC_AMBIGUITY | The strict subscription cutoff reference conflicts with the explicitly documented and implemented `HALF_REMAINING_TERM_V1` exception. Normal bulk coverage requires the final session's end at or before subscription expiry. A server-created grant can authorize the same class/term after natural expiry when at least half the purchased period remained at approval. The source must not be changed to imply unconditional strict coverage. |
| S02 | SPEC_AMBIGUITY | There is no master specification to settle operating-hour/maintenance-calendar requirements, all expected report permissions or complete requirement IDs. The schema models active/inactive resources, not a full opening-hours/closure calendar. Those capabilities are not invented in diagrams. |
| U01 | UNVERIFIED | Legacy receptionist member creation commits MongoDB before PostgreSQL provisioning. SQL rollback cannot undo that Mongo commit. Cross-store recovery and failure compensation were not exercised. |
| U02 | UNVERIFIED | Existing API-only or unmounted UI flows remain identified individually: planner, health-note PATCH, legacy CSV export/report views, penalty controls, slots/patterns, receptionist monitoring/warning/report submission and receptionist leave. A component or endpoint's existence is not proof of a reachable user journey. |

Registration OTP/email verification, separate Coach training-result recording, attendance XLSX export, location/directions integration and revocation-based rotating QR remain unsupported in the inspected repository. No new workflow was invented for them. Password-reset OTP is implemented and is a separate flow.

The sequence business status is **72 PASS / 24 NEED_REVIEW**. PASS means the declared source flow is represented; it is not a production test certificate. NEED_REVIEW means a policy conflict, implementation risk or UI reachability limit remains. Diagram errors found in this pass were corrected; implementation gaps were reported without modifying runtime code.

## Cross-diagram checks

Actor and route terminology now follows the actual `ADMIN`, `MANAGER`, `COACH`, `RECEPTIONIST`, `MEMBER` roles. Some legacy MGR/REC filenames intentionally remain unchanged; the diagram actor and route guards define the current responsibility. Admin inherits permissions from some `authorize` calls, but does not bypass `authorizeExact` or the Manager-only schedule-write policy.

Enrollment remains a per-session database row even when the current Member UI registers a whole course. Quota counts distinct future booked classes globally. Payment SUCCESS and entitlement ACTIVATED/SCHEDULED/REQUIRES_REVIEW remain separate states. A cancellation/refund request is distinct from confirmation of an actual refund. Facility purchase origin is distinct from the facility of class attendance or door entry. FREE door access is distinct from paid class entitlement. Term-grant source cancellation/refund revokes the funded rights rather than changing the subscription expiry date.

## Validation and limitations

Commands actually used:

```powershell
node docs/diagram-audit/update-erd.mjs
node docs/sequence-diagrams/verify.mjs
node docs/diagram-audit/build-report.mjs
$env:MERMAID_SCRIPT_PATH = '<installed mermaid>/dist/mermaid.min.js'
node docs/diagram-audit/verify-all.mjs
node docs/diagram-audit/inspect-layout.mjs
node docs/presentation/render_png.cjs
```

Static sequence validation checks declarations, arrow endpoints, fragment closure, activation balance across branches, lane/message counts and configured styling. Browser validation parses and renders all **106 Mermaid diagrams**, validates all **7 native SVGs** as XML, checks computed paint against black/white, verifies straight dashed lifelines, rejects mirrored bottom headers, records fonts/dimensions and exports tight SVGs. The seven existing presentation PNGs are regenerated from their SVGs. Raster antialiasing introduces grayscale edge pixels; the source paints are black and white.

Contact sheets and full-size complex sequence renders were visually inspected. Text-bound intersection checks supplement that review; they do not prove every possible editor/font/export combination is overlap-free. The layout review records any remaining flags and their disposition. Large master ERD/use-case diagrams remain vector overview/appendix drawings; use the existing role-specific presentation views for smaller report figures. Do not scale the entire 40-model ERD onto one A4 page and expect readable attributes.

The final text-geometry pass reports **zero intersection candidates across all 113 rendered items**. The existing presentation generator and role-label JSON were also aligned with the new palette/content, so future generation does not intentionally restore obsolete colors or Coach-leave labels. The Node PNG helper rendered **7/7 SVGs** successfully. The legacy Python generator was reviewed as source but could not be executed: the available Python launcher points to a missing interpreter. Its regenerated outputs therefore remain unverified; the delivered SVG/PNG/Mermaid files themselves were checked independently as described above.

No direct draw.io import, PNG/PDF export through draw.io, runtime authorization test, real payment callback, deployed-database introspection, race reproduction or business-test rerun is claimed. Configurations vary between Mermaid/draw.io versions. The checked SVG exports provide a stable print artifact; recheck native editor geometry after import. No PDF was present to update or validate.
