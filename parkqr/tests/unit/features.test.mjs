// Reminder ("nudge"), urgent notifications, and the owner's typical reply time.
import http from 'node:http'; import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { SITE, makeKeys, makeDb } from '../helpers.mjs';
const require = createRequire(import.meta.url); const ece = require('http_ece');
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; else console.log('FAIL', name); };
const { db, DB } = makeDb(); const keys = makeKeys();
const env = { DB, SALT: 's', ...keys };
const m = (p) => import(SITE + 'functions/' + p);
const R = await m('api/register.js'), SEND = await m('api/send.js'), NUDGE = await m('api/nudge.js'), CAR = await m('api/car.js'), INBOX = await m('api/inbox.js'), RES = await m('api/results.js'), REPLY = await m('api/inbox/reply.js'), PAUSE = await m('api/inbox/pause.js');
let ip = 0;
const req = (u, method = 'GET', body, h = {}) => new Request('http://x' + u, { method, body: body && JSON.stringify(body), headers: { 'cf-connecting-ip': '7.7.7.' + (ip++ % 250), 'user-agent': 'ua' + ip, ...h } });
const reg = await (await R.onRequestPost({ request: req('/', 'POST', { name: 'أحمد الخطيب', phone: '0795551234', consent: true }), env })).json();
const auth = { authorization: 'Bearer ' + reg.owner_key };

// a local fake push service + one registered owner device
const ua = crypto.createECDH('prime256v1'); ua.generateKeys(); const authSecret = crypto.randomBytes(16);
let pushes = []; const srv = http.createServer((rq, rs) => { const c = []; rq.on('data', (d) => c.push(d)); rq.on('end', () => { pushes.push(JSON.parse(ece.decrypt(Buffer.concat(c), { version: 'aes128gcm', privateKey: ua, authSecret }).toString('utf8'))); rs.writeHead(201); rs.end(); }); });
await new Promise((r) => srv.listen(0, r));
db.prepare('INSERT INTO push_subs (id,car_id,endpoint,p256dh,auth) VALUES (?,?,?,?,?)').run('p1', reg.token, 'http://127.0.0.1:' + srv.address().port + '/p', ua.getPublicKey().toString('base64url'), authSecret.toString('base64url'));
const pending = []; const wait = async () => { await Promise.all(pending.splice(0)); };
const send = async (kind) => { const r = await SEND.onRequestPost({ request: req('/', 'POST', { token: reg.token, kind }), env, waitUntil: (p) => pending.push(p) }); await wait(); return r; };
const nudge = async (id) => { const r = await NUDGE.onRequestPost({ request: req('/', 'POST', { id }), env, waitUntil: (p) => pending.push(p) }); await wait(); return [r.status, await r.json()]; };
const age = (id, seconds) => db.prepare('UPDATE messages SET created_at = unixepoch() - ? WHERE id = ?').run(seconds, id);

// ---- urgent notifications
let r = await send('lights'); const lightsId = (await r.json()).id;
check('normal message: not urgent', pushes.at(-1).urgent === false && pushes.at(-1).title === 'يا نشمي');
r = await send('hit'); const hitId = (await r.json()).id;
check('"hit" message: urgent title and flag', pushes.at(-1).urgent === true && pushes.at(-1).title === 'عاجل: يا نشمي');
r = await send('urgent');
check('"I am in a hurry": urgent too', pushes.at(-1).urgent === true);

// ---- reminder
let [s, j] = await nudge(lightsId);
check('too early (just sent): refused with the wait time', s === 429 && j.error === 'too_soon' && j.wait > 170 && j.wait <= 180);
age(lightsId, 200); pushes = [];
[s, j] = await nudge(lightsId);
check('after 3 minutes: reminder accepted', s === 200 && j.ok);
check('owner got a reminder push (same tag, with the original text)', pushes.length === 1 && pushes[0].title === 'تذكير: يا نشمي' && pushes[0].body === 'الأضواء شغالة (تذكير)' && pushes[0].tag === 'yn-' + lightsId);
[s, j] = await nudge(lightsId);
check('only one reminder per message', s === 409 && j.error === 'already_nudged' && pushes.length === 1);
check('unknown id', (await nudge('doesnotexist'))[0] === 404);
const nudgeRow = db.prepare("SELECT id FROM messages WHERE kind LIKE 'nudge:%'").get();
check('a reminder cannot be reminded again', (await nudge(nudgeRow.id))[0] === 404);

// replied messages and paused cars
age(hitId, 400);
await REPLY.onRequestPost({ request: req('/', 'POST', { id: hitId, reply: '2' }, auth), env });
check('already replied: no reminder', (await nudge(hitId))[1].error === 'already_replied');
const r3 = await send('open'); const openId = (await r3.json()).id;
db.prepare('UPDATE messages SET device_hash = NULL').run();
age(openId, 400); await PAUSE.onRequestPost({ request: req('/', 'POST', { paused: true }, auth), env });
check('paused owner: no reminder', (await nudge(openId))[1].error === 'paused');
await PAUSE.onRequestPost({ request: req('/', 'POST', { paused: false }, auth), env });

// ---- reminders are stored as messages: they must not distort the numbers
const inbox = await (await INBOX.onRequestGet({ request: req('/', 'GET', null, auth), env })).json();
check('inbox returns the reminder row for the page to attach', inbox.messages.some((x) => x.kind === 'nudge:' + lightsId));
const stats = await (await RES.onRequestGet({ request: new Request('http://x/', { headers: { authorization: 'Bearer features-test-admin-key-0001' } }), env: { ...env, ADMIN_KEY: 'features-test-admin-key-0001' } })).json();
check('stats count 4 real messages, not the reminder', stats.usage.messages.total === 4);

// ---- the daily limit ignores reminders
db.prepare("DELETE FROM messages").run();
for (let i = 0; i < 19; i++) db.prepare('INSERT INTO messages (id, car_id, kind) VALUES (?,?,?)').run('n' + i, reg.token, 'nudge:x' + i);
check('19 reminders do not use up the 20/day limit', (await send('thanks')).status === 200);

// ---- typical reply time
db.prepare('DELETE FROM messages').run();
let c = await (await CAR.onRequestGet({ request: req('/api/car?t=' + reg.token), env })).json();
check('no replies yet: no reply time shown', c.replyMinutes === null);
// simple explicit rows: created at T, replied at T + minutes
const T = Math.floor(Date.now() / 1000) - 5000; let k = 0;
const addRep = (mins) => db.prepare('INSERT INTO messages (id, car_id, kind, reply, created_at, replied_at) VALUES (?,?,?,?,?,?)').run('r' + k, reg.token, 'block', '2', T + k, T + k + mins * 60) && k++;
addRep(1); addRep(2);
c = await (await CAR.onRequestGet({ request: req('/api/car?t=' + reg.token), env })).json();
check('2 replies: still hidden (too little data)', c.replyMinutes === null);
addRep(3); addRep(10); addRep(2);
c = await (await CAR.onRequestGet({ request: req('/api/car?t=' + reg.token), env })).json();
check('5 replies (1,2,3,10,2 min): median = 2 minutes', c.replyMinutes === 2);
db.prepare('INSERT INTO messages (id, car_id, kind, created_at) VALUES (?,?,?,?)').run('z', reg.token, 'nudge:r0', T + 50);
c = await (await CAR.onRequestGet({ request: req('/api/car?t=' + reg.token), env })).json();
check('reminders do not affect it, and name/phone never appear', c.replyMinutes === 2 && !JSON.stringify(c).includes('أحمد') && !JSON.stringify(c).includes('962'));
srv.close();
console.log(ok + '/' + n);
