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

const SV = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const ICON = {
  block:  SV('<path d="M5 16v-5l2-4.5A2 2 0 018.8 5h6.4A2 2 0 0117 6.5L19 11v5"/><path d="M3 16h18v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-1H7v1a1 1 0 01-1 1H4a1 1 0 01-1-1z"/><path d="M5 11h14"/>'),
  urgent: SV('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  lights: SV('<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0012 3z"/>'),
  open:   SV('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>'),
  fault:  SV('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>'),
  hit:    SV('<path d="M12 2l2.2 5.3L20 6l-2 5.2L22 14l-5.5 1L15 21l-3-4-3 4-1.5-6L2 14l4-2.8L4 6l5.8 1.3z"/>'),
  thanks: SV('<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>'),
  check:  SV('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  user:   SV('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>'),
  inbox:  SV('<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>'),
  lock:   SV('<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
  print:  SV('<path d="M7 9V4h10v5M7 17H5a1 1 0 01-1-1v-5a2 2 0 012-2h12a2 2 0 012 2v5a1 1 0 01-1 1h-2"/><rect x="7" y="14" width="10" height="6"/>'),
};
const GROUPS = [
  ['مسكّر عليك؟', ['block', 'urgent']],
  ['شفت شي بسيارتك؟', ['lights', 'open', 'fault', 'hit']],
  ['بعد ما يحرّكها', ['thanks']],
];
async function api(path, opts = {}) {
  const r = await fetch('/api' + path, opts);
  let data = {};
  try { data = await r.json(); } catch (_) {}
  if (!r.ok) { const e = new Error(data.error || 'error'); e.code = data.error; e.status = r.status; e.detail = data.detail || ''; throw e; }
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
  return window.SCAN_URL ? window.SCAN_URL(token) : location.origin + '/c?t=' + token;
}
function qrSvg(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 2; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
  return '<svg viewBox="0 0 ' + (n + 2 * m) + ' ' + (n + 2 * m) + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#15120f"/></svg>';
}
