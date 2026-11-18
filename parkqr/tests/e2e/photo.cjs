// Live-camera photo for problem reports: camera step, no gallery, owner sees the picture, denied camera blocks sending.
const OUT = process.argv[2] || require('os').tmpdir();
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', ...(process.env.FAKE_CAM ? ['--use-file-for-fake-video-capture=' + process.env.FAKE_CAM] : [])] }); const errs = [];
  const reg = await (await b.newContext()).newPage();
  await reg.goto('http://localhost:8788/register.html');
  await reg.fill('#first', 'خالد'); await reg.fill('#last', 'العمري'); await reg.fill('#phone', '0788' + String(Math.floor(100000 + Math.random() * 899999)));
  await reg.evaluate(() => { const c = document.querySelector('#consent'); if (c && !c.checked) c.click(); });
  await reg.click('button[type=submit]'); await reg.waitForSelector('#doneView:not([hidden])');
  const { token, key } = await reg.evaluate(() => window.__reg);

  const c = await b.newContext({ viewport: { width: 400, height: 860 }, permissions: ['camera'] }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8788/c?t=' + token); await p.waitForSelector('#pick:not([hidden])');
  console.log('file pickers on the page:', await p.locator('input[type=file]').count());
  const labels = await p.locator('.opt').allTextContents();
  console.log('options marked "with photo":', labels.filter((t) => t.includes('بصورة')).length, 'of', labels.length);
  await p.locator('.opt', { hasText: 'تسريب' }).click();
  await p.waitForSelector('#cam:not([hidden])');
  await p.waitForFunction(() => document.getElementById('vid').videoWidth > 0);
  console.log('camera step open, send button hidden until a photo is taken:', await p.isHidden('#sendPhoto'));
  await p.click('#snap'); await p.waitForTimeout(300);
  console.log('after snap: preview shown', await p.isVisible('#shot'), '| send visible', await p.isVisible('#sendPhoto'), '| retake visible', await p.isVisible('#retake'));
  const len = await p.evaluate(() => window.__photo.length); console.log('photo data url size KB:', Math.round(len / 1024), '| jpeg:', await p.evaluate(() => window.__photo.startsWith('data:image/jpeg')));
  await p.screenshot({ path: OUT + '/photo_preview.png' });
  await p.click('#sendPhoto'); await p.waitForSelector('#sent:not([hidden])');
  console.log('sent. camera stopped:', await p.evaluate(() => !document.getElementById('vid').srcObject || document.getElementById('vid').srcObject.getTracks().every((t) => t.readyState === 'ended')));

  // owner sees the picture
  const o = await (await b.newContext({ viewport: { width: 400, height: 860 } })).newPage(); o.on('pageerror', (e) => errs.push(e.message));
  await o.goto('http://localhost:8788/inbox.html#' + key); await o.waitForSelector('.thread');
  await o.waitForFunction(() => { const i = document.querySelector('.shotThumb'); return i && i.complete && i.naturalWidth > 0; });
  console.log('inbox shows photo thumbnail:', await o.locator('.shotThumb').count());
  await o.screenshot({ path: OUT + '/photo_inbox.png' });

  // camera refused: cannot send a problem report, and there is no other way to attach a picture
  const c2 = await b.newContext({ viewport: { width: 400, height: 860 } }); const q = await c2.newPage();
  await q.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })); });
  await q.goto('http://localhost:8788/c?t=' + token); await q.waitForSelector('#pick:not([hidden])');
  await q.locator('.opt', { hasText: 'تسريب' }).click(); await q.waitForSelector('#cam:not([hidden])'); await q.waitForTimeout(300);
  console.log('camera denied message:', (await q.textContent('#camErr')).trim().slice(0, 60), '| snap hidden:', await q.isHidden('#snap'), '| send hidden:', await q.isHidden('#sendPhoto'));
  // a simple message still goes through without a photo
  await q.click('#camBack'); await q.locator('.opt', { hasText: 'مسكّرة' }).first().click(); await q.waitForSelector('#sent:not([hidden])');
  console.log('simple message without photo works:', true);
  console.log('errs', errs); await b.close();
})();
