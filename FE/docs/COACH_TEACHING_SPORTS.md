# Coach teaching authorization

The frontend uses `GET /coaches/{id}/specializations` as the source of teaching authorization. The free-text profile `specialization` is descriptive only. Managers may assign one or more sports; a coach with one sport can teach only that sport. A multi-sport class requires the coach to have every sport assigned, consistent with the backend schedule resource validator.

Implemented flows:
- Primary and support class assignment filter eligible coaches and recheck current class sports and coach qualifications immediately before posting.
- Leave replacement excludes the absent coach and requires the replacement to cover all class sports, with a fresh check before the decision is submitted.
- Class sport changes check existing coach assignments before patching.
- Manager qualification changes preserve sports used by active assigned classes, including a fresh class lookup before saving.
- Coach profiles display authorized sports separately from descriptive specialization.
- The existing ActivityPlanner component uses the same eligibility rules. Creating a new sport saves the sport first; it never implicitly authorizes a coach. This component currently has no mounted route in the application.

Checks: typecheck, conflict check, 101 unit tests and production build pass. Browser coverage includes eligibility, main/support assignments, multi-sport classes, stale qualifications, unavailable API data, replacement decisions, qualification removal, and existing Coach/Manager behavior. Browser API responses are fixtures; no production data was modified.

Backend handoff (no BE source changed): local `classes.service.ts` assignment functions currently validate active staff and schedule conflicts but do not check sport specializations. The schedule resource validator does check specializations. Both class assignment endpoints and class sport updates need the same check within their server transaction to enforce the rule for direct API clients and concurrent changes. Frontend checks cannot provide that guarantee. Existing incorrect assignments are preserved for managers to review and reassign; no automatic data migration was performed.
