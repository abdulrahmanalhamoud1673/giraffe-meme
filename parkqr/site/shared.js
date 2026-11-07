const MSG = {
  block:  'سيارتك مسكّرة عليّ، ممكن تحرّكها؟',
  urgent: 'أنا مستعجل، رجاءً بأسرع وقت',
  lights: 'الأضواء شغالة',
  open:   'الشباك أو الصندوق مفتوح',
  fault:  'في إشي غلط بسيارتك (دولاب منفّس / تسريب)',
  hit:    'سيارتك تتحرك أو تعرضت لضربة',
  thanks: 'شكراً، حرّكتها',
};
const REPLY = {
  '2': 'جاي خلال دقيقتين',
  '5': 'جاي خلال 5 دقائق',
  '10': 'جاي خلال 10 دقائق',
  cant: 'ما بقدر الآن، رجاءً استنى',
};
async function api(path, opts = {}) {
  const r = await fetch('/api' + path, opts);
  let data = {};
  try { data = await r.json(); } catch (_) {}
  if (!r.ok) { const e = new Error(data.error || 'error'); e.code = data.error; e.status = r.status; throw e; }
  return data;
}
function ago(ts) {
  const m = Math.max(0, Math.round((Date.now() / 1000 - ts) / 60));
  if (m < 1) return 'الآن';
  if (m < 60) return 'قبل ' + m + ' دقيقة';
  const h = Math.round(m / 60);
  return h < 24 ? 'قبل ' + h + ' ساعة' : 'قبل ' + Math.round(h / 24) + ' يوم';
}
function scanUrl(token) {
  return window.SCAN_URL ? window.SCAN_URL(token) : location.origin + '/c/' + token;
}
function qrSvg(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 2; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
  return '<svg viewBox="0 0 ' + (n + 2 * m) + ' ' + (n + 2 * m) + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#15120f"/></svg>';
}
