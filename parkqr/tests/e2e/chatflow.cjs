// Short chat: the person who scanned writes, the owner answers from the inbox, a bad text is refused.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const r = await (await b.newContext()).newPage();
  await r.goto('http://localhost:8788/register.html'); await r.fill('#first', 'رامي'); await r.fill('#last', 'الشوابكة'); await r.fill('#phone', '0788' + String(Math.floor(100000 + Math.random() * 899999)));
  await r.evaluate(() => { const c = document.querySelector('#consent'); if (c && !c.checked) c.click(); }); await r.click('button[type=submit]'); await r.waitForSelector('#doneView:not([hidden])');
  const { token, key } = await r.evaluate(() => window.__reg);
  const s = await (await b.newContext({ viewport: { width: 390, height: 860 } })).newPage(); s.on('pageerror', (e) => errs.push(e.message));
  await s.goto('http://localhost:8788/c?t=' + token); await s.waitForSelector('#pick:not([hidden])'); await s.locator('.opt').first().click(); await s.waitForSelector('#sent:not([hidden])');
  await s.fill('#chatIn', 'انا قدام العمارة'); await s.press('#chatIn', 'Enter'); await s.waitForSelector('.cm.me');
  await s.fill('#chatIn', 'يا كلب'); await s.waitForTimeout(3500); await s.press('#chatIn', 'Enter'); await s.waitForFunction(() => document.getElementById('chatErr').textContent.length > 0);
  console.log('bad text refused with a friendly message:', (await s.textContent('#chatErr')).trim().slice(0, 40));
  const o = await (await b.newContext({ viewport: { width: 390, height: 860 } })).newPage(); o.on('pageerror', (e) => errs.push(e.message));
  await o.goto('http://localhost:8788/inbox.html#' + key); await o.waitForSelector('.chatToggle'); console.log('owner sees the chat button:', (await o.textContent('.chatToggle')).trim());
  await o.click('.chatToggle'); await o.waitForSelector('.chatBox:not([hidden]) .cm.him'); await o.fill('.chatBox input', 'تمام، نازل هلأ'); await o.press('.chatBox input', 'Enter'); await o.waitForSelector('.chatBox .cm.me');
  await s.waitForSelector('.cm.him', { timeout: 9000 }); console.log('sender sees the owner answer:', (await s.textContent('.cm.him')).trim());
  await o.screenshot({ path: (process.argv[2] || '/tmp') + '/chat_owner.png' }); await s.screenshot({ path: (process.argv[2] || '/tmp') + '/chat_sender.png' });
  console.log('errs', errs); await b.close();
})();
