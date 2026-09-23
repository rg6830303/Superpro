const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const GPU = ['--use-angle=gl','--ignore-gpu-blocklist','--enable-gpu-rasterization'];
const BUNDLE = fs.readFileSync(path.join(DIR, 'dist/opening.js'), 'utf8');

// A play-only pass, so the clip is the animation and nothing else.
async function capture({ name, width, height, isMobile }) {
  const outDir = path.join(DIR, 'clean-' + name);
  fs.rmSync(outDir, { recursive: true, force: true });
  const browser = await chromium.launch({ args: GPU });
  const ctx = await browser.newContext({
    viewport: { width, height }, isMobile, hasTouch: isMobile, deviceScaleFactor: 1,
    recordVideo: { dir: outDir, size: { width, height } },
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.setContent('<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<body style="margin:0;background:#02121d"></body>');
  await page.addScriptTag({ content: BUNDLE });
  await page.evaluate(() => window.createSuperproOpening());
  await page.waitForFunction(() => window.superproOpening && window.superproOpening.seek, null, { timeout: 20000 });
  // Hide the skip control: it belongs in the product, not in the showreel.
  await page.evaluate(() => { const b = document.querySelector('#sp-open .skip'); if (b) b.style.display = 'none'; });
  await page.waitForTimeout(250);
  await page.evaluate(() => window.superproOpening.play());
  await page.waitForTimeout(4050);
  await ctx.close(); await browser.close();
  const webm = fs.readdirSync(outDir).find(f => f.endsWith('.webm'));
  fs.renameSync(path.join(outDir, webm), path.join(DIR, `clean-${name}.webm`));
  fs.rmSync(outDir, { recursive: true, force: true });
  console.log(name, 'errors:', errs.length ? errs.slice(0, 2) : 'none');
}

(async () => {
  await capture({ name: 'desktop', width: 1440, height: 810, isMobile: false });
  await capture({ name: 'mobile', width: 390, height: 844, isMobile: true });
})();
