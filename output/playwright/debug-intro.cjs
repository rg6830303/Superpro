const { chromium } = require('C:/Users/rahul/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const logs = [];
  page.on('console', m => logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', e => logs.push(`pageerror: ${e.message}`));
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => {
    const video = document.querySelector('video');
    return { video: video && { src: video.currentSrc, ready: video.readyState, paused: video.paused, error: video.error?.message }, seen: sessionStorage.getItem('superpro:intro-seen'), skip: window.__superproSkipIntro, body: document.body.innerText.slice(0, 200) };
  });
  await page.screenshot({ path: 'output/playwright/intro-mobile-live.png' });
  console.log(JSON.stringify({ state, logs }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
