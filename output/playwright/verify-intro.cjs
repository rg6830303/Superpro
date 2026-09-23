const { chromium } = require('C:/Users/rahul/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright');

async function verify(label, viewport) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => message.type() === 'error' && errors.push(message.text()));

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 15000 });
  await page.waitForTimeout(2500);
  const first = await page.locator('video').evaluate(video => ({
    src: video.currentSrc,
    muted: video.muted,
    inline: video.playsInline,
  }));
  if (!first.src) throw new Error(`${label}: video source was not selected`);
  await page.waitForSelector('video', { state: 'detached', timeout: 8000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const afterRefresh = await page.locator('video').count();
  const coverAfterRefresh = await page.locator('#superpro-boot:not(.is-skipped)').count();

  await page.goto('http://localhost:3000/products', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const afterNavigation = await page.locator('video').count();

  console.log(JSON.stringify({ label, first, afterRefresh, coverAfterRefresh, afterNavigation, errors }, null, 2));
  await browser.close();
}

(async () => {
  await verify('desktop', { width: 1440, height: 900 });
  await verify('mobile', { width: 390, height: 844 });
})().catch(error => { console.error(error); process.exitCode = 1; });
