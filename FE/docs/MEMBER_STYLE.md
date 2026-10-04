# Member visual style — 27/09/2026

Reference: supplied Stitch screenshots and SVG logo in code.html.

- Scope: `.member-theme` in the authenticated member portal. Other roles use existing styles and color fallbacks.
- Source: `src/features/user/member-theme.css`. Background #0b1018; surfaces #131a26/#0e141e; lime #d4ff00; cyan #65cfff; text #f1f4f9; secondary text #9baac0.
- Logo: `public/brand/pulse-member.svg`, copied from the supplied SVG without redrawing.
- Controls: 7px corners, lime primary actions with dark text, outlined secondary actions. Status colors remain distinct from action colors.
- Cards/tables: thin borders, restrained shadows, consistent header/row spacing. Invoice list uses the shared Table component.
- Modals: dark surfaces, 14px corners, clear header/footer, member-specific eyebrow; native dialog focus, Escape and scroll handling preserved. Invoice print retains a light palette.
- Mobile: 390px checked; cards stack, tables/calendar scroll within their container. No document-wide horizontal overflow on reviewed pages.
- Shared inline styles use `var(--member-…, originalColor)` so non-member roles retain original colors. Prefer these tokens or semantic classes in new member components.

Validation: typecheck, production build, 49 unit tests, 9 Playwright tests passed. Visual review includes desktop/mobile and invoice/attendance modals. Automated contrast checks cover eight member pages. Browser data is mocked; no production transactions performed.

Preview images: `artifacts/member-redesign/`. Reproduce with `npx playwright test member-style-preview.spec.ts` from FE.
