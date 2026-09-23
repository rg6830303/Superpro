const {webkit}=require('C:/Users/rahul/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright');
(async()=>{const browser=await webkit.launch();try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await page.addInitScript(()=>{window.mediaLog=[];for(const e of ['loadstart','loadedmetadata','loadeddata','canplay','playing','error','ended'])document.addEventListener(e,event=>{if(event.target instanceof HTMLVideoElement)window.mediaLog.push({e,time:event.target.currentTime,ready:event.target.readyState,error:event.target.error?.message,code:event.target.error?.code})},true)});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('requestfailed',r=>errors.push(`${r.url()}: ${r.failure()?.errorText}`));
 await page.goto('http://localhost:3001',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>sessionStorage.getItem('superpro:intro-seen')!==null,{},{timeout:45000}).catch(e=>errors.push(e.message));
 await page.waitForTimeout(6500);
 console.log('MEDIA',await page.evaluate(()=>({log:window.mediaLog,codec:document.createElement('video').canPlayType('video/mp4; codecs="avc1.640020"')})));
 console.log(JSON.stringify({errors,state:await page.evaluate(()=>({seen:sessionStorage.getItem('superpro:intro-seen'),html:document.querySelector('[data-intro]')?.outerHTML,skip:window.__superproSkipIntro,body:document.body.innerText.slice(0,120),videos:document.querySelectorAll('video').length}))},null,2));
 await page.screenshot({path:'output/playwright/webkit-debug.png'});
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
