const {chromium}=require('C:/Users/rahul/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage();await p.setContent('<h1>Render ready</h1>');console.log(await p.title(),await p.locator('h1').textContent());await b.close();})().catch(e=>{console.error(e);process.exitCode=1;});
