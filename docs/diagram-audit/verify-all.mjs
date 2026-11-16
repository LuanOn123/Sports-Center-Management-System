// Local, deterministic Mermaid and SVG QA. No application server or database is used.
// MERMAID_SCRIPT_PATH must point to an installed Mermaid browser bundle.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { config, directive } from './style.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const requireFE = createRequire(path.join(root, 'FE/package.json'));
const { chromium } = requireFE('playwright');
if (!process.env.MERMAID_SCRIPT_PATH) throw new Error('Set MERMAID_SCRIPT_PATH to an installed mermaid.min.js');
const qaDir = process.env.DIAGRAM_QA_DIR || path.join(os.tmpdir(), 'scms-diagram-standardization-qa');
const exportDir = path.join(dir, 'exports');
await fs.mkdir(exportDir, { recursive: true });
await fs.mkdir(qaDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 1 });
const report = { date: '2026-11-01', renderer: 'Mermaid / Chromium via Playwright', drawioImportTested: false, runtimeTested: false, qaDir, files: [] };
const filter = process.env.DIAGRAM_FILTER?.split(',').filter(Boolean);
const sources = [];
for (const f of (await fs.readdir(path.join(root, 'docs/sequence-diagrams'))).filter(f => f.endsWith('.mmd')).sort()) {
  sources.push({ file: `docs/sequence-diagrams/${f}`, id: f.slice(0, -4), source: await fs.readFile(path.join(root, 'docs/sequence-diagrams', f), 'utf8'), sequence: true });
}
for (const f of ['database-erd', 'sports-center-use-cases']) {
  sources.push({ file: `docs/architecture/${f}.mmd`, id: f, source: await fs.readFile(path.join(root, `docs/architecture/${f}.mmd`), 'utf8') });
}
const presentation = await fs.readFile(path.join(root, 'docs/presentation/diagrams.md'), 'utf8');
let n = 0;
for (const m of presentation.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)) {
  n++;
  sources.push({ file: `docs/presentation/diagrams.md#${n}`, id: `presentation-${n}`, source: m[1] });
}
try {
  await page.setContent('<html><body style="margin:0;background:#fff"><div id="output"></div></body></html>');
  await page.addScriptTag({ path: process.env.MERMAID_SCRIPT_PATH });
  await page.evaluate(config => mermaid.initialize({ ...config, startOnLoad: false, securityLevel: 'strict' }), config);
  for (const item of sources) {
    if (filter && !filter.includes(item.id)) continue;
    const row = { file: item.file, export: `docs/diagram-audit/exports/${item.id}.svg`, sourceSha256: createHash('sha256').update(item.source).digest('hex') };
    try {
      if (!item.source.startsWith(directive)) throw new Error('Missing portable monochrome configuration');
      const result = await page.evaluate(async ({ source, sequence }) => {
        await mermaid.parse(source);
        const rendered = await mermaid.render('diagramQA', source);
        document.querySelector('#output').innerHTML = rendered.svg;
        const svg = document.querySelector('#output svg');
        svg.style.backgroundColor = '#FFFFFF';
        // Mermaid 12 leaves 2000px placeholder lifelines when mirrorActors is false.
        // Its own viewBox clips them. Shorten them to the rendered content boundary
        // before fitting bounds, otherwise getBBox would reintroduce blank space.
        if (sequence) {
          const rootInverse = svg.getCTM().inverse();
          const content = [...svg.querySelectorAll('text,rect,circle,ellipse,path,line,polygon,polyline')]
            .filter(el => !el.matches('.actor-line') && !el.closest('defs,marker,clipPath'));
          const bottom = Math.max(...content.map(el => {
            const b = el.getBBox(), m = rootInverse.multiply(el.getCTM());
            return Math.max(...[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]]
              .map(([x,y]) => new DOMPoint(x,y).matrixTransform(m).y));
          }));
          const end = bottom + 18;
          for (const line of svg.querySelectorAll('.actor-line')) line.setAttribute('y2', String(end));
        }
        // Fit to actual visible content, including labels, with a 12px print margin.
        const box = svg.getBBox();
        svg.setAttribute('viewBox', `${box.x - 12} ${box.y - 12} ${box.width + 24} ${box.height + 24}`);
        svg.setAttribute('width', String(Math.ceil(box.width + 24)));
        svg.setAttribute('height', String(Math.ceil(box.height + 24)));
        svg.style.maxWidth = 'none';
        const allowed = new Set(['rgb(0, 0, 0)', 'rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)', 'none']);
        const badPaint = [], clips = [], labels = [];
        const view = svg.viewBox.baseVal;
        for (const el of svg.querySelectorAll('text,tspan,rect,circle,ellipse,line,path,polygon,foreignObject')) {
          if (el.closest('defs,marker,clipPath')) continue;
          const css = getComputedStyle(el);
          if (css.display === 'none' || css.visibility === 'hidden' || Number(css.opacity) === 0) continue;
          for (const prop of ['fill', 'stroke']) {
            const value = css[prop];
            if (!allowed.has(value)) badPaint.push({ tag: el.tagName, prop, value });
          }
          if (el.tagName === 'text' && el.textContent.trim()) {
            const b = el.getBBox();
            labels.push({ text: el.textContent.trim(), x: b.x, y: b.y, width: b.width, height: b.height });
            if (!b.width || !b.height) clips.push(el.textContent.trim());
          }
        }
        const lifelines = [...svg.querySelectorAll('.actor-line')];
        const headers = svg.querySelectorAll('rect.actor-top').length;
        const bottoms = svg.querySelectorAll('rect.actor-bottom').length;
        const badLifelines = sequence ? lifelines.filter(el => {
          const css = getComputedStyle(el);
          return css.stroke !== 'rgb(0, 0, 0)' || css.strokeDasharray === 'none' || el.getAttribute('x1') !== el.getAttribute('x2');
        }).length : 0;
        const fontFamilies = [...new Set([...svg.querySelectorAll('text')].map(el => getComputedStyle(el).fontFamily))];
        return { svg: svg.outerHTML, width: Math.ceil(view.width), height: Math.ceil(view.height), badPaint, emptyLabels: clips, badLifelines, headers, bottoms, labelCount: labels.length, fontFamilies, lifelineBottomPadding: sequence ? 18 : null };
      }, item);
      const { svg, ...checks } = result;
      Object.assign(row, checks);
      if (result.badPaint.length || result.badLifelines || result.bottoms || result.emptyLabels.length) throw new Error('SVG style / geometry check failed');
      await fs.writeFile(path.join(exportDir, item.id + '.svg'), svg);
      // Raster QA outside the repository; delivered SVG is resolution independent.
      await page.locator('#output svg').screenshot({ path: path.join(qaDir, item.id + '.png'), timeout: 60000 });
      row.status = 'PASS';
    } catch (error) { row.status = 'FAIL'; row.error = error.message; }
    report.files.push(row);
    if (report.files.length % 16 === 0) console.log(`Verified ${report.files.length}/${sources.length}`);
  }
  // Existing presentation SVGs are source-native assets; check XML and export matching PNGs.
  for (const f of (await fs.readdir(path.join(root, 'docs/presentation'))).filter(f => f.endsWith('.svg'))) {
    if (filter && !filter.includes(f.replace(/\.svg$/, ''))) continue;
    const file = `docs/presentation/${f}`;
    const source = await fs.readFile(path.join(root, file), 'utf8');
    const row = { file, sourceSha256: createHash('sha256').update(source).digest('hex') };
    try {
      const checks = await page.evaluate(source => {
        const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
        if (doc.querySelector('parsererror')) throw new Error('Invalid SVG XML');
        document.querySelector('#output').replaceChildren(document.importNode(doc.documentElement, true));
        const svg = document.querySelector('#output svg');
        const badPaint = [];
        for (const el of svg.querySelectorAll('text,rect,circle,ellipse,line,path,polygon')) {
          const css = getComputedStyle(el);
          for (const prop of ['fill','stroke']) if (!['none','rgb(0, 0, 0)','rgb(255, 255, 255)'].includes(css[prop])) badPaint.push(css[prop]);
        }
        return { badPaint, width: svg.width.baseVal.value, height: svg.height.baseVal.value };
      }, source);
      Object.assign(row, checks);
      if (checks.badPaint.length) throw new Error('Non-monochrome native SVG');
      await page.locator('#output svg').screenshot({ path: path.join(root, file.replace(/\.svg$/, '.png')) });
      row.status = 'PASS';
    } catch (error) { row.status = 'FAIL'; row.error = error.message; }
    report.files.push(row);
  }
} finally { await browser.close(); }
if (filter) {
  const previous = JSON.parse(await fs.readFile(path.join(dir, 'validation.json'), 'utf8'));
  report.files = previous.files.map(row => report.files.find(current => current.file === row.file) || row);
}
report.total = report.files.length;
report.passed = report.files.filter(f => f.status === 'PASS').length;
report.failed = report.total - report.passed;
await fs.writeFile(path.join(dir, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed, qaDir }));
for (const row of report.files.filter(f => f.status === 'FAIL')) console.error(row.file, row.error, row.badPaint?.slice(0, 5));
if (report.failed) process.exitCode = 1;
