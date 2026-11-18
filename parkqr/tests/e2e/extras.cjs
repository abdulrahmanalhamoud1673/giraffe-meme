// Short code (scan page, landing entry), block button in the inbox, source tag from the link.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const r = await (await b.newContext()).newPage(); r.on('pageerror', (e) => errs.push(e.message));
  await r.goto('http://localhost:8788/?s=ig'); await r.waitForTimeout(300);
  await r.goto('http://localhost:8788/register.html');
  await r.fill('#first', 'سامر'); await r.fill('#last', 'النجار'); await r.fill('#phone', '0788' + String(Math.floor(100000 + Math.random() * 899999)));
  await r.evaluate(() => { const c = document.querySelector('#consent'); if (c && !c.checked) c.click(); });
  await r.click('button[type=submit]'); await r.waitForSelector('#doneView:not([hidden])');
  const { token, key } = await r.evaluate(() => window.__reg);
  console.log('source remembered from the landing link:', await r.evaluate(() => localStorage.getItem('yn_src')));
  const p = await (await b.newContext({ viewport: { width: 400, height: 860 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8788/'); await p.fill('#codeIn', 'yn-' + token.toUpperCase().slice(0, 3) + ' ' + token.toUpperCase().slice(3));
  await Promise.all([p.waitForURL(/\/c\?t=/), p.click('.codeForm button')]);
  await p.waitForSelector('#pick:not([hidden])');
  console.log('typed code opens the scan page of that car; code shown:', await p.textContent('#codeLine'));
  await p.locator('.opt').first().click(); await p.waitForSelector('#sent:not([hidden])');
  const o = await (await b.newContext({ viewport: { width: 400, height: 860 } })).newPage(); o.on('pageerror', (e) => errs.push(e.message)); o.on('dialog', (d) => d.accept());
  await o.goto('http://localhost:8788/inbox.html#' + key); await o.waitForSelector('.blockBtn');
  await o.click('.blockBtn'); await o.waitForFunction(() => document.querySelector('.blockBtn').textContent.includes('تم'));
  console.log('block button works:', true);
  await o.screenshot({ path: process.argv[2] ? process.argv[2] + '/inbox_block.png' : '/tmp/inbox_block.png' });
  console.log('errs', errs); await b.close();
})();
