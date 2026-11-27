// Account deletion, request size caps, registration flood cap.
import { SITE_URL, SITE, makeDb, fakeJpeg, fakeAI } from '../helpers.mjs';
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; else console.log('FAIL', name); };
const REG = await import(SITE_URL + 'functions/api/register.js'), SEND = await import(SITE_URL + 'functions/api/send.js'), DEL = await import(SITE_URL + 'functions/api/inbox/delete.js'), BLOCK = await import(SITE_URL + 'functions/api/inbox/block.js'), SURVEY = await import(SITE_URL + 'functions/api/survey.js');
const { DB, db } = makeDb(); const env = { DB, SALT: 's', AI: fakeAI() };
const req = (body, ip, h = {}) => new Request('http://x/', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...h }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const reg = async (name, phone, ip) => (await (await REG.onRequestPost({ request: req({ name, phone, consent: true }, ip), env })).json());
const a = await reg('أحمد الخطيب', '0795551234', '1.1.1.1'); const b = await reg('سامي الحسن', '0788403917', '2.2.2.2');
const send = (t, kind, ip, extra = {}) => SEND.onRequestPost({ request: req({ token: t, kind, ...extra }, ip), env });
await send(a.token, 'fault', '5.5.5.1', { photo: fakeJpeg(), note: 'عند المدخل' }); await send(b.token, 'block', '5.5.5.2');
db.prepare("INSERT INTO push_subs (id,car_id,endpoint,p256dh,auth) VALUES ('p',?,'https://fcm.googleapis.com/x','k','a')").run(a.token);
const del = async (key) => (await DEL.onRequestPost({ request: req('{}', '9.9.9.9', key ? { authorization: 'Bearer ' + key } : {}), env })).status;
check('delete needs the owner key', await del(null) === 401);
check('delete with a wrong key', await del('x'.repeat(28)) === 401);
check('delete works', await del(a.owner_key) === 200);
const cnt = (t, col = 'car_id') => db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE ${col} = ?`).get(a.token).n;
check('car, messages, photos, notes, devices all gone', db.prepare('SELECT COUNT(*) n FROM cars WHERE id=?').get(a.token).n === 0 && cnt('messages') === 0 && cnt('photos') === 0 && cnt('notes') === 0 && cnt('push_subs') === 0);
check('the other account is untouched', db.prepare('SELECT COUNT(*) n FROM messages WHERE car_id=?').get(b.token).n === 1 && db.prepare('SELECT COUNT(*) n FROM cars WHERE id=?').get(b.token).n === 1);
check('deleted key no longer works', await del(a.owner_key) === 401);
check('the QR of a deleted car is not found', (await send(a.token, 'block', '5.5.5.3')).status === 404);

// size caps
let r = await SEND.onRequestPost({ request: req('{"token":"x","kind":"block","note":"' + 'a'.repeat(500000) + '"}', '6.6.6.6'), env }); check('send: 500 KB body refused', r.status === 400);
r = await SURVEY.onRequestPost({ request: req('{"x":"' + 'a'.repeat(6000) + '"}', '6.6.6.7'), env }); check('survey: 6 KB body refused', r.status === 400);
r = await REG.onRequestPost({ request: req('{"name":"' + 'ا'.repeat(5000) + '"}', '6.6.6.8'), env }); check('register: 5000-char body refused', r.status === 400);
r = await SEND.onRequestPost({ request: req({ token: b.token, kind: 'fault', photo: fakeJpeg(200 * 1024) }, '6.6.6.9'), env }); check('send: a normal 200 KB photo still passes the cap', r.status === 200);

// registration flood cap
for (let i = 0; i < 300; i++) db.prepare("INSERT INTO cars (id, owner_key, name, phone, ip_hash) VALUES (?,?,?,?,?)").run('f' + i, 'k' + i, 'x y', '+9627' + String(10000000 + i), 'h' + i);
r = await REG.onRequestPost({ request: req({ name: 'خالد العمري', phone: '0777731905', consent: true }, '8.8.8.8'), env }); check('registration flood: 429 busy', r.status === 429);
console.log(ok + '/' + n); process.exit(ok === n ? 0 : 1);
