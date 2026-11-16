const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('../../FE/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  for (const file of fs.readdirSync(__dirname).filter(f => f.endsWith('.svg'))) {
    await page.goto(pathToFileURL(path.join(__dirname, file)).href);
    await page.evaluate(() => document.fonts.ready);
    const issues = await page.locator('svg').evaluate(svg => {
      const view = svg.viewBox.baseVal;
      return [...svg.querySelectorAll('text')].map(n => ({ label: n.textContent, box: n.getBBox() }))
        .filter(n => n.box.x < view.x || n.box.y < view.y ||
          n.box.x + n.box.width > view.x + view.width || n.box.y + n.box.height > view.y + view.height);
    });
    if (issues.length) throw new Error(JSON.stringify({file, issues}));
    await page.locator('svg').screenshot({ path: path.join(__dirname, file.replace('.svg', '.png')) });
    console.log(`Rendered ${file}`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
