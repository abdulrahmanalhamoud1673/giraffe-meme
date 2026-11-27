// Photos on problem reports: required for hit/fault/open/lights, live-camera JPEG only, owner-only access, AI check fails closed.
import { SITE_URL, SITE, makeDb, fakeJpeg, fakeAI } from '../helpers.mjs';
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; else console.log('FAIL', name); };
const REG = await import(SITE_URL + 'functions/api/register.js'); const SEND = await import(SITE_URL + 'functions/api/send.js');
const INBOX = await import(SITE_URL + 'functions/api/inbox.js'); const PHOTO = await import(SITE_URL + 'functions/api/photo.js');
const P = await import(SITE_URL + 'functions/api/_photo.js');
const { DB, db } = makeDb();
const req = (path, method, body, h = {}) => new Request('http://x' + path, { method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.1.1.' + Math.floor(Math.random() * 200), ...h }, body: body ? JSON.stringify(body) : undefined });
const env = { DB, SALT: 'test-salt', AI: fakeAI() };
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
check('checked photo stored with verdict ok', db.prepare('SELECT verdict FROM photos WHERE msg_id = ?').get(id)?.verdict === 'ok');

const authed = (k) => ({ headers: { authorization: 'Bearer ' + k } });
const get = async (url, k) => PHOTO.onRequestGet({ request: new Request('http://x' + url, k ? authed(k) : {}), env });
let r = await get('/api/photo?id=' + id, reg.owner_key); check('owner can fetch the photo (image/jpeg)', r.status === 200 && r.headers.get('content-type') === 'image/jpeg' && (await r.arrayBuffer()).byteLength === 3000);
r = await get('/api/photo?id=' + id); check('no key: 401', r.status === 401);
r = await get('/api/photo?id=' + id, other.owner_key); check('another owner: 404', r.status === 404);
r = await get('/api/photo?id=nope', reg.owner_key); check('unknown id: 404', r.status === 404);
const inbox = await (await INBOX.onRequestGet({ request: new Request('http://x/', authed(reg.owner_key)), env })).json();
check('inbox flags the message with a photo', inbox.messages.find((m) => m.id === id)?.photo === 1);

// The verdicts
const clean = () => { for (const t of ['messages', 'photos', 'hits']) db.prepare('DELETE FROM ' + t).run(); };
const count = (t) => db.prepare('SELECT COUNT(*) n FROM ' + t).get().n;
for (const [name, v] of [['not a vehicle (a fridge)', { vehicle: false }], ['photo of a screen', { screen: true }], ['indecent photo', { indecent: true }], ['abusive writing', { abusive_text: true }]]) {
  clean(); [s, j] = await send('hit', fakeJpeg(), { ...env, AI: fakeAI(v) });
  check(name + ': refused, nothing stored', s === 422 && j.error === 'photo_unrelated' && count('messages') === 0 && count('photos') === 0);
}
for (const [name, ai] of [['AI not connected', undefined], ['AI down', { run: async () => { throw new Error('down'); } }], ['AI talks nonsense', { run: async () => ({ answer: 'yes it is', response: 'sure' }) }]]) {
  clean(); [s, j] = await send('hit', fakeJpeg(), { ...env, AI: ai });
  check(name + ': alert delivered, photo is not', s === 200 && j.photo_dropped === true && count('messages') === 1 && count('photos') === 0);
}
clean(); const asked = [];
[s, j] = await send('hit', fakeJpeg(), { ...env, AI: { run: async (id, input) => { asked.push([id, input]); if (asked.length === 1) throw new Error('first model down'); return { answer: '{"vehicle": true, "screen": false, "indecent": false, "abusive_text": false}' }; } } });
check('second model takes over', s === 200 && !j.photo_dropped && asked.length === 2 && asked[0][0] !== asked[1][0] && count('photos') === 1);
check('models receive the photo as a JPEG data URL', asked[0][1].messages[0].content[1].image_url.url.startsWith('data:image/jpeg;base64,/9') && asked[1][1].image.startsWith('data:image/jpeg;base64,'));
check('verdict: missing or non-boolean answers do not count', P.readVerdict('{"vehicle":true}') === null && P.readVerdict('{"vehicle":"true","screen":false,"indecent":false,"abusive_text":false}') === null && P.readVerdict('yes') === null && P.readVerdict(undefined) === null);

// one device cannot burn the AI quota by sending refused photos again and again
clean(); let calls = 0; const no = { ...env, AI: { run: async () => { calls++; return fakeAI({ vehicle: false }).run(); } } };
const same = async () => { const r = await SEND.onRequestPost({ request: req('/', 'POST', { token: reg.token, kind: 'hit', photo: fakeJpeg() }, { 'cf-connecting-ip': '5.5.5.5' }), env: no }); return r.status; };
const codes = []; for (let i = 0; i < P.CHECK_LIMIT + 2; i++) codes.push(await same());
check('after ' + P.CHECK_LIMIT + ' tries the device waits', codes.slice(0, P.CHECK_LIMIT).every((c) => c === 422) && codes.slice(P.CHECK_LIMIT).every((c) => c === 429) && calls === P.CHECK_LIMIT);
clean();

// cleanup
db.prepare("UPDATE photos SET created_at = unixepoch() - 8*86400").run();
db.prepare('DELETE FROM messages').run();
await send('open', fakeJpeg());
check('photos older than 7 days are deleted', db.prepare('SELECT COUNT(*) n FROM photos').get().n === 1);
check('constants', JSON.stringify(P.PHOTO_KINDS) === JSON.stringify(['hit', 'fault', 'open', 'lights']));
console.log(ok + '/' + n); process.exit(ok === n ? 0 : 1);
