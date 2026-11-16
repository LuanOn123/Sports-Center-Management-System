# Sequence coverage and limits

All 96 existing workflows remain in place. Business status: **72 PASS / 24 NEED_REVIEW**. [Per-file results](INDEX.md) · [Repository audit](../diagram-audit/REPORT.md) · [Complete evidence](../diagram-audit/traceability.json).

API implementation does not prove UI reachability. Legacy planner, penalties, report/CSV, slots/patterns and some receptionist actions remain individually marked. Health notes submitted during enrollment differ from the standalone PATCH API.

No implementation was found for registration verification OTP, separate Coach training results, attendance XLSX export, location/directions or rotating-session-secret revocation of old QR JWTs. Password-reset OTP and refreshed QR generation are separate implemented capabilities.

The strict subscription cutoff conflicts with the documented term grant. New findings include bulk/single-booking guard differences, staff attendance entitlement validation, failed manual-code counters rolling back, reminder scope, checkout races and outbox crash recovery. No runtime behavior was changed to hide these differences.

Ambient PostgreSQL transactions are centralized in `BE/src/config/prisma.ts`; nested schedule calls and global delegates are not independent commits. MongoDB/PostgreSQL recovery remains unverified.

All Mermaid and native SVG sources were parsed/rendered locally. Direct draw.io import/export and runtime business tests were not performed. No application dependency, code, schema or migration was changed; no commit/push/deploy was made.
