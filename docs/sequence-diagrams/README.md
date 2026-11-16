# SCMS sequence diagrams

96 existing Mermaid sources, reviewed on 1 November 2026 against `4a9e660`. [Index](INDEX.md) · [Sequence audit](AUDIT_REPORT.vi.md) · [Repository audit](../diagram-audit/REPORT.md) · [Traceability](../diagram-audit/TRACEABILITY.md).

Business/source status: **72 PASS / 24 NEED_REVIEW**. Syntax/render validation is separate: [results](../diagram-audit/validation.json). Policy conflicts, implementation defects and unavailable UI mounts are reported without changing application code.

## Import and print

Copy one complete raw `.mmd` source into **draw.io → Arrange → Insert → Mermaid**. Choose Diagram if native editable shapes are offered. Direct import was not tested. Configuration support varies by editor; use the [tested SVG exports](../diagram-audit/exports/) for stable report figures.

Every source embeds the same white/black style: top-only participant headers, vertical dashed lifelines, solid calls, dashed returns, solid fragment borders with dashed operand separators, white activations and Arial text. Mermaid supplies guard brackets automatically. The user’s explicit monochrome requirement overrides AGENTS.md’s default-theme/no-configuration guidance.

No native draw.io XML was present. The export tool fits a 12px margin and ends lifelines 18px below actual content, avoiding Mermaid’s 2000px placeholders.

## Source boundaries

Lanes name actual modules/functions or grouped middleware. Workers/webhooks do not acquire fictional human UIs. Legacy MGR/REC filenames remain; the actor and guards define responsibility. API client lanes do not imply a mounted screen.

Global Prisma delegates and nested transactions join the ambient PostgreSQL transaction through `BE/src/config/prisma.ts`. MongoDB changes do not share SQL rollback. The old audit’s lock-only/global-client claims have been corrected.

Whole-course registration creates/reuses per-session rows. Normal coverage reaches the last session end; HALF_REMAINING_TERM_V1 can grant approved class/term attendance after natural expiry without extending the subscription. FREE door entry, paid class entitlement, money SUCCESS, activation and actual refund confirmation remain distinct.

## Reproduce checks

```powershell
node docs/sequence-diagrams/verify.mjs
$env:MERMAID_SCRIPT_PATH = '<installed mermaid>/dist/mermaid.min.js'
node docs/diagram-audit/verify-all.mjs
node docs/diagram-audit/inspect-layout.mjs
```

The first command is static unless the optional bundle is configured. Rendering uses existing FE Playwright and changes no dependencies. The report records actual results, visual checks and runtime/editor limitations.
