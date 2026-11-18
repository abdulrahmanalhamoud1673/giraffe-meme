// Vertical promo video (1080x1920, ~26s): motion graphics, no footage, no voice (captions only).
//   QR_LIB=<path to qrcode-generator> NODE_PATH=$(npm root -g) node build-video.cjs [outDir]
// Renders frames with Playwright, then ffmpeg -> yanashmi-reel.mp4
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const { chromium } = require('playwright');
const qrcode = require(process.env.QR_LIB || 'qrcode-generator');
const OUT = process.argv[2] || __dirname;
const FPS = 30, DUR = 26;

function qrSvg(text) {
  const q = qrcode(0, 'Q'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 3; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#15120f"/></svg>`;
}
const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const lock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';

const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@500;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:540px;height:960px;overflow:hidden;background:#0b0d0c;font-family:'IBM Plex Sans Arabic',sans-serif;color:#f4efe6}
.stage{position:absolute;inset:0;overflow:hidden}
.bg{position:absolute;inset:0;transition:none}
.a{position:absolute;opacity:0;will-change:opacity,transform}
.center{left:0;right:0;text-align:center;padding:0 34px}
.k{font-family:'Reem Kufi',sans-serif;font-weight:700}
.big{font-size:60px;line-height:1.25}
.mid{font-size:34px;line-height:1.5;color:#c9c1b2}
.green{color:#3fd193}.red{color:#ff4d68}.gold{color:#d4ab5c}
.band{position:absolute;left:0;right:0;height:14px;background:conic-gradient(#d92b45 25%,#0b0d0c 0 50%,#d92b45 0 75%,#0b0d0c 0) 0 0/7px 7px}
.glass{left:36px;right:36px;top:250px;height:330px;border-radius:26px;background:linear-gradient(160deg,#3a4a52,#1b2429 70%);border:2px solid #56666e;overflow:hidden}
.note{left:90px;right:90px;top:330px;background:#fbf7ea;color:#15120f;border-radius:6px;padding:26px 20px;text-align:center;transform-origin:50% 0;box-shadow:0 14px 30px #0008}
.note b{display:block;font-size:42px;letter-spacing:1px;direction:ltr;font-family:'IBM Plex Sans Arabic'}
.note small{font-size:20px;color:#7a7365}
.who{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.who span{font-size:24px;border:1.5px solid #ff4d68;color:#ff8b9d;border-radius:99px;padding:6px 18px}
.phone{left:90px;right:90px;top:120px;height:640px;border-radius:44px;background:#101412;border:3px solid #2c3a33;box-shadow:0 30px 60px #000a;overflow:hidden}
.phone .hd{padding:26px 24px 14px;font-family:'Reem Kufi';font-size:28px;border-bottom:1px solid #25302a;display:flex;justify-content:space-between;align-items:center}
.pill{font-family:'IBM Plex Sans Arabic';font-size:15px;color:#3fd193;border:1px solid #3fd193;border-radius:99px;padding:3px 12px;display:inline-flex;gap:6px;align-items:center}
.pill svg{width:14px;height:14px}
.bub{max-width:78%;padding:14px 18px;border-radius:18px;font-size:23px;line-height:1.5;position:absolute}
.me{background:#1c2a24;right:20px;border-bottom-right-radius:4px}
.him{background:#3fd193;color:#04241a;left:20px;border-bottom-left-radius:4px;font-weight:600}
.row{display:flex;align-items:center;gap:18px;font-size:42px;font-family:'Reem Kufi';font-weight:700}
.row i{width:58px;height:58px;border-radius:50%;background:#3fd193;color:#04241a;display:grid;place-items:center;flex:none}
.row i svg{width:32px;height:32px}
.qrbox{left:50%;width:380px;height:380px;margin-left:-190px;top:330px;background:#fff;border-radius:22px;padding:18px;box-shadow:0 0 0 10px #3fd19333,0 30px 60px #000a}
.qrbox svg{width:100%;height:100%;display:block}
.url{direction:ltr;display:inline-block;background:#f4efe6;color:#15120f;border-radius:99px;padding:8px 36px;font-weight:600;font-size:38px}
.logo{font-family:'Reem Kufi';font-weight:700;font-size:40px;color:#f4efe6}
</style></head><body><div class="stage" id="st">
<div class="bg" id="bg"></div>

<!-- 1: the problem -->
<div class="a glass" data-a="0.0" data-b="6.4"></div>
<div class="a note" data-a="0.5" data-b="6.4" data-from="down"><small>ورقة على الزجاج</small><b>079 555 1234</b></div>
<div class="a center k big" style="top:130px" data-a="0.2" data-b="3.6">رقمك على الزجاج…</div>
<div class="a center k big red" style="top:130px" data-a="3.7" data-b="6.4">لكل الناس.</div>
<div class="a center who" style="top:640px" data-a="2.6" data-b="6.4"><span>السايس</span><span>صاحب البقالة</span><span>أي حدا بيمرّ</span></div>
<div class="a center mid" style="top:780px" data-a="4.2" data-b="6.4">والمزعج بيعرف رقمك.</div>

<!-- 2: the fix -->
<div class="a center" style="top:360px" data-a="6.6" data-b="10.4"><div class="logo" style="font-size:96px">يا نشمي</div><div class="k big green" style="margin-top:24px">ستيكر QR<br>على الزجاج</div></div>
<div class="a center mid" style="top:760px" data-a="7.6" data-b="10.4">وين رقمك؟ ما حدا بيشوفه.</div>

<!-- 3: the chat -->
<div class="a phone" data-a="10.6" data-b="16.6" data-from="up">
  <div class="hd"><span>رسالة جديدة</span><span class="pill">${lock}رقمك مخفي</span></div>
  <div class="a bub me" style="top:110px" data-a="11.6" data-b="99">سيارتك مسكّرة عليّ، ممكن تحرّكها؟</div>
  <div class="a bub him" style="top:260px" data-a="13.8" data-b="99">جاي خلال دقيقتين</div>
</div>
<div class="a center mid" style="top:800px" data-a="11.0" data-b="14.0">اللي مسكّر عليك بيمسح الكود…</div>
<div class="a center mid green" style="top:800px" data-a="14.1" data-b="16.6">وبتردّ عليه بضغطة.</div>

<!-- 4: benefits -->
<div class="a" style="left:80px;top:430px" data-a="16.8" data-b="21.0"><div class="row"><i>${check}</i>بدون تطبيق</div></div>
<div class="a" style="left:80px;top:540px" data-a="17.6" data-b="21.0"><div class="row"><i>${check}</i>رقمك مخفي</div></div>
<div class="a" style="left:80px;top:650px" data-a="18.4" data-b="21.0"><div class="row"><i>${check}</i>التجربة مجانية</div></div>
<div class="a center k big" style="top:190px" data-a="16.8" data-b="21.0">جرّبه <span class="green">مجاناً</span></div>

<!-- 5: call to action -->
<div class="a center k big" style="top:130px" data-a="21.2" data-b="99">سجّل سيارتك<br><span class="green">بدقيقة</span></div>
<div class="a qrbox" data-a="21.6" data-b="99">__QR__</div>
<div class="a center" style="top:760px" data-a="22.2" data-b="99"><span class="url">yanashmi.com</span></div>
<div class="a center mid" style="top:850px" data-a="23.0" data-b="99">الرابط بالبايو</div>

<div class="band" style="top:0"></div><div class="band" style="bottom:0"></div>
</div>
<script>
const ease=x=>1-Math.pow(1-Math.min(1,Math.max(0,x)),3);
const els=[...document.querySelectorAll('[data-a]')];
// background: dark -> green tint -> dark, one slow gradient that follows the story
function bg(t){
  const sec=t<6.5?0:t<10.5?1:t<16.7?2:t<21?3:4;
  const c=[['#0b0d0c','#2a1014'],['#0b0d0c','#0f2a20'],['#0b0d0c','#10211a'],['#0b0d0c','#142a20'],['#0b0d0c','#0f2a20']][sec];
  document.getElementById('bg').style.background='radial-gradient(120% 70% at 50% 100%,'+c[1]+' 0%,'+c[0]+' 70%)';
}
window.setTime=t=>{
  bg(t);
  for(const e of els){
    const a=+e.dataset.a,b=+e.dataset.b,i=ease((t-a)/0.5),o=1-ease((t-b)/0.35);
    const op=Math.min(i,o);e.style.opacity=op;
    const dy=e.dataset.from==='up'?60:e.dataset.from==='down'?-50:34;
    const sc=e.classList.contains('bub')||e.classList.contains('qrbox')?0.92+0.08*i:1;
    e.style.transform='translateY('+(dy*(1-i)+(1-o)*-20)+'px) scale('+sc+')';
  }
};
</script></body></html>`.replace('__QR__', qrSvg('https://yanashmi.com/register?s=reel'));

(async () => {
  const frames = path.join(OUT, '.frames'); fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
  const n = DUR * FPS;
  for (let i = 0; i < n; i++) {
    await p.evaluate(t => window.setTime(t), i / FPS);
    await p.screenshot({ path: path.join(frames, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 92 });
  }
  await b.close();
  const mp4 = path.join(OUT, 'yanashmi-reel.mp4');
  execSync(`ffmpeg -y -v error -framerate ${FPS} -i "${frames}/%04d.jpg" -f lavfi -i anullsrc=r=44100:cl=stereo -shortest -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart -c:a aac "${mp4}"`);
  fs.rmSync(frames, { recursive: true, force: true });
  console.log('done', mp4);
})();
