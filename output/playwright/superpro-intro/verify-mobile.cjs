async (page) => {
  const browser=page.context().browser().browserType().name();
  if(browser==='firefox')await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Just looking around'}).click({timeout:10000}).catch(()=>{});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addScriptTag({path:'C:/Users/rahul/Downloads/Superpro/output/playwright/superpro-intro/dist/intro.js'});
  await page.evaluate(()=>window.superproIntroReady);
  await page.evaluate(()=>window.superproIntro.seek(1.35));
  await page.waitForTimeout(200);
  await page.screenshot({path:`C:/Users/rahul/Downloads/Superpro/output/playwright/superpro-intro/${browser}-mobile-verified.png`});
  const scene=await page.evaluate(()=>{
    const r=document.querySelector('#superpro-smash-preview').getBoundingClientRect();
    return {mode:window.superproIntro.mode,duration:window.superproIntro.duration,stats:window.superproIntro.stats,viewport:[innerWidth,innerHeight],overlay:[r.width,r.height],horizontalOverflow:document.documentElement.scrollWidth>innerWidth};
  });
  if(Math.abs(scene.viewport[0]-scene.overlay[0])>1||Math.abs(scene.viewport[1]-scene.overlay[1])>2)throw new Error('Intro does not fill the viewport');
  if(scene.horizontalOverflow)throw new Error('Horizontal overflow');
  if(scene.mode==='threejs'){
    await page.evaluate(()=>window.superproIntro.seek(6.08));
    const dock=await page.evaluate(()=>{const a=document.querySelector('header img[alt="SuperPro"]').getBoundingClientRect(),b=document.querySelector('.sp-logo').getBoundingClientRect();return Math.max(Math.abs(a.left-b.left),Math.abs(a.top-b.top),Math.abs(a.width-b.width),Math.abs(a.height-b.height));});
    if(dock>1)throw new Error(`Logo misses header: ${dock}px`);
  }
  await page.evaluate(()=>window.superproIntro.play());
  await page.waitForTimeout(5300);
  const restored=await page.evaluate(()=>document.querySelector('#superpro-smash-preview').style.display==='none'&&getComputedStyle(document.querySelector('header img[alt="SuperPro"]')).visibility==='visible');
  if(!restored)throw new Error('Page/header not restored after playback');
  await page.evaluate(()=>window.superproIntro.seek(1.35));
  await page.getByRole('button',{name:'Skip SuperPro introduction'}).click();
  const skip=await page.evaluate(()=>!window.superproIntro.playing&&document.querySelector('#superpro-smash-preview').style.display==='none');
  if(!skip)throw new Error('Skip does not finish the intro');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>window.createSuperproIntro());
  const reduced=await page.evaluate(()=>window.superproIntro.mode);
  if(reduced!=='reduced-motion')throw new Error('Reduced motion ignored');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>window.createSuperproIntro({forceFallback:true}));
  const fallback=await page.evaluate(()=>window.superproIntro.mode);
  await page.evaluate(()=>window.superproIntro.play());await page.waitForTimeout(1800);
  const fallbackRestored=await page.evaluate(()=>document.querySelector('#superpro-smash-preview').style.display==='none');
  if(fallback!=='logo-fallback'||!fallbackRestored)throw new Error('Fallback failed');
  await page.evaluate(()=>window.createSuperproIntro());
  await page.setViewportSize({width:844,height:390});
  await page.evaluate(()=>window.superproIntro.seek(1.35));
  await page.screenshot({path:`C:/Users/rahul/Downloads/Superpro/output/playwright/superpro-intro/${browser}-landscape-verified.png`});
  await page.evaluate(()=>window.superproIntro.dispose());
  if(errors.length)throw new Error(errors.join('\n'));
  return {browser,scene,restored,skip,reduced,fallback,fallbackRestored,pageErrors:errors,landscape:'captured',result:'PASS'};
}
