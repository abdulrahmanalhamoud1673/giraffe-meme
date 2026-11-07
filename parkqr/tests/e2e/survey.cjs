const OUT=process.argv[2]||require('os').tmpdir();
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8788/survey.html');
await p.click('#btn');console.log('empty submit msg:',await p.textContent('#msg'));
const names=['age','city','has_car','freq','habit','would_use','sticker_price','sub_price','worry'];
for(const n of names)await p.locator('input[name='+n+']').first().check({force:true});
console.log('progress:',await p.textContent('#ptxt'));
await p.click('#btn');await p.waitForSelector('#done:not([hidden])');console.log('survey submitted ok',errs);
await p.screenshot({path:OUT+'/sv.png',fullPage:true});await b.close()})();
