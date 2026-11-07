import http from 'node:http'; import crypto from 'node:crypto';
import { SITE, makeKeys, makeDb } from '../helpers.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const ece = require('http_ece');
const B = SITE + 'functions/';
const { db, DB } = makeDb();
const keys = makeKeys();
const env = { DB, SALT: 's', VAPID_PUBLIC: keys.VAPID_PUBLIC, VAPID_PRIVATE: keys.VAPID_PRIVATE };
const m = async (p) => import(B + p);
const R = await m('api/register.js'), SUB = await m('api/push-subscribe.js'), UNS = await m('api/push-unsubscribe.js'), PK = await m('api/push-key.js'), PT = await m('api/push-test.js'), SEND = await m('api/send.js'), MAN = await m('manifest.webmanifest.js');
const req = (u, method = 'GET', body, h = {}) => new Request('http://x' + u, { method, body: body && JSON.stringify(body), headers: { 'cf-connecting-ip': '1.1.1.' + (Math.random() * 250 | 0), 'user-agent': 'ua' + Math.random(), ...h } });
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; console.log(c ? 'PASS' : 'FAIL', name); };
const reg = await (await R.onRequestPost({ request: req('/', 'POST', { name: 'أحمد الخطيب', phone: '0795551234', consent: true }), env })).json();
const auth = { authorization: 'Bearer ' + reg.owner_key };
const mkSub = (endpoint) => { const ua = crypto.createECDH('prime256v1'); ua.generateKeys(); const authSecret = crypto.randomBytes(16); return { ua, authSecret, sub: { endpoint, keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: authSecret.toString('base64url') } } }; };

// subscribe validation
const good = mkSub('https://fcm.googleapis.com/fcm/send/aaa');
check('subscribe ok', (await SUB.onRequestPost({ request: req('/', 'POST', good.sub, auth), env })).status === 200);
check('subscribe needs key', (await SUB.onRequestPost({ request: req('/', 'POST', good.sub), env })).status === 401);
check('reject http endpoint', (await SUB.onRequestPost({ request: req('/', 'POST', { ...good.sub, endpoint: 'http://fcm.googleapis.com/x' }, auth), env })).status === 400);
check('reject unknown host', (await SUB.onRequestPost({ request: req('/', 'POST', { ...good.sub, endpoint: 'https://evil.example.com/x' }, auth), env })).status === 400);
check('reject short keys', (await SUB.onRequestPost({ request: req('/', 'POST', { endpoint: good.sub.endpoint, keys: { p256dh: 'abc', auth: 'x' } }, auth), env })).status === 400);
await SUB.onRequestPost({ request: req('/', 'POST', good.sub, auth), env });
check('same device twice = one row', db.prepare('SELECT COUNT(*) n FROM push_subs').get().n === 1);
for (let i = 0; i < 4; i++) await SUB.onRequestPost({ request: req('/', 'POST', mkSub('https://fcm.googleapis.com/fcm/send/d' + i).sub, auth), env });
check('max 5 devices', (await SUB.onRequestPost({ request: req('/', 'POST', mkSub('https://fcm.googleapis.com/fcm/send/over').sub, auth), env })).status === 429);
await UNS.onRequestPost({ request: req('/', 'POST', { endpoint: good.sub.endpoint }, auth), env });
check('unsubscribe removes', db.prepare('SELECT COUNT(*) n FROM push_subs WHERE endpoint=?').get(good.sub.endpoint).n === 0);
db.exec('DELETE FROM push_subs');

check('push-key public', (await (await PK.onRequestGet({ env })).json()).key === keys.VAPID_PUBLIC);
check('push-key 503 when unset', (await PK.onRequestGet({ env: {} })).status === 503);

// real delivery through a local fake push service
let received = []; let reply = 201;
const srv = http.createServer((rq, rs) => { const c = []; rq.on('data', d => c.push(d)); rq.on('end', () => { received.push({ h: rq.headers, b: Buffer.concat(c), url: rq.url }); rs.writeHead(reply); rs.end(); }); });
await new Promise(r => srv.listen(0, r));
const port = srv.address().port;
const dev = mkSub('http://127.0.0.1:' + port + '/p1');
db.prepare('INSERT INTO push_subs (id,car_id,endpoint,p256dh,auth) VALUES (?,?,?,?,?)').run('s1', reg.token, dev.sub.endpoint, dev.sub.keys.p256dh, dev.sub.keys.auth);
const pending = [];
const sendMsg = (kind, e = env) => SEND.onRequestPost({ request: req('/', 'POST', { token: reg.token, kind }), env: e, waitUntil: (p) => pending.push(p) });
let r = await sendMsg('block');
await Promise.all(pending);
check('sender gets 200', r.status === 200);
check('owner device received a push', received.length === 1);
const payload = JSON.parse(ece.decrypt(received[0].b, { version: 'aes128gcm', privateKey: dev.ua, authSecret: dev.authSecret }).toString('utf8'));
check('push text is the chosen message', payload.body === 'سيارتك مسكّرة عليّ، ممكن تحرّكها؟' && payload.url === '/inbox.html' && payload.title === 'يا نشمي');
check('push carries no secrets', !JSON.stringify(payload).includes(reg.owner_key) && !JSON.stringify(payload).includes('0795'));

// dead subscription is cleaned up, sender still fine
reply = 410; pending.length = 0;
r = await sendMsg('lights'); await Promise.all(pending);
check('410 removes dead subscription', db.prepare('SELECT COUNT(*) n FROM push_subs').get().n === 0 && r.status === 200);

// push not configured: message still delivered to the inbox
const { VAPID_PUBLIC, VAPID_PRIVATE, ...noPush } = env;
r = await sendMsg('open', noPush);
check('works without push configured', r.status === 200 && db.prepare("SELECT COUNT(*) n FROM messages WHERE kind='open'").get().n === 1);

// test notification endpoint
reply = 201; received = [];
db.prepare('INSERT INTO push_subs (id,car_id,endpoint,p256dh,auth) VALUES (?,?,?,?,?)').run('s2', reg.token, dev.sub.endpoint, dev.sub.keys.p256dh, dev.sub.keys.auth);
const t = await (await PT.onRequestPost({ request: req('/', 'POST', {}, auth), env })).json();
check('test push sent to 1 device', t.sent === 1 && received.length === 1);
check('test push needs owner key', (await PT.onRequestPost({ request: req('/', 'POST', {}, { authorization: 'Bearer wrongwrongwrongwrong' }), env })).status === 401);
check('test push 503 when unset', (await PT.onRequestPost({ request: req('/', 'POST', {}, auth), env: noPush })).status === 503);
srv.close();

// manifest
const mf = await MAN.onRequestGet({ request: req('/manifest.webmanifest?k=' + reg.owner_key) });
const mj = await mf.json();
check('manifest start_url carries inbox key', mj.start_url === '/inbox.html#' + reg.owner_key && mj.display === 'standalone' && mj.icons.length === 2);
check('manifest content-type', mf.headers.get('content-type').startsWith('application/manifest+json'));
check('manifest ignores junk key', (await (await MAN.onRequestGet({ request: req('/manifest.webmanifest?k=%3Cscript%3E') })).json()).start_url === '/inbox.html');
console.log(ok + '/' + n);
