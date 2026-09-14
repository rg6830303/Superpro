async (page) => {
  await page.setViewportSize({ width:1440, height:900 });
  await page.addScriptTag({path:'C:/Users/rahul/Downloads/Superpro/output/playwright/superpro-intro/dist/intro.js'});
  await page.evaluate(() => window.superproIntroReady);
  const frames = [['court',1.35],['contact',1.91],['ball',2.55],['logo',3.75],['dock',5.45],['home',6.5]];
  for (const [name,t] of frames) {
    await page.evaluate(t => window.superproIntro.seek(t),t);
    await page.screenshot({path:`C:/Users/rahul/Downloads/Superpro/output/playwright/superpro-intro/${name}.png`});
  }
  console.log(await page.evaluate(() => ({url:location.href,version:window.superproIntro.version,logo:document.querySelector('header img[alt="SuperPro"]').getBoundingClientRect().toJSON()})));
}
