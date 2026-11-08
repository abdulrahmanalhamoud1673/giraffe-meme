// Windshield flyer: 4 per A4, cut along the dashed lines.  node build-flyer.cjs [url] [outDir]
const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const qrcode = require(process.env.QR_LIB || 'qrcode-generator');
const URL = process.argv[2] || 'https://yanashmi.com/register?s=car';
const OUT = process.argv[3] || __dirname;
function qrSvg(text) {
  const q = qrcode(0, 'Q'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 4; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
const star = '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="14" height="14"/><rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)"/></g></svg>';
const ticks = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 13l4 4 8-9"/><path d="M10 15l2 2 9-10"/></svg>';
const lock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
const qr = qrSvg(URL);
const card = `<div class="card"><div class="band"></div><div class="pat"></div><div class="body">
<div class="top"><div class="logo">${star}يا نشمي</div><div class="stamp">مش مخالفة!</div></div>
<div class="k"><i></i>لصاحب هالسيارة</div>
<h1>حدا سكّر<br><em>عليك؟</em></h1>
<div class="sub">خلّيه يبعتلك رسالة، مش يزمّر.</div>
<div class="chat"><div class="b1">سيارتك مسكّرة عليّ، ممكن تحرّكها؟</div><div class="b2">جاي خلال دقيقتين ${ticks}</div><div class="hid">${lock}رقمك ما بيظهر لأي حدا</div></div>
<div class="stub"></div>
<div class="low"><div class="qr">${qr}</div><div class="t"><div class="cta">امسح وسجّل<br>سيارتك</div><div class="url">yanashmi.com</div><div class="free">بدون تطبيق · التجربة مجانية</div></div></div>
</div><div class="band b"></div></div>`;
(async () => {
  const html = fs.readFileSync(path.join(__dirname, 'flyer.template.html'), 'utf8').replace('__CARDS__', Array(4).fill(card).join('\n'));
  const name = 'yanashmi-car-flyer-A4';
  fs.writeFileSync(path.join(OUT, name + '.html'), html);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(OUT, name + '.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const fit = await p.evaluate(() => [...document.querySelectorAll('.card')].map((c) => { const b = c.querySelector('.body'); const low = c.querySelector('.low').getBoundingClientRect(); const cb = c.querySelector('.band.b').getBoundingClientRect(); return [Math.round(b.scrollHeight - b.clientHeight), Math.round((cb.top - low.bottom) * 10) / 10]; }));
  console.log('per card [overflow px (must be <= 0), space under QR block px]:', JSON.stringify(fit));
  await p.pdf({ path: path.join(OUT, name + '.pdf'), width: '210mm', height: '297mm', printBackground: true, preferCSSPageSize: true });
  await p.screenshot({ path: path.join(OUT, name + '.png') });
  await b.close(); console.log('built', name);
})();
