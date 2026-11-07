const OUT=process.argv[2]||require('os').tmpdir();
const {chromium,devices}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
const ctx=await b.newContext({viewport:{width:400,height:900}});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8788/register.html');
await p.fill('#first','أحمد');await p.fill('#last','الخطيب');await p.fill('#nickname','تويوتا بيضاء');await p.fill('#phone','0788612398');await p.check('#consent');await p.click('#btn');
await p.waitForSelector('#doneView:not([hidden])');
const {key}=await p.evaluate(()=>window.__reg);
await p.screenshot({path:OUT+'/p_reg.png',fullPage:true});
for(const d of ['android','ios','denied','enabled','unsupported','desktop']){
  await p.goto('http://localhost:8788/inbox.html?demo='+d+'#'+key);await p.waitForSelector('#notif:not([hidden])');await p.waitForTimeout(400);
  await p.screenshot({path:OUT+'/p_'+d+'.png',fullPage:true});
}
console.log('real state (no demo):');
await p.goto('http://localhost:8788/inbox.html#'+key);await p.waitForSelector('#notif:not([hidden])');
console.log(await p.evaluate(()=>document.querySelector('#notif .n-head b').textContent));
console.log('manifest href:',(await p.getAttribute('#manifest','href')).replace(/k=.*/,'k=…'));
console.log('errs',errs);await b.close()})();
