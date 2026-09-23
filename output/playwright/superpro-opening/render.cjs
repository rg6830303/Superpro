const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * Frame-accurate renderer.
 *
 * Playwright's video capture records whatever the page manages to paint in real
 * time — dropped frames, variable spacing, and an encoder we do not control. For
 * a four-second title card that is the wrong tool. Here every frame is seeked to
 * an exact time and screenshotted, so the output is deterministic and the timing
 * is perfect regardless of how slow any single frame was to draw.
 *
 * Frames are rendered at twice the target rate and averaged in pairs by ffmpeg
 * (tmix), which produces real motion blur. The strike crosses the screen in a
 * fifth of a second; without blur it strobes.
 */
const DIR = __dirname;
const GPU = ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
const BUNDLE = fs.readFileSync(path.join(DIR, 'dist/opening.js'), 'utf8');

const SPAN = 3.9;
const FPS = 60;
const SUB = 2;                       // sub-frames per output frame -> motion blur
const TOTAL = Math.round(SPAN * FPS * SUB);

async function renderSequence({ name, width, height }) {
  const out = path.join(DIR, 'frames-' + name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const browser = await chromium.launch({ args: GPU });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.setContent(
    '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<body style="margin:0;background:#02121d"></body>'
  );
  await page.addScriptTag({ content: BUNDLE });
  await page.evaluate(() => window.createSuperproOpening());
  await page.waitForFunction(() => window.superproOpening && window.superproOpening.seek, null, { timeout: 30000 });

  // The skip control belongs in the product, never in the delivered clip.
  await page.evaluate(() => {
    const b = document.querySelector('#sp-open .skip');
    if (b) b.remove();
  });
  // Let textures decode and shaders compile before the first frame is kept.
  await page.evaluate(() => { for (const t of [0.2, 1.2, 2.3, 2.6, 3.2, 3.7]) window.superproOpening.seek(t); });
  await page.waitForTimeout(900);

  const started = Date.now();
  for (let i = 0; i < TOTAL; i++) {
    const t = (i / (FPS * SUB)) * 1;
    await page.evaluate(v => {
      window.superproOpening.seek(v);
      return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, t);
    await page.screenshot({
      // JPEG, not PNG: PNG encoding costs ~2s a frame at this size and the
      // frames are re-encoded to H.264 anyway, so the intermediate is a 10x
      // speed-up for no visible loss.
      path: path.join(out, String(i).padStart(5, '0') + '.jpg'),
      type: 'jpeg',
      quality: 96,
      animations: 'disabled',
    });
    if (i % 60 === 0) {
      const pct = ((i / TOTAL) * 100).toFixed(0);
      const secs = ((Date.now() - started) / 1000).toFixed(0);
      console.log(`  ${name} ${pct}% (${i}/${TOTAL}) ${secs}s`);
    }
  }

  await ctx.close();
  await browser.close();
  console.log(`${name}: ${TOTAL} frames in ${((Date.now() - started) / 1000).toFixed(0)}s, errors: ${errors.length ? errors.slice(0, 2) : 'none'}`);
}

(async () => {
  const which = process.argv[2];
  const jobs = [
    { name: 'landscape', width: 1920, height: 1080 },
    { name: 'portrait', width: 1080, height: 1920 },
  ].filter(j => !which || j.name === which);
  for (const j of jobs) await renderSequence(j);
})();
