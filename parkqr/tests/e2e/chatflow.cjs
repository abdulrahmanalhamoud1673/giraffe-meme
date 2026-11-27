// Short chat: the person who scanned writes, the owner answers from the inbox, a bad text is refused.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', ...(process.env.FAKE_CAM ? ['--use-file-for-fake-video-capture=' + process.env.FAKE_CAM] : [])] }); const errs = [];
  const r = await (await b.newContext()).newPage();
  await r.goto('http://localhost:8788/register.html'); await r.fill('#first', 'رامي'); await r.fill('#last', 'الشوابكة'); await r.fill('#phone', '0788' + String(Math.floor(100000 + Math.random() * 899999)));
  await r.evaluate(() => { const c = document.querySelector('#consent'); if (c && !c.checked) c.click(); }); await r.click('button[type=submit]'); await r.waitForSelector('#doneView:not([hidden])');
  const { token, key } = await r.evaluate(() => window.__reg);
  const s = await (await b.newContext({ viewport: { width: 390, height: 860 }, permissions: ['camera'] })).newPage(); s.on('pageerror', (e) => errs.push(e.message));
  await s.goto('http://localhost:8788/c?t=' + token); await s.waitForSelector('#pick:not([hidden])'); await s.locator('.opt').first().click(); await s.waitForSelector('#sent:not([hidden])');
  await s.fill('#chatIn', 'انا قدام العمارة'); await s.press('#chatIn', 'Enter'); await s.waitForSelector('.cm.me');
  await s.fill('#chatIn', 'يا كلب'); await s.waitForTimeout(3500); await s.press('#chatIn', 'Enter'); await s.waitForFunction(() => document.getElementById('chatErr').textContent.length > 0);
  console.log('bad text refused with a friendly message:', (await s.textContent('#chatErr')).trim().slice(0, 40));
  const o = await (await b.newContext({ viewport: { width: 390, height: 860 }, permissions: ['camera'] })).newPage(); o.on('pageerror', (e) => errs.push(e.message));
  await o.goto('http://localhost:8788/inbox.html#' + key); await o.waitForSelector('.chatToggle'); console.log('owner sees the chat button:', (await o.textContent('.chatToggle')).trim());
  await o.click('.chatToggle'); await o.waitForSelector('.chatBox:not([hidden]) .cm.him'); await o.fill('.chatBox input', 'تمام، نازل هلأ'); await o.press('.chatBox input', 'Enter'); await o.waitForSelector('.chatBox .cm.me');
  // pictures from the live camera, both directions (no gallery button exists)
  console.log('file pickers on the scan page:', await s.locator('input[type=file]').count());
  await s.fill('#chatIn', ''); await s.waitForTimeout(3300); await s.click('#chatCam'); await s.waitForSelector('.liveCam video'); await s.waitForFunction(() => document.querySelector('.liveCam video').videoWidth > 0);
  await s.click('.lcShot'); await s.click('.lcOk'); await s.waitForTimeout(1500); console.log('DBG err:', await s.textContent('#chatErr'), '| bubbles:', await s.locator('.cm').count()); await s.waitForSelector('.cm.me .cmImg');
  console.log('sender picture bubble shown:', true);
  await o.waitForSelector('.chatBox:not([hidden]) .cm.him .cmImg', { timeout: 9000 });
  await o.waitForFunction(() => { const i = document.querySelector('.chatBox .cm.him .cmImg'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 9000 });
  console.log('owner sees the sender picture: true');
  await o.waitForTimeout(3300); await o.click('.chatBox .camBtn'); await o.waitForFunction(() => document.querySelector('.liveCam video') && document.querySelector('.liveCam video').videoWidth > 0); await o.click('.lcShot'); await o.click('.lcOk');
  await s.waitForSelector('.cm.him .cmImg', { timeout: 9000 }); await s.waitForFunction(() => { const i = document.querySelector('.cm.him .cmImg'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 9000 });
  console.log('sender sees the owner picture: true');
  await s.waitForSelector('.cm.him', { timeout: 9000 }); console.log('sender sees the owner answer:', (await s.textContent('.cm.him')).trim());
  await o.screenshot({ path: (process.argv[2] || '/tmp') + '/chat_owner.png' }); await s.screenshot({ path: (process.argv[2] || '/tmp') + '/chat_sender.png' });
  console.log('errs', errs); await b.close();
})();
