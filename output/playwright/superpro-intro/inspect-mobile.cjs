async (page) => {
  await page.setViewportSize({width:390,height:844});
  await page.addScriptTag({path:'C:/Users/rahul/Downloads/Superpro/output/playwright/superpro-intro/dist/intro.js'});
  await page.evaluate(() => window.superproIntroReady);
  for(const [name,t] of [['mobile-court',1.35],['mobile-contact',1.91],['mobile-logo',3.75],['mobile-dock',5.6],['mobile-home',6.5]]){
    await page.evaluate(t=>window.superproIntro.seek(t),t);
    await page.screenshot({path:`C:/Users/rahul/Downloads/Superpro/output/playwright/superpro-intro/${name}.png`});
  }
}
