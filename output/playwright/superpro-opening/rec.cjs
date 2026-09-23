const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const GPU = ['--use-angle=gl','--ignore-gpu-blocklist','--enable-gpu-rasterization'];
const BUNDLE = fs.readFileSync(path.join(DIR, 'dist/opening.js'), 'utf8');

const BEATS = [
  ['bridge-early', 0.42], ['bridge-full', 0.90], ['victoria-early', 1.32],
  ['victoria-full', 1.88], ['paddle', 2.28], ['contact', 2.53],
  ['rush', 2.78], ['fill', 2.99], ['crack', 3.26], ['crack-full', 3.40], ['shards', 3.52], ['mark', 3.78],
];

async function capture({ name, width, height, isMobile }) {
  const outDir = path.join(DIR, 'rec-' + name);
  fs.rmSync(outDir, { recursive: true, force: true });
  const browser = await chromium.launch({ args: GPU });
  const ctx = await browser.newContext({
    viewport: { width, height }, isMobile, hasTouch: isMobile, deviceScaleFactor: 1,
    recordVideo: { dir: outDir, size: { width, height } },
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));

  // Without a viewport meta, mobile emulation lays out at 980px and every vw
  // unit and aspect-ratio query is measured against the wrong width.
  await page.setContent('<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<body style="margin:0;background:#02121d"></body>');
  await page.addScriptTag({ content: BUNDLE });
  await page.evaluate(() => window.createSuperproOpening());
  await page.waitForFunction(() => window.superproOpening && window.superproOpening.seek, null, { timeout: 20000 });

  for (const [label, t] of BEATS) {
    await page.evaluate(v => window.superproOpening.seek(v), t);
    await page.waitForTimeout(110);
    await page.screenshot({ path: path.join(DIR, `shot-${name}-${label}.png`) });
  }

  await page.evaluate(() => {
    window.__ft = []; let last = performance.now();
    const tick = n => { window.__ft.push(n - last); last = n; if (window.superproOpening.playing) requestAnimationFrame(tick); };
    window.superproOpening.play(); requestAnimationFrame(tick);
  });
  await page.waitForTimeout(4600);
  const stats = await page.evaluate(() => {
    const f = [...window.__ft].sort((a, b) => a - b);
    return { frames: f.length, median: +f[Math.floor(f.length / 2)].toFixed(1), p95: +f[Math.floor(f.length * 0.95)].toFixed(1) };
  });

  await ctx.close(); await browser.close();
  const webm = fs.readdirSync(outDir).find(f => f.endsWith('.webm'));
  fs.renameSync(path.join(outDir, webm), path.join(DIR, `opening-${name}.webm`));
  fs.rmSync(outDir, { recursive: true, force: true });
  return { stats, errs };
}

(async () => {
  for (const cfg of [
    { name: 'desktop', width: 1440, height: 810, isMobile: false },
    { name: 'mobile', width: 390, height: 844, isMobile: true },
  ]) {
    const r = await capture(cfg);
    console.log(cfg.name, JSON.stringify(r.stats), 'errors:', r.errs.length ? r.errs.slice(0, 2) : 'none');
  }
})();
