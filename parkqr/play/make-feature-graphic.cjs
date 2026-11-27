// Google Play feature graphic 1024x500.  NODE_PATH=$(npm root -g) QR_LIB=<qrcode-generator> node make-feature-graphic.cjs
const { chromium } = require('playwright'); const qrcode = require(process.env.QR_LIB || 'qrcode-generator'); const path = require('path');
const q = qrcode(0, 'Q'); q.addData('https://yanashmi.com'); q.make(); const n = q.getModuleCount(); let d = '';
for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 3} ${r + 3}h1v1h-1z`;
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;800&family=IBM+Plex+Sans+Arabic:wght@500;600&display=swap" rel="stylesheet">
<style>*{margin:0;box-sizing:border-box}body{width:1024px;height:500px;overflow:hidden;background:radial-gradient(120% 90% at 20% 100%,#2a1410,#0b0d0c 65%);color:#f4efe6;font-family:'IBM Plex Sans Arabic';position:relative}
.band{position:absolute;left:0;right:0;height:16px;background:conic-gradient(#d92b45 25%,#0b0d0c 0 50%,#d92b45 0 75%,#0b0d0c 0) 0 0/8px 8px}
h1{font-family:Cairo;font-weight:800;font-size:76px;line-height:1.2;position:absolute;right:70px;top:110px}h1 em{font-style:normal;color:#3fd193}
p{position:absolute;right:70px;top:350px;font-size:30px;color:#c9c1b2}
.logo{position:absolute;right:70px;top:48px;font-family:Cairo;font-weight:800;font-size:34px;color:#d4ab5c}
.st{position:absolute;left:80px;top:90px;width:260px;background:#fff;border-radius:18px;padding:16px;transform:rotate(-6deg);box-shadow:0 24px 50px #000a}
.st svg{width:100%;display:block}.st b{display:block;text-align:center;color:#15120f;font-family:Cairo;font-size:28px;margin-top:6px}
.st:before{content:'';position:absolute;left:0;right:0;top:0;height:14px;border-radius:18px 18px 0 0;background:conic-gradient(#b3122a 25%,#fff 0 50%,#b3122a 0 75%,#fff 0) 0 0/10px 10px}</style></head>
<body><div class="band" style="top:0"></div><div class="band" style="bottom:0"></div>
<div class="logo">يا نشمي</div><h1>حدا مسكّر عليك؟<br><em>ابعتله</em> بثواني.</h1><p>رقمك مخفي. بدون تطبيق للي بيمسح.</p>
<div class="st"><svg viewBox="0 0 ${n + 6} ${n + 6}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#15120f"/></svg><b>يا نشمي</b></div></body></html>`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1024, height: 500 } }); await p.setContent(html, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(__dirname, 'assets', 'feature-graphic-1024x500.png') }); await b.close(); console.log('ok'); })();
