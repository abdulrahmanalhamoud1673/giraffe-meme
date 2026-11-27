// Optional note: normal sentences pass; insults, flirting, contact details, links and tricks are rejected.
import { SITE_URL, SITE, makeDb } from '../helpers.mjs';
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; else console.log('FAIL', name); };
const { checkNote } = await import(SITE_URL + 'functions/api/_notefilter.js');
const bad = ['يا كلب', 'انت حمااار', 'ك ل ب', 'ك.ل.ب', 'ك_ل_ب', 'كلللب', 'يا ابن الكلب', 'ابن ال كلب', 'حلوة سيارتك', 'بحبك', 'رقمك شو؟', 'واتساب', 'ارسلي واتس', '0795551234', '٠٧٩٥٥٥١٢٣٤', '079 555 12 34', 'http://x.com', 'www.site', 'abc@x', 'fuck you', 'f u c k', 'يلعن', 'كسمك', 'اقتلك', 'سناب', 'تعارف', 'يا شرموطه', 'ش.ر.م.و.ط', 'انت غبي', 'يا حيوان', 'يا حمار', 'ي ا ك ل ب', 'x'.repeat(81)];
const good = ['عند مدخل العمارة', 'الشباك مفتوح من الجهة اليسار', 'سيارتك مسكرة على الباب الخلفي', 'الأضواء شغالة وانا واقف قدام المحل', 'اسف على الازعاج', 'عمارة رقم 5 الطابق الثاني', 'الكلاب في الشارع', 'حلو الجو اليوم', 'تويوتا بيضاء قدام البقالة', 'شكرا كتير', 'الحمدلله', 'قدام الكراج دقيقتين بس', 'الدولاب الأمامي منفّس', 'بالمرسيدس الفضية', ''];
for (const t of bad) check('rejected: ' + t.slice(0, 20), checkNote(t).ok === false);
for (const t of good) check('allowed: ' + t.slice(0, 20), checkNote(t).ok === true);
check('note is trimmed and spaces squeezed', checkNote('  عند   المدخل ').note === 'عند المدخل');

const REG = await import(SITE_URL + 'functions/api/register.js'), SEND = await import(SITE_URL + 'functions/api/send.js'), INBOX = await import(SITE_URL + 'functions/api/inbox.js');
const { DB, db } = makeDb(); const env = { DB, SALT: 's' };
const req = (body, ip, h = {}) => new Request('http://x/', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...h }, body: JSON.stringify(body) });
const reg = await (await REG.onRequestPost({ request: req({ name: 'أحمد الخطيب', phone: '0795551234', consent: true }, '3.3.3.3'), env })).json();
const send = async (note, ip) => { const r = await SEND.onRequestPost({ request: req({ token: reg.token, kind: 'block', note }, ip), env }); return [r.status, await r.json()]; };
let [s, j] = await send('يا كلب', '4.4.4.4'); check('API: bad note refused (422 note_rejected)', s === 422 && j.error === 'note_rejected');
check('API: nothing stored', db.prepare('SELECT COUNT(*) n FROM messages').get().n === 0);
[s, j] = await send('عند مدخل العمارة', '4.4.4.5'); check('API: good note accepted', s === 200);
[s, j] = await new Promise(async (res) => { const r = await SEND.onRequestPost({ request: req({ token: reg.token, kind: 'block' }, '4.4.4.6'), env }); res([r.status, await r.json()]); }); check('API: no note is fine', s === 200);
const inbox = await (await INBOX.onRequestGet({ request: new Request('http://x/', { headers: { authorization: 'Bearer ' + reg.owner_key } }), env })).json();
check('owner sees the note', inbox.messages.some((m) => m.note === 'عند مدخل العمارة') && inbox.messages.some((m) => m.note === null));
console.log(ok + '/' + n); process.exit(ok === n ? 0 : 1);
