import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { config, directive } from '../diagram-audit/style.mjs';

// No project dependency changes. Pass an existing bundled Mermaid browser script.
// PowerShell: $env:MERMAID_SCRIPT_PATH = '<path>/mermaid/dist/mermaid.min.js'
// node docs/sequence-diagrams/verify.mjs
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const requireFE = createRequire(path.join(root, 'FE/package.json'));
const scriptPath = process.env.MERMAID_SCRIPT_PATH;
const renderDir = process.env.SEQUENCE_RENDER_DIR;
const report = { baselineCommit: '4a9e660', renderer: null, renderTested: false, drawioImportTested: false, files: [] };
let browser, page;
if (scriptPath) {
  const { chromium } = requireFE('playwright');
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
  await page.setContent('<html><body style="margin:0;background:white"><div id="output"></div></body></html>');
  await page.addScriptTag({ path: scriptPath });
  await page.evaluate(config => mermaid.initialize({ ...config, startOnLoad: false, securityLevel: 'strict' }), config);
  report.renderer = 'Mermaid browser parser and SVG renderer / Chromium via Playwright';
  report.renderTested = true;
  if (renderDir) await fs.mkdir(renderDir, { recursive: true });
}
try {
  for (const file of (await fs.readdir(dir)).filter(f => f.endsWith('.mmd')).sort()) {
    const text = await fs.readFile(path.join(dir, file), 'utf8');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('%%'));
    const item = { file, sha256: createHash('sha256').update(text).digest('hex'), participants: 0, actors: 0, arrows: 0, maxFrameDepth: 0, nestingException: /%% NESTING_EXCEPTION:/.test(text), static: 'PASS', render: scriptPath ? 'PASS' : 'NOT_TESTED' };
    try {
      assert.equal(lines[0], 'sequenceDiagram');
      assert.equal(lines.filter(l => l === 'sequenceDiagram').length, 1);
      assert.match(text, /%% STATUS: IMPLEMENTED/);
      assert(text.startsWith(directive + '\n'), 'Missing shared monochrome / top-only-header configuration');
      assert(!/```|<br|^\s*(rect|box|par)\b/m.test(text));
      const ids = new Set(), activations = new Map();
      const frames = [];
      const state = () => JSON.stringify([...activations].filter(([, n]) => n).sort(([a], [b]) => a.localeCompare(b)));
      let frameDepth = 0, messagesStarted = false;
      for (const line of lines) {
        let match = line.match(/^(actor|participant) (\w+) as (.+)$/);
        if (match) {
          assert(!messagesStarted, 'Participant declared after messages');
          assert(!ids.has(match[2]), 'Duplicate participant');
          ids.add(match[2]);
          if (match[1] === 'actor') item.actors++;
          continue;
        }
        match = line.match(/^(\w+)(->>|-->>)(\w+): (.+)$/);
        if (match) {
          messagesStarted = true;
          assert(ids.has(match[1]) && ids.has(match[3]), 'Unknown arrow endpoint');
          assert(!match[4].includes(';'), 'Semicolon in message');
          item.arrows++;
        } else if (line.includes('->')) {
          assert.fail('Unexpected arrow syntax: ' + line);
        }
        if (/^(alt|opt|loop) /.test(line)) {
          frameDepth++;
          frames.push({ type: line.split(' ')[0], before: state(), branches: [], hasElse: false });
          item.maxFrameDepth = Math.max(frameDepth, item.maxFrameDepth);
        }
        if (/^else\b/.test(line)) {
          assert(frameDepth > 0, 'else outside frame');
          const frame = frames.at(-1);
          assert.equal(frame.type, 'alt', 'else must belong to alt');
          frame.branches.push(state());
          frame.hasElse = true;
        }
        if (line === 'end') {
          assert(frameDepth > 0, 'Unexpected end');
          const frame = frames.pop();
          frame.branches.push(state());
          if (frame.type !== 'alt' || !frame.hasElse) frame.branches.push(frame.before);
          assert(frame.branches.every(s => s === frame.branches[0]), 'Activation differs between conditional paths');
          frameDepth--;
        }
        match = line.match(/^(activate|deactivate) (\w+)$/);
        if (match) {
          assert(ids.has(match[2]), 'Unknown activation participant');
          const count = (activations.get(match[2]) || 0) + (match[1] === 'activate' ? 1 : -1);
          assert(count >= 0, 'Negative activation depth');
          activations.set(match[2], count);
        }
      }
      assert.equal(frameDepth, 0, 'Unclosed frame');
      assert([...activations.values()].every(count => count === 0), 'Unbalanced activation');
      item.participants = ids.size;
      assert(ids.size >= 5 && ids.size <= 8, 'Lane count outside supported range');
      assert.equal(item.actors, 1, 'Expected one initiating actor');
      assert(item.arrows <= 45, 'Diagram must be split');
      assert(item.maxFrameDepth <= (item.nestingException ? 4 : 3), 'More than allowed nested frames');
      if (page) {
        const svg = await page.evaluate(async source => {
          await mermaid.parse(source);
          const { svg } = await mermaid.render('verifiedSequence', source);
          document.querySelector('#output').innerHTML = svg;
          return svg;
        }, text);
        assert(svg.includes('<svg'), 'Missing SVG output');
        if (renderDir) {
          const base = path.join(renderDir, file.slice(0, -4));
          await fs.writeFile(base + '.svg', svg);
          await page.locator('#output svg').screenshot({ path: base + '.png' });
        }
      }
    } catch (error) {
      item.static = 'FAIL';
      if (page) item.render = 'FAIL';
      item.error = error.message;
    }
    report.files.push(item);
  }
} finally {
  if (browser) await browser.close();
}
report.total = report.files.length;
report.passed = report.files.filter(f => f.static === 'PASS' && f.render !== 'FAIL').length;
report.failed = report.total - report.passed;
await fs.writeFile(path.join(dir, 'validation-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed, renderTested: report.renderTested }));
for (const file of report.files.filter(f => f.static !== 'PASS')) console.error(file.file, file.error);
if (report.failed) process.exitCode = 1;
