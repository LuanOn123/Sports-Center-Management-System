# Dashboard analytics redesign — 2026-10-09

## Audit and scope

The active dashboards are ManagerOverview → ManagerAnalytics (new), AdminDashboard, Reception DashboardPage → ReceptionAnalytics (new), and CoachWorkspace in dashboard mode. The legacy manage/Dashboard.tsx is not the active Manager dashboard and was left alone. The Member dashboard and the Manager revenue report retain their existing flows.

Before: Manager offered shortcuts and revenue totals/table; Reception showed a welcome banner, shortcuts, today's schedule and member list; Coach showed a welcome panel, three counters and the teaching calendar; Admin showed system totals, three facility comparisons and a table.

After: role-specific circular KPI cards, a dominant time-series where a complete date series is available, analyst rankings/columns, and a compact analytics side column. Existing Reception schedule/member lists and shortcuts, Coach calendar/session actions, Admin facility table, and Manager report remain available. Coach's assigned-class total and calendar link are retained.

No chart package existed. Existing DistributionChart uses CSS and other summaries use basic bars. New reusable SVG/CSS components (Card, Kpi, Timeline, Ranking, Columns, Gauge) add no dependencies and reuse `.panel`.

## Theme change audit: NONE

No global theme/color file was modified by this dashboard task. Existing uncommitted edits in portal-theme.css, PortalLayout, avatar and chat files belong to earlier avatar/hover requests; they were preserved.

The current theme is defined by src/styles.css, shared/design-system.css and the `.portal-theme` overrides in shared/portal-theme.css. Inter, dark portal surfaces, existing lime accent and status colors remain unchanged. The new CSS only styles analytics components and defines no theme variables or hex/RGB color literals.

Reused: --chart-1/2/3/4, --member-text, --member-muted, --member-border, --member-surface and --radius-control. Card background, radius, shadow and border inherit `.panel` and existing global tokens. Existing `.button` styles provide period controls.

Primary, secondary, background, sidebar, header, global text, buttons and fonts are unchanged. A browser test compares computed tokens, font, sidebar/header backgrounds and panel surfaces against the unchanged Manager report page.

## Data and semantics

- Manager: GET /reports/revenue for facility cash collected, refunds, net cash and collected-payment count; GET /class-schedules for a complete 7/30/90-day schedule. The existing X-Facility-Id transport and facility boundary are preserved; new cache keys include facility. No global member/facility report is fetched.
- Coach: existing useClasses(coachId)/useSchedules queries, restricted to assigned class IDs. No new requests. Week navigation and filters feed the charts. Main line counts non-cancelled sessions by start date, not attendance.
- Reception: GET /payments over an explicit Vietnam-time date interval, fully paginated; main line counts transactions CREATED each day. Success/pending are CURRENT states of that same created-date cohort, not paid-date revenue. Package-related transactions require a subscription link; they are not presented as activated packages. GET /attendance/monitoring supplies current member-class WARNING/VIOLATION/pending-report counts, independent of transaction date filters. GET /chat/messages/unread-count uses the existing chat query key. Existing permitted shortcuts remain; no removed check-in/room/sport module was reintroduced.
- Admin: existing ADMIN-only GET /reports/facilities, with date selectors, supplies system-wide facility comparisons. Existing notes about distinct system members versus multiple facility memberships remain. Main ranking shows net revenue, lower rankings show members and bookings, right column compares bookings/cancellations and active facilities.

Time series use Vietnam business dates and include zero-count dates between real activity dates. Schedule grouping uses class/room IDs so identical display names are not merged. Complete pagination is required; repeated pages or >50 pages fail explicitly rather than displaying partial totals. Requests support abort signals and query-cache reuse. Chart calculations are small (up to 90 daily points); no speculative memoization.

Percent rings/gauges only show ratios with meaningful denominators. A total without a valid denominator uses a neutral ring with Σ, not an invented target. Negative net revenue remains numeric/signed; ranking bar length uses magnitude, with the signed value shown.

## Deliberately omitted

The revenue API provides totals and only ten recent payments, not a full daily paidAt/refundedAt series. These ten records are NOT extrapolated into revenue trends. Admin's facility aggregate also has no chronological series, so it uses a dominant facility comparison instead. No daily revenue requests or new backend subsystem were added.

Revenue targets, previous-period growth, room-capacity utilization and radar performance scores were not supplied by the existing data sources. They are omitted. Schedule completion is clearly labeled as completion, not physical capacity utilization. No fake production data exists.

## UI and states

Desktop uses four KPI columns, a large main area and a narrower side column. KPI layout reduces to two columns at 1280px; analytics sides move below the main plot at 1024px, and cards stack at 600px. Charts scale within cards; labels are sampled on the time axis and full values remain available in the expandable data table. Bar values/legends and explicit labels mean color is not the only signal.

Time-series points expose native tooltips and an on-hover/on-focus readout/crosshair. Keyboard Tab reaches points; the data table offers an alternative. No animation was introduced. Existing Loading, Empty and ErrorState/retry components are reused; failed queries do not silently turn into zero totals.

## Files

- src/shared/analytics/Charts.tsx, analytics.css, data.ts, ScheduleAnalytics.tsx
- src/features/manage/ManagerAnalytics.tsx, ManagerOverview.tsx, AdminDashboard.tsx
- src/features/reception/dashboard/ReceptionAnalytics.tsx, DashboardPage.tsx
- src/features/coach/CoachWorkspace.tsx
- tests/dashboard-analytics.test.ts; tests/browser/dashboard-analytics.spec.ts
- tests/browser/admin-redesign.spec.ts: changed old chart CSS selector to the new reusable card selector.

## Verification

- Typecheck with noUnusedLocals/noUnusedParameters.
- 96 unit tests, including Vietnam date boundaries, zero-filled dates, duplicate class names, complete pagination and repeated-page rejection.
- Dashboard browser checks cover all four roles, 320/375/430/768/1024/1280/1440/1920px, point focus/readouts, filters, facility switching/headers, forbidden report absence for Reception, Coach assigned-class filtering, empty/error states, and preserved theme.
- Seven existing regression tests cover Manager navigation/redirects and read-only revenue, Admin facility overview, Coach authorization, empty classes, API failures, accessible loading and axe checks.
- Production build and merge-conflict check.

Browser APIs are intercepted with fixtures; this verifies FE rendering, query wiring and UI scope behavior, not production backend authorization. No production data was written.

Future work: if BE adds aggregated daily financial series, replace the schedule/comparison focal chart with revenue data without changing the reusable chart layer. Backend performance on very large attendance lists should be addressed with a summary endpoint rather than expanding FE pagination limits.


## Reference-image refinement

The supplied dashboard image was used for geometry/composition only. The four KPI cards now belong to the main column and align with the top of the right column. Manager's duplicate financial KPI row is replaced by a compact financial activity card in the side column; all four financial metrics and payment-method details remain accessible. Two analyst cards sit side by side below the main plot on desktop.

Circular KPIs now have a header, ring/value body and caption. The time-series has a compact total/peak/average summary, hollow points and a single existing-token area fade. Right-side charts use lollipop bars, a seven-axis weekday radar, activity summary and a needle gauge. The radar compares actual non-cancelled/completed session counts (Manager/Coach), or all/successful created-transaction counts (Reception). Every axis uses the same count scale; it is not an invented performance score. Admin remains on available facility comparisons without adding an unsupported chronological series.

No global color files, theme variables, shell colors, or fonts changed. All additions use existing theme tokens. Reference layout checks now assert four KPIs in one row at 1440px, the right column aligned with their top edge, and two analyst cards on the same row. The data table remains available for lollipop values and radar comparisons. Weekday aggregation has a Vietnam-time boundary unit test.
## Unified desktop board

Replaced the Manager hero banner and separate filter area with a compact board header. KPIs, central timeline, bottom comparisons and the right summary column share one surface and aligned separators. Existing quick links remain in an expandable header menu; chart explanations remain available through information controls. Payment-method details open together in one panel.

The Manager board fits 1366x768, 1440x900 and 1920x1080. Browser assertions check both board bounds and internal card content heights to catch clipping. Smaller screens retain natural vertical flow. SVG plots observe their actual plot space to avoid intrinsic sizing expanding the desktop grid. Theme file hashes remain unchanged from the start of this iteration.

Validation: npm run verify passed (typecheck, 96 unit tests, conflict check and production build); all 8 dashboard browser tests passed, including role layouts, empty/error states, theme comparison and desktop viewport fit. Browser screenshots use mocked API data, not live production data.
