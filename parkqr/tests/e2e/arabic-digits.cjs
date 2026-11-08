// The phone field on an Arabic keyboard: digits arrive as ٠١٢٣... and must work and be shown as 0-9.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 400, height: 860 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8788/register.html');
  await p.fill('#first', 'أحمد'); await p.fill('#last', 'الخطيب');
  const digits = '٠٧٨٨' + [...String(Math.floor(100000 + Math.random() * 899999))].map((d) => '٠١٢٣٤٥٦٧٨٩'[d]).join('');
  await p.focus('#phone'); await p.keyboard.type(digits);           // real key events, like the phone keypad
  console.log('typed (Arabic digits):', digits, '| field now shows:', await p.inputValue('#phone'));
  await p.check('#consent'); await p.click('#btn');
  await p.waitForSelector('#doneView:not([hidden])', { timeout: 5000 });
  console.log('registered ok with an Arabic-digit number | errs', errs);
  await b.close();
})();
