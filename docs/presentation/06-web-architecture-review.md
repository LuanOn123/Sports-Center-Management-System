# Web architecture diagram verification

Updated 1 November 2026. The existing raster language variants now have editable monochrome sources: [Vietnamese SVG](06-web-architecture-corrected.svg), [PNG](06-web-architecture-corrected.png), [English SVG](07-web-architecture-english.svg), [PNG](07-web-architecture-english.png).

The reconstruction retains Frontend / Backend / External services / PostgreSQL / MongoDB, replaces decorative logos and colored cards with black text/outlines and white fills, and renders the PNGs with Chromium. No image-generation output is claimed for this revision.

Frontend technologies follow FE/package.json; backend technologies and integrations follow BE/package.json and BE/src/app.ts. Socket JWT authentication is in BE/src/modules/chat/chat.socket.ts. MongoDB stores source identities/profiles/refresh tokens; backend services synchronize PostgreSQL projections. Prisma/Mongoose belong to one modular-monolith backend. The SePay webhook is inbound, while API/SDK calls are outbound. External integrations depend on environment configuration.

Mobile source is absent from this checkout, so its versions/device behavior remain unverified. These are technology/architecture overviews, not complete request sequences. See [the audit](../diagram-audit/REPORT.md) and [validation evidence](../diagram-audit/validation.json). Direct draw.io import and runtime service connectivity were not tested.
