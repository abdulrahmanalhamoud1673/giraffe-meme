// Register -> "save image" -> a preview sheet with a real download link -> the downloaded file is a valid 800x1000 PNG.
const OUT = process.argv[2] || require('os').tmpdir();
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 400, height: 860 }, acceptDownloads: true });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8788/register.html');
  await p.fill('#first', 'أحمد'); await p.fill('#last', 'الخطيب'); await p.fill('#phone', '0788' + String(Math.floor(100000 + Math.random() * 899999))); await p.check('#consent'); await p.click('#btn');
  await p.waitForSelector('#doneView:not([hidden])');
  await p.click('#pngBtn'); await p.waitForSelector('#saveSheet:not([hidden])');
  await p.waitForFunction(() => document.getElementById('saveImg').complete && document.getElementById('saveImg').naturalWidth > 0);
  const dim = await p.evaluate(() => [document.getElementById('saveImg').naturalWidth, document.getElementById('saveImg').naturalHeight]);
  console.log('preview image size:', dim.join('x'));
  await p.screenshot({ path: path.join(OUT, 'save_sheet.png') });
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), p.click('#saveLink')]);
  const file = path.join(OUT, 'downloaded-sticker.png'); await dl.saveAs(file);
  const png = fs.readFileSync(file);
  console.log('downloaded:', dl.suggestedFilename(), '| PNG signature ok:', png.slice(1, 4).toString() === 'PNG', '| size:', png.readUInt32BE(16) + 'x' + png.readUInt32BE(20));
  await p.click('#saveClose'); console.log('sheet closes:', await p.evaluate(() => document.getElementById('saveSheet').hidden));
  console.log('errs', errs); await b.close();
})();
