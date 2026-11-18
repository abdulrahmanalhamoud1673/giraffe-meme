// Photos on problem reports: required for hit/fault/open/lights, live-camera JPEG only, owner-only access, AI check fails open.
import { SITE, makeDb, fakeJpeg } from '../helpers.mjs';
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; else console.log('FAIL', name); };
const REG = await import(SITE + 'functions/api/register.js'); const SEND = await import(SITE + 'functions/api/send.js');
const INBOX = await import(SITE + 'functions/api/inbox.js'); const PHOTO = await import(SITE + 'functions/api/photo.js');
const P = await import(SITE + 'functions/api/_photo.js');
const { DB, db } = makeDb();
const req = (path, method, body, h = {}) => new Request('http://x' + path, { method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.1.1.' + Math.floor(Math.random() * 200), ...h }, body: body ? JSON.stringify(body) : undefined });
const env = { DB, SALT: 'test-salt' };
const rr = await REG.onRequestPost({ request: req('/', 'POST', { name: 'أحمد الخطيب', phone: '0795551234', consent: true }), env });
const reg = await rr.json();
const other = await (await REG.onRequestPost({ request: req('/', 'POST', { name: 'سامي الحسن', phone: '0788403917', consent: true }), env })).json();
const send = async (kind, photo, e = env) => { const r = await SEND.onRequestPost({ request: req('/', 'POST', { token: reg.token, kind, photo }, { 'cf-connecting-ip': '9.9.9.' + Math.floor(Math.random() * 250) }), env: e }); return [r.status, await r.json()]; };

let [s, j] = await send('hit'); check('problem report without photo: 400 photo_required', s === 400 && j.error === 'photo_required');
[s, j] = await send('hit', 'data:image/png;base64,AAAA'); check('not a JPEG data URL: 400 bad_photo', s === 400 && j.error === 'bad_photo');
[s, j] = await send('hit', 'data:image/jpeg;base64,' + Buffer.from('not a picture at all'.repeat(200)).toString('base64')); check('no JPEG markers: bad_photo', s === 400 && j.error === 'bad_photo');
[s, j] = await send('hit', fakeJpeg(300 * 1024)); check('too big: bad_photo', s === 400 && j.error === 'bad_photo');
[s, j] = await send('hit', fakeJpeg(1000)); check('too tiny: bad_photo', s === 400 && j.error === 'bad_photo');
check('nothing stored after refusals', db.prepare('SELECT COUNT(*) n FROM messages').get().n === 0);
[s, j] = await send('block'); check('simple message (block): no photo needed', s === 200);
db.prepare('DELETE FROM messages').run();
[s, j] = await send('fault', fakeJpeg()); check('problem with a camera photo: 200', s === 200 && j.id);
const id = j.id;
check('photo stored with verdict unchecked (no AI connected)', db.prepare('SELECT verdict FROM photos WHERE msg_id = ?').get(id)?.verdict === 'unchecked');

const authed = (k) => ({ headers: { authorization: 'Bearer ' + k } });
const get = async (url, k) => PHOTO.onRequestGet({ request: new Request('http://x' + url, k ? authed(k) : {}), env });
let r = await get('/api/photo?id=' + id, reg.owner_key); check('owner can fetch the photo (image/jpeg)', r.status === 200 && r.headers.get('content-type') === 'image/jpeg' && (await r.arrayBuffer()).byteLength === 3000);
r = await get('/api/photo?id=' + id); check('no key: 401', r.status === 401);
r = await get('/api/photo?id=' + id, other.owner_key); check('another owner: 404', r.status === 404);
r = await get('/api/photo?id=nope', reg.owner_key); check('unknown id: 404', r.status === 404);
const inbox = await (await INBOX.onRequestGet({ request: new Request('http://x/', authed(reg.owner_key)), env })).json();
check('inbox flags the message with a photo', inbox.messages.find((m) => m.id === id)?.photo === 1);

// AI connected
db.prepare('DELETE FROM messages').run();
const ai = (labels) => ({ run: async () => labels });
[s, j] = await send('hit', fakeJpeg(), { ...env, AI: ai([{ label: 'sports car, sport car', score: 0.8 }]) }); check('AI: car photo accepted', s === 200);
db.prepare('DELETE FROM messages').run();
[s, j] = await send('hit', fakeJpeg(), { ...env, AI: ai([{ label: 'oak tree', score: 0.9 }, { label: 'fig', score: 0.02 }]) }); check('AI: confident non-car photo refused (422 photo_unrelated)', s === 422 && j.error === 'photo_unrelated');
check('refused photo leaves no message', db.prepare('SELECT COUNT(*) n FROM messages').get().n === 0);
[s, j] = await send('hit', fakeJpeg(), { ...env, AI: ai([{ label: 'oak tree', score: 0.3 }]) }); check('AI: unsure -> accepted', s === 200);
db.prepare('DELETE FROM messages').run();
[s, j] = await send('hit', fakeJpeg(), { ...env, AI: { run: async () => { throw new Error('down'); } } }); check('AI down: fails open', s === 200);

// cleanup
db.prepare("UPDATE photos SET created_at = unixepoch() - 8*86400").run();
db.prepare('DELETE FROM messages').run();
await send('open', fakeJpeg());
check('photos older than 7 days are deleted', db.prepare('SELECT COUNT(*) n FROM photos').get().n === 1);
check('constants', JSON.stringify(P.PHOTO_KINDS) === JSON.stringify(['hit', 'fault', 'open', 'lights']));
console.log(ok + '/' + n); process.exit(ok === n ? 0 : 1);
