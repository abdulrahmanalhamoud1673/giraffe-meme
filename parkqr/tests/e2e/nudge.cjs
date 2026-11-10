// Sender page: the "remind him" countdown, the reply-time line, the reminder badge in the inbox, and the WhatsApp invite.
const OUT = process.argv[2] || require('os').tmpdir();
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const reg = await (await b.newContext()).newPage();
  await reg.goto('http://localhost:8788/register.html');
  await reg.fill('#first', 'أحمد'); await reg.fill('#last', 'الخطيب'); await reg.fill('#phone', '0788' + String(Math.floor(100000 + Math.random() * 899999))); await reg.check('#consent'); await reg.click('#btn');
  await reg.waitForSelector('#doneView:not([hidden])');
  const { token, key } = await reg.evaluate(() => window.__reg);
  const wa = await reg.getAttribute('#shareBtn', 'href');
  console.log('invite link opens WhatsApp with text:', wa.startsWith('https://wa.me/?text=') && decodeURIComponent(wa).includes('yanashmi.com/register'));

  // --- sender, with a fake clock so 3 minutes pass instantly
  const c = await b.newContext({ viewport: { width: 400, height: 860 } }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.clock.install();
  await p.goto('http://localhost:8788/c?t=' + token); await p.waitForSelector('#pick:not([hidden])');
  await p.locator('.opt').nth(2).click(); await p.waitForSelector('#sent:not([hidden])');
  const t0 = (await p.textContent('#nudgeBtn')).trim();
  console.log('right after sending, button says:', t0, '| disabled:', await p.isDisabled('#nudgeBtn'));
  await p.clock.fastForward('02:00');
  console.log('after 2 minutes:', (await p.textContent('#nudgeBtn')).trim());
  await p.clock.fastForward('01:05');
  console.log('after 3:05, enabled:', !(await p.isDisabled('#nudgeBtn')), '|', (await p.textContent('#nudgeBtn')).trim());
  await p.screenshot({ path: OUT + '/nudge_ready.png' });
  // the real server still thinks only seconds passed, so it refuses and the page goes back to counting
  await p.click('#nudgeBtn'); await p.waitForTimeout(400);
  console.log('real server says "too soon" -> page counts again:', (await p.textContent('#nudgeBtn')).trim().startsWith('ذكّره بعد'));
  // success path (server answer faked)
  await p.route('**/api/nudge', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await p.clock.fastForward('03:10'); await p.click('#nudgeBtn'); await p.waitForTimeout(300);
  console.log('after reminder:', (await p.textContent('#nudgeMsg')).trim(), '| button hidden:', await p.evaluate(() => document.getElementById('nudgeBtn').hidden));

  // --- reply-time line on the scan page (server answer faked: 3 min)
  const c2 = await b.newContext({ viewport: { width: 400, height: 860 } }); const q = await c2.newPage(); q.on('pageerror', (e) => errs.push(e.message));
  await q.route('**/api/car?t=*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nickname: 'تويوتا', paused: false, replyMinutes: 3 }) }));
  await q.goto('http://localhost:8788/c?t=' + token); await q.waitForSelector('#pick:not([hidden])');
  console.log('scan page shows:', (await q.textContent('#whoSub')).trim());

  // --- inbox: reminder badge (server answer faked)
  const c3 = await b.newContext({ viewport: { width: 400, height: 860 } }); const o = await c3.newPage(); o.on('pageerror', (e) => errs.push(e.message));
  const now = Math.floor(Date.now() / 1000);
  await o.route('**/api/inbox', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ car: { id: token, name: 'أحمد الخطيب', nickname: 'تويوتا', paused: false }, messages: [{ id: 'm1', kind: 'block', reply: null, created_at: now - 400, replied_at: null }, { id: 'n1', kind: 'nudge:m1', reply: null, created_at: now - 100, replied_at: null }] }) }));
  await o.goto('http://localhost:8788/inbox.html?demo=enabled#' + key); await o.waitForSelector('.thread');
  console.log('threads shown:', await o.locator('.thread').count(), '(the reminder is not a separate message) | badges:', (await o.locator('.badge-new').allTextContents()).join(' + '), '| title:', await o.title());
  await o.screenshot({ path: OUT + '/inbox_nudge.png' });
  console.log('errs', errs); await b.close();
})();
