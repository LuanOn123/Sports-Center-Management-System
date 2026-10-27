const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('../../FE/node_modules/@playwright/test');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  for (const file of fs.readdirSync(__dirname).filter(f => f.endsWith('.svg'))) {
    await page.goto(pathToFileURL(path.join(__dirname, file)).href);
    await page.evaluate(() => document.fonts.ready);
    const issues = await page.locator('svg text').evaluateAll(nodes => nodes.map(n => ({ label: n.textContent, box: n.getBBox() })).filter(n => n.box.x < 0 || n.box.y < 0 || n.box.x + n.box.width > 1600 || n.box.y + n.box.height > 900));
    if (issues.length) throw new Error(JSON.stringify({file, issues}));
    await page.screenshot({ path: path.join(__dirname, file.replace('.svg', '.png')) });
    console.log(`Rendered ${file}`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
