const {chromium}=require('C:/Users/rahul/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname;
(async()=>{
 const mode=process.argv[2]||'portrait',full=process.argv.includes('--full'),w=mode==='portrait'?1080:1920,h=mode==='portrait'?1920:1080;
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#031622"></body>');
 await page.addScriptTag({content:fs.readFileSync(path.join(dir,'film.bundle.js'),'utf8')});
 console.log(await page.evaluate(([w,h])=>window.makeKolkataFilm(w,h),[w,h]));
 if(!full){for(const [name,t] of [['bridge',.35],['victoria',1.0],['strike',1.69],['impact',1.986],['glass',2.15],['shards',2.33],['mark',2.94],['dock',3.75]]){const data=await page.evaluate(t=>window.film.frame(t),t);fs.writeFileSync(path.join(dir,`${mode}-${name}.jpg`),Buffer.from(data.split(',')[1],'base64'));}console.log('Stills ready');}
 else{
  const frames=path.join(dir,`frames-${mode}`);fs.mkdirSync(frames,{recursive:true});const fps=60,count=Math.round(3.8*fps),started=Date.now();
  for(let i=0;i<count;i++){const data=await page.evaluate(t=>window.film.frame(t,true),i/fps);fs.writeFileSync(path.join(frames,String(i).padStart(5,'0')+'.jpg'),Buffer.from(data.split(',')[1],'base64'));if(i%30===0)console.log(`${mode}: ${i}/${count} frames, ${Math.round((Date.now()-started)/1000)}s`);}
  console.log(`${mode}: ${count} frames complete`);
 }
 console.log('Page errors:',JSON.stringify(errors));await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
