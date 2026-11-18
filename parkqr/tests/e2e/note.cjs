// Optional note on the scan page: bad note is refused with a friendly message, good note reaches the inbox.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const r = await (await b.newContext()).newPage();
  await r.goto('http://localhost:8788/register.html');
  await r.fill('#first', 'ماجد'); await r.fill('#last', 'الزعبي'); await r.fill('#phone', '0788' + String(Math.floor(100000 + Math.random() * 899999)));
  await r.evaluate(() => { const c = document.querySelector('#consent'); if (c && !c.checked) c.click(); });
  await r.click('button[type=submit]'); await r.waitForSelector('#doneView:not([hidden])');
  const { token, key } = await r.evaluate(() => window.__reg);
  const p = await (await b.newContext({ viewport: { width: 400, height: 860 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8788/c?t=' + token); await p.waitForSelector('#pick:not([hidden])');
  console.log('note box hidden until asked:', await p.isHidden('#noteIn'));
  await p.click('#noteToggle'); await p.fill('#noteIn', 'يا كلب'); await p.locator('.opt').first().click(); await p.waitForSelector('#err:not(:empty)');
  console.log('bad note message:', (await p.textContent('#err')).trim().slice(0, 50), '| options enabled again:', !(await p.locator('.opt').first().isDisabled()));
  await p.fill('#noteIn', 'عند مدخل العمارة'); await p.locator('.opt').first().click(); await p.waitForSelector('#sent:not([hidden])');
  const o = await (await b.newContext({ viewport: { width: 400, height: 860 } })).newPage(); o.on('pageerror', (e) => errs.push(e.message));
  await o.goto('http://localhost:8788/inbox.html#' + key); await o.waitForSelector('.noteLine');
  console.log('inbox shows note:', (await o.textContent('.noteLine')).trim());
  await p.screenshot({ path: (process.argv[2] || '/tmp') + '/note_scan.png' });
  console.log('errs', errs); await b.close();
})();
