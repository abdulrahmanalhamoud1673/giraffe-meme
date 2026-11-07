// Builds the print files: node build.cjs  (needs: qrcode-generator, playwright)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const qrcode = require(process.env.QR_LIB || 'qrcode-generator');

const URL = process.argv[2] || 'https://yanashmi.com/register';
const OUT = process.argv[3] || __dirname;

function qrSvg(text, cls) {
  const q = qrcode(0, 'Q'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 4; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg class="${cls || 'qr'}" viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
const star = '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="14" height="14"/><rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)"/></g></svg>';
const card = `<div class="card"><div class="band"></div><div class="in"><div class="qr">${qrSvg(URL)}</div><div class="tx"><div class="k">مسكّر عليك؟ حرّك سيارتك</div><div class="n">${star}يا نشمي</div><div class="d">امسح الرمز وسجّل سيارتك. اللي مسكّر عليك بيرسلك رسالة جاهزة، ورقمك ما بيظهر لأي حدا.</div><div class="u">yanashmi.com</div></div></div></div>`;

(async () => {
  const poster = fs.readFileSync(path.join(__dirname, 'poster.template.html'), 'utf8').replace('__QR__', qrSvg(URL));
  const cards = fs.readFileSync(path.join(__dirname, 'cards.template.html'), 'utf8').replace('__CARDS__', Array(8).fill(card).join('\n'));
  const files = [['yanashmi-poster-A4', poster], ['yanashmi-cards-A4', cards]];
  const b = await chromium.launch();
  for (const [name, html] of files) {
    fs.writeFileSync(path.join(OUT, name + '.html'), html);
    const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
    await p.goto('file://' + path.join(OUT, name + '.html'), { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.pdf({ path: path.join(OUT, name + '.pdf'), width: '210mm', height: '297mm', printBackground: true, preferCSSPageSize: true });
    await p.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('built', name);
  }
  await b.close();
})();
