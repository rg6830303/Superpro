async (page) => {
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.superproPreviewFrameTimes=[]; let last=performance.now(); const tick=now=>{window.superproPreviewFrameTimes.push(now-last);last=now;if(window.superproIntro.playing)requestAnimationFrame(tick);}; window.superproIntro.play();requestAnimationFrame(tick); });
  await page.waitForTimeout(7900);
  return await page.evaluate(()=>({
    version:window.superproIntro.version,
    url:location.href,
    viewport:[innerWidth,innerHeight],
    frames:window.superproPreviewFrameTimes.length,
    medianFrameMs:[...window.superproPreviewFrameTimes].sort((a,b)=>a-b)[Math.floor(window.superproPreviewFrameTimes.length/2)],
    overlayHidden:document.querySelector('#superpro-smash-preview').style.display==='none',
    headerVisible:document.querySelector('header img[alt="SuperPro"]').style.visibility!=='hidden'
  }));
}
