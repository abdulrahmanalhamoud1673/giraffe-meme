// After registering: pick area + price, tap "I am interested", see it counted in the admin numbers, and it is remembered on reload.
const OUT = process.argv[2] || require('os').tmpdir();
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 400, height: 900 } }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8788/register.html');
  await p.fill('#first', 'سارة'); await p.fill('#last', 'المومني'); await p.fill('#phone', '0788' + String(Math.floor(100000 + Math.random() * 899999))); await p.check('#consent'); await p.click('#btn');
  await p.waitForSelector('#doneView:not([hidden])');
  console.log('button disabled until both are chosen:', await p.isDisabled('#wGo'));
  await p.click('#wArea button:has-text("عمّان")'); console.log('still disabled with only the area:', await p.isDisabled('#wGo'));
  await p.click('#wPrice button:has-text("3 دنانير")'); console.log('enabled with both:', !(await p.isDisabled('#wGo')));
  await p.locator('#want').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + '/interest_card.png', fullPage: true });
  await p.click('#wGo'); await p.waitForFunction(() => document.getElementById('wMsg').textContent.includes('سجّلنا'));
  console.log('confirmation:', (await p.textContent('#wMsg')).trim());
  const stats = await (await fetch('http://localhost:8788/api/results', { headers: { authorization: 'Bearer dev-admin-key-for-local-tests-0001' } })).json();
  console.log('admin numbers: interested =', stats.usage.interest.total, '| price 3:', stats.usage.interest.byPrice['3'], '| amman:', stats.usage.interest.byArea.amman);
  await p.reload(); await p.waitForSelector('#doneView:not([hidden])'); await p.waitForTimeout(500);
  console.log('after reload the choices are hidden (already answered):', await p.evaluate(() => document.getElementById('wGo').hidden));
  console.log('errs', errs); await b.close();
})();
