const {webkit}=require('C:/Users/rahul/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await webkit.launch();const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3001',{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>sessionStorage.getItem('superpro:intro-seen')==='1');
  await page.waitForTimeout(2500);
  assert.equal(await page.locator('[data-intro]').count(),0,'unsupported video must release the page');
  assert.equal(await page.locator('[data-site-content]').evaluate(el=>el.inert),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  await page.getByRole('navigation',{name:'Mobile navigation'}).waitFor();
  assert.equal(await page.locator('[data-menu-content]').evaluate(el=>el.inert),true);
  await page.screenshot({path:'output/playwright/webkit-mobile-menu.png'});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-menu-content]').evaluate(el=>el.inert),false);
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('[data-intro]').count(),0);
  assert.equal(errors.length,0,errors.join('\n'));
  await page.screenshot({path:'output/playwright/webkit-mobile-home.png'});
  fs.writeFileSync('output/playwright/webkit-release-results.json',JSON.stringify({layout:'passed',menu:'passed',fallback:'passed',refresh:'passed',errors,limitation:'Windows WebKit reports MEDIA_ERR_SRC_NOT_SUPPORTED for the H.264 clip; physical iOS playback not verified.'},null,2));
  console.log('WebKit layout, menu, unsupported-video fallback and refresh: PASS. Physical iOS playback unverified.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
