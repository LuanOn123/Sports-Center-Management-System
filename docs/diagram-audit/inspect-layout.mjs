// Inspect delivered SVG text geometry and produce contact sheets for visual review.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const { chromium } = createRequire(path.join(root, 'FE/package.json'))('playwright');
const validation = JSON.parse(await fs.readFile(path.join(dir, 'validation.json'), 'utf8'));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1500 } });
const result = [];
try {
  for (const row of validation.files) {
    const source = await fs.readFile(path.join(root, row.export || row.file), 'utf8');
    const checks = await page.evaluate(source => {
      document.body.innerHTML = source;
      const svg = document.querySelector('svg');
      const boxes = [...svg.querySelectorAll('text,tspan')]
        .filter(el => !el.querySelector('tspan') && el.textContent.trim() && !el.closest('defs'))
        .map(el => {
          const b = el.getBoundingClientRect();
          return { text: el.textContent.trim(), x: b.x, y: b.y, right: b.right, bottom: b.bottom };
        });
      const unique = [...new Map(boxes.map(b => [JSON.stringify(b), b])).values()];
      const collisions = [];
      for (let i = 0; i < unique.length; i++) for (let j = i + 1; j < unique.length; j++) {
        const a = unique[i], b = unique[j];
        const w = Math.min(a.right, b.right) - Math.max(a.x, b.x);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
        if (w > 2 && h > 2) collisions.push({ a: a.text, b: b.text, width: w, height: h });
      }
      return { textSegments: unique.length, possibleTextCollisions: collisions };
    }, source);
    result.push({ file: row.file, ...checks });
  }
  const rows = validation.files.filter(r => r.export);
  for (let start = 0; start < rows.length; start += 16) {
    const cards = [];
    for (const row of rows.slice(start, start + 16)) {
      const png = await fs.readFile(path.join(validation.qaDir, path.basename(row.export, '.svg') + '.png'));
      cards.push(`<section><div>${path.basename(row.export, '.svg')}</div><img src="data:image/png;base64,${png.toString('base64')}"/></section>`);
    }
    await page.setContent(`<html><style>body{margin:0;background:white;font:12px Arial;display:grid;grid-template-columns:repeat(4,390px);gap:8px}section{height:360px;border:1px solid black;padding:3px;text-align:center}img{max-width:380px;max-height:335px}div{height:20px}</style><body>${cards.join('')}</body></html>`);
    await page.screenshot({ path: path.join(validation.qaDir, `sheet-${1 + start / 16}.png`), fullPage: true });
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(dir, 'layout-review.json'), JSON.stringify({ method: 'Browser text segment bounds; potential collisions require inspection, not a proof of all layout quality.', files: result }, null, 2) + '\n');
console.log(JSON.stringify({ diagrams: result.length, flagged: result.filter(r => r.possibleTextCollisions.length).map(r => ({ file: r.file, collisions: r.possibleTextCollisions.slice(0, 4) })) }, null, 2));
