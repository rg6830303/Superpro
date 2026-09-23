const { chromium, webkit } = require('C:/Users/rahul/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base='http://localhost:3001';
const results=[];
const ensure = (condition, message) => assert.ok(condition, message);
async function run(browser, name, width, height, checks=true) {
 const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600});
 const page=await context.newPage();
 const errors=[],media=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url().includes('/intro/'))media.push(r.url());});
 try {
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});
  const dialog=page.getByRole('dialog',{name:'SuperPro opening animation'});
  await dialog.waitFor({timeout:20000});
  await page.waitForFunction(()=>{const v=document.querySelector('video');return v && v.currentTime>.15;},{},{timeout:10000});
  const video=await page.locator('video').evaluate(v=>({src:v.currentSrc,time:v.currentTime,muted:v.muted,inline:v.playsInline,fit:getComputedStyle(v).objectFit,duration:v.duration}));
  ensure(video.src.endsWith(width<height?'mobile.mp4':'desktop.mp4'),`${name}: source orientation`);
  ensure(video.muted&&video.inline&&video.fit==='contain',`${name}: mobile-safe video`);
  ensure(Math.abs(video.duration-3.95)<.02,`${name}: duration`);
  await page.screenshot({path:`output/playwright/${name}-intro.png`});
  await dialog.waitFor({state:'detached',timeout:8000});
  await page.waitForTimeout(500);
  ensure(await page.locator('[data-site-content]').evaluate(el=>!el.inert),`${name}: content available`);
  ensure(await page.getByRole('dialog').count()===0,`${name}: no second welcome modal`);
  const overflow=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
  ensure(overflow.scroll<=overflow.viewport+1,`${name}: horizontal overflow ${JSON.stringify(overflow)}`);
  await page.screenshot({path:`output/playwright/${name}-home.png`,fullPage:false});
  const loads=media.length;
  await page.reload({waitUntil:'networkidle',timeout:60000});
  ensure(await page.locator('video').count()===0,`${name}: replay on refresh`);
  ensure(media.length===loads,`${name}: video downloaded again`);
  ensure(await page.locator('#superpro-boot').evaluate(el=>getComputedStyle(el).display==='none'||getComputedStyle(el).visibility==='hidden'),`${name}: cover after refresh`);
  if(checks && width<1280){
   await page.getByRole('button',{name:'Open menu',exact:true}).click();
   await page.getByRole('navigation',{name:'Mobile navigation'}).waitFor();
   ensure(await page.evaluate(()=>document.body.style.overflow)==='hidden',`${name}: menu scroll lock`);
   await page.screenshot({path:`output/playwright/${name}-menu.png`});
   await page.keyboard.press('Escape');
   ensure(await page.getByRole('button',{name:'Open menu',exact:true}).evaluate(el=>el===document.activeElement),`${name}: menu restores focus`);
   ensure(await page.evaluate(()=>document.body.style.overflow)!=='hidden',`${name}: scroll unlock`);
  }
  if(checks){
   await page.goto(base+'/login?welcome=login',{waitUntil:'networkidle',timeout:60000});
   ensure(await page.locator('video').count()===0&&media.length===loads,`${name}: auth replay`);
   await page.getByRole('button',{name:'Dismiss account confirmation'}).waitFor({timeout:1500});
   await page.getByRole('button',{name:'Dismiss account confirmation'}).click();
   await page.getByRole('heading',{name:/Welcome back/i}).waitFor({timeout:10000}).catch(()=>{});
  }
  ensure(!errors.length,`${name}: browser errors ${errors.join('\n')}`);
  results.push({name,video,overflow,mediaRequests:media.length,errors});console.log(`${name}: PASS`);
 }finally{await context.close();}
}
async function fallbacks(browser){
 for(const mode of ['reduced','blocked','storage','skip']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:mode==='reduced'?'reduce':'no-preference'});
  const page=await context.newPage();const media=[];
  page.on('request',r=>{if(r.url().includes('/intro/'))media.push(r.url());});
  if(mode==='blocked')await page.route('**/intro/*.mp4',route=>route.abort());
  if(mode==='storage')await page.addInitScript(()=>{Object.defineProperty(window,'sessionStorage',{get(){throw new Error('Storage unavailable');}})});
  try{
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
   if(mode==='skip'||mode==='storage'){
    await page.getByRole('button',{name:'Skip',exact:true}).waitFor();
    await page.getByRole('button',{name:'Skip',exact:true}).click();
   }
   await page.waitForTimeout(2300);
   ensure(await page.locator('video').count()===0,`${mode}: video blocked UI`);
   ensure(await page.evaluate(()=>document.body.style.overflow)!=='hidden',`${mode}: scroll locked`);
   if(mode==='reduced')ensure(!media.length,'reduced: unnecessary video download');
   results.push({mode,pass:true});console.log(`${mode}: PASS`);
  }finally{await context.close();}
 }
}
(async()=>{
 if(process.argv.includes('--webkit')){
  const safari=await webkit.launch();
  try{await run(safari,'webkit-phone',390,844);}
  finally{await safari.close();fs.writeFileSync('output/playwright/webkit-release-results.json',JSON.stringify(results,null,2));}
  return;
 }
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  await run(browser,'phone-390',390,844);
  await run(browser,'phone-320',320,568,false);
  await run(browser,'phone-430',430,932,false);
  await run(browser,'tablet-768',768,1024,false);
  await run(browser,'laptop-1366',1366,768);
  await fallbacks(browser);
 }finally{await browser.close();fs.writeFileSync('output/playwright/mobile-release-results.json',JSON.stringify(results,null,2));}
 if(!process.argv.includes('--chromium') && fs.existsSync(webkit.executablePath())){
  const safari=await webkit.launch();try{await run(safari,'webkit-phone',390,844);}finally{await safari.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
