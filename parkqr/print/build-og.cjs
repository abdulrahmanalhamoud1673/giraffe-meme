// Builds the link-preview image (1200x630) shown when the site is shared on WhatsApp etc.  node build-og.cjs
const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const qrcode = require(process.env.QR_LIB || 'qrcode-generator');
const q = qrcode(0, 'Q'); q.addData('https://yanashmi.com'); q.make();
const n = q.getModuleCount(), m = 3; let d = '';
for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
const qr = `<svg viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@500;700&family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}html,body{margin:0}
.c{position:relative;width:1200px;height:630px;overflow:hidden;color:#f4efe6;font-family:'IBM Plex Sans Arabic',sans-serif;
 background:radial-gradient(60% 70% at 85% 105%,rgba(217,43,69,.4),transparent 70%),radial-gradient(45% 40% at 10% 110%,rgba(212,171,92,.22),transparent 70%),linear-gradient(180deg,#06080a 0%,#0c1311 55%,#26140e 100%)}
.band{position:absolute;inset-inline:0;top:0;height:34px;background:conic-gradient(#d92b45 25%,#0b0d0c 0 50%,#d92b45 0 75%,#0b0d0c 0) 0 0/17px 17px}
.band.b{top:auto;bottom:0}
.pat{position:absolute;inset:0;opacity:.9;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='110' height='110' viewBox='0 0 88 88'%3E%3Cg fill='none' stroke='%23d4ab5c' stroke-width='1' opacity='.16'%3E%3Crect x='22' y='22' width='44' height='44'/%3E%3Crect x='22' y='22' width='44' height='44' transform='rotate(45 44 44)'/%3E%3C/g%3E%3C/svg%3E");-webkit-mask-image:radial-gradient(70% 80% at 70% 40%,#000,transparent 85%)}
.dunes{position:absolute;left:0;right:0;bottom:34px;width:100%;height:110px}
.txt{position:absolute;right:80px;top:92px;width:660px}
.k{display:flex;align-items:center;gap:14px;color:#d4ab5c;font-weight:600;font-size:26px}
.k i{width:44px;height:2px;background:#d4ab5c}
h1{font-family:'Reem Kufi',sans-serif;font-weight:700;font-size:100px;line-height:1.12;margin:14px 0 0}
h1 em{font-style:normal;color:#3fd193}
p{font-size:29px;line-height:1.6;color:#c9c1b2;margin:18px 0 0;max-width:620px}
.sticker{position:absolute;left:100px;top:84px;width:290px;background:#fff;color:#15120f;padding:16px;border-radius:14px;transform:rotate(5deg);box-shadow:0 40px 70px -20px #000}
.sticker .e{height:16px;margin:-16px -16px 14px;border-radius:14px 14px 0 0;background:conic-gradient(#b3122a 25%,#fff 0 50%,#b3122a 0 75%,#fff 0) 0 0/8px 8px}
.sticker svg{width:100%;height:auto;display:block}
.sticker b{display:block;text-align:center;font-family:'Reem Kufi',sans-serif;font-size:34px;margin-top:10px}
.url{position:absolute;left:112px;bottom:78px;direction:ltr;font-weight:600;font-size:34px;background:#f4efe6;color:#15120f;border-radius:99px;padding:8px 30px}
</style></head><body><div class="c">
<div class="pat"></div>
<svg class="dunes" viewBox="0 0 1200 150" preserveAspectRatio="none"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a3d2c"/><stop offset="1" stop-color="#2a1510"/></linearGradient></defs><path d="M0 70C140 30 260 95 420 60C580 25 700 85 860 55C1020 25 1120 70 1200 45V150H0Z" fill="url(#a)" opacity=".85"/></svg>
<div class="band"></div><div class="band b"></div>
<div class="txt"><div class="k"><i></i>فكرة أردنية جديدة</div><h1>يا نشمي،<br><em>حرّك</em> سيارتك.</h1><p>ستيكر QR على زجاج سيارتك. اللي مسكّر عليك يرسلك رسالة جاهزة، ورقمك يظل عندك.</p></div>
<div class="sticker"><div class="e"></div>${qr}<b>يا نشمي</b></div>
<div class="url">yanashmi.com</div>
</div></body></html>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(html, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
  const out = process.argv[2] || path.join(__dirname, '..', 'site', 'og.png');
  await p.screenshot({ path: out }); console.log('wrote', out); await b.close();
})();
