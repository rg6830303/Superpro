async (page)=>{
  await page.setViewportSize({width:390,height:844});
  await page.addScriptTag({path:'C:/Users/rahul/Downloads/Superpro/output/playwright/superpro-intro/dist/intro.js'});
  await page.evaluate(()=>window.superproIntroReady);
  await page.evaluate(async()=>{const img=document.createElement('img');img.id='sp-canvas-readback';img.src=window.superproIntro.captureFrame(1.35);img.style.cssText='position:absolute;inset:0;width:100%;height:100%';await img.decode();document.querySelector('.sp-stage').appendChild(img);});
  await page.screenshot({path:'C:/Users/rahul/Downloads/Superpro/output/playwright/superpro-intro/webkit-canvas-readback.png'});
  await page.evaluate(()=>{document.querySelector('#sp-canvas-readback').remove();window.superproIntro.dispose();});
}
