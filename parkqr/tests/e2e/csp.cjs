// The strict security policy must not break any page or feature: no violations, no console errors.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', ...(process.env.FAKE_CAM ? ['--use-file-for-fake-video-capture=' + process.env.FAKE_CAM] : [])] });
  const issues = [];
  const watch = (p, tag) => {
    p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource.*(fonts|404|401|403|429)/.test(t) && !/net::ERR_(NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|CONNECTION|BLOCKED)/.test(t)) issues.push(tag + ': ' + t.slice(0, 160)); });
    p.on('pageerror', (e) => issues.push(tag + ' pageerror: ' + e.message));
    p.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error('CSP VIOLATION ' + e.violatedDirective + ' ' + e.blockedURI)));
  };
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, permissions: ['camera'] });
  const r = await ctx.newPage(); watch(r, 'register');
  await r.goto('http://localhost:8788/register.html');
  await r.fill('#first', 'خالد'); await r.fill('#last', 'العمري'); await r.fill('#phone', '0788' + String(Math.floor(100000 + Math.random() * 899999)));
  await r.evaluate(() => { const c = document.querySelector('#consent'); if (c && !c.checked) c.click(); });
  await r.click('button[type=submit]'); await r.waitForSelector('#doneView:not([hidden])');
  const { token, key } = await r.evaluate(() => window.__reg);
  for (const [name, url] of [['home', '/'], ['privacy', '/privacy.html'], ['survey', '/survey.html'], ['delete', '/delete-account.html'], ['results', '/results.html'], ['404', '/nope']]) {
    const p = await ctx.newPage(); watch(p, name); await p.goto('http://localhost:8788' + url); await p.waitForTimeout(500); await p.close();
  }
  const s = await ctx.newPage(); watch(s, 'scan'); await s.goto('http://localhost:8788/c?t=' + token); await s.waitForSelector('#pick:not([hidden])');
  await s.click('#noteToggle'); await s.fill('#noteIn', 'عند المدخل');
  await s.locator('.opt', { hasText: 'تسريب' }).click(); await s.waitForFunction(() => document.getElementById('vid').videoWidth > 0);
  await s.click('#snap'); await s.click('#sendPhoto'); await s.waitForSelector('#sent:not([hidden])');
  const o = await ctx.newPage(); watch(o, 'inbox'); await o.goto('http://localhost:8788/inbox.html#' + key); await o.waitForSelector('.shotThumb');
  await o.waitForFunction(() => { const i = document.querySelector('.shotThumb'); return i && i.complete && i.naturalWidth > 0; });
  console.log('photo (blob image) shows under the policy: true');
  const nk = await ctx.newPage(); watch(nk, 'nokey'); await nk.addInitScript(() => localStorage.clear()); await nk.goto('http://localhost:8788/inbox.html'); await nk.waitForSelector('#keyIn');
  await nk.fill('#keyIn', 'https://yanashmi.com/inbox.html#' + key); await nk.click('#keyGo'); await nk.waitForSelector('.thread', { timeout: 8000 });
  console.log('pasting the inbox link opens the inbox: true');
  // delete the account from the delete page
  const d = await ctx.newPage(); watch(d, 'delete'); d.on('dialog', (x) => x.accept()); await d.goto('http://localhost:8788/delete-account.html');
  await d.fill('#keyIn', 'https://yanashmi.com/inbox.html#' + key); await d.click('#go'); await d.waitForFunction(() => document.getElementById('msg').textContent.includes('انحذف'));
  console.log('account deleted from the page: true');
  const chk = await d.evaluate(async (t) => (await fetch('/api/car?t=' + t)).status, token); console.log('the QR of the deleted account now answers:', chk);
  console.log('issues:', JSON.stringify(issues, null, 1)); await b.close();
})();
