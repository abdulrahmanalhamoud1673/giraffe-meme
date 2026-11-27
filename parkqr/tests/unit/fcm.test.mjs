// Instant app notifications: registration, a real signed Google login request (mocked Google), sending and cleanup.
import crypto from 'node:crypto';
import { SITE_URL, makeDb, fakeAI } from '../helpers.mjs';
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; else console.log('FAIL', name); };
const api = (f) => import(SITE_URL + 'functions/api/' + f);
const F = await api('_fcm.js'); const REG = await api('register.js'), SEND = await api('send.js'), R = await api('fcm-register.js'), ROT = await api('inbox/rotate.js'), DEL = await api('inbox/delete.js');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const account = JSON.stringify({ type: 'service_account', project_id: 'demo-project', client_email: 'push@demo-project.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://evil.example/steal' });
const calls = []; let gone = '';
globalThis.fetch = async (url, o) => {
  calls.push({ url: String(url), o });
  if (String(url).includes('oauth2')) return new Response(JSON.stringify({ access_token: 'short-lived', expires_in: 3600 }), { status: 200 });
  return new Response('{}', { status: JSON.parse(o.body).message.token === gone ? 404 : 200 });
};
const { DB, db } = makeDb(); const env = { DB, SALT: 's', AI: fakeAI(), FCM_SERVICE_ACCOUNT: account };
const req = (body, key, ip = '1.1.1.1') => new Request('http://x/', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(key ? { authorization: 'Bearer ' + key } : {}) }, body: JSON.stringify(body) });
const reg = await (await REG.onRequestPost({ request: req({ name: 'أحمد الخطيب', phone: '0795551234', consent: true }), env })).json();
const add = async (token, key = reg.owner_key, e = env, extra = {}) => { const r = await R.onRequestPost({ request: req({ token, ...extra }, key), env: e }); return [r.status, await r.json()]; };
const count = () => db.prepare('SELECT COUNT(*) n FROM fcm_tokens').get().n;
const T = (i) => 'device-token-number-' + i + ':APA91b_x-y';

let [s, j] = await add(T(1), null); check('needs the owner key', s === 401);
[s, j] = await add('short'); check('bad token refused', s === 400);
[s, j] = await add('<script>'.repeat(5)); check('odd characters refused', s === 400);
[s, j] = await add(T(1), reg.owner_key, { DB }); check('without the secret: stored, but reported not active', s === 200 && j.active === false && count() === 1);
[s, j] = await add(T(1)); check('with the secret: active, no duplicate row', j.active === true && count() === 1);
check('a broken secret counts as not configured', !F.fcmConfigured({ FCM_SERVICE_ACCOUNT: 'nonsense' }) && !F.fcmConfigured({ FCM_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'a', private_key: 'b', project_id: '../x' }) }));

calls.length = 0;
const sent = await SEND.onRequestPost({ request: req({ token: reg.token, kind: 'urgent' }, null, '7.7.7.7'), env });
check('sending an alert still succeeds', sent.status === 200);
const auth = calls.find((c) => c.url.includes('oauth2'));
check('login goes to Google only, never to an address from the file', auth.url === 'https://oauth2.googleapis.com/token' && !calls.some((c) => c.url.includes('evil')));
const jwt = new URLSearchParams(auth.o.body).get('assertion').split('.');
check('login request is signed with the service key', crypto.verify('sha256', Buffer.from(jwt[0] + '.' + jwt[1]), publicKey, Buffer.from(jwt[2], 'base64url')));
const claims = JSON.parse(Buffer.from(jwt[1], 'base64url'));
check('only the messaging permission is asked for', claims.scope === 'https://www.googleapis.com/auth/firebase.messaging' && claims.exp - claims.iat === 3600);
const push = calls.find((c) => c.url.includes('fcm.googleapis.com'));
const msg = JSON.parse(push.o.body).message;
check('message goes to the project, urgent channel, high priority', push.url.includes('/projects/demo-project/') && msg.token === T(1) && msg.android.priority === 'HIGH' && msg.android.notification.channel_id === 'urgent' && /^yn-/.test(msg.android.notification.tag));
check('no phone number or name leaves in the message', !push.o.body.includes('795551234') && !push.o.body.includes('الخطيب'));

for (let i = 2; i <= 8; i++) await add(T(i));
check('at most 5 phones per account, the newest kept', count() === 5 && db.prepare('SELECT 1 x FROM fcm_tokens WHERE token = ?').get(T(8)) && !db.prepare('SELECT 1 x FROM fcm_tokens WHERE token = ?').get(T(1)));
gone = T(8); const r = await F.notifyApp(env, reg.token, { title: 't', body: 'b', tag: 'x' });
check('a phone Google no longer knows is removed', r.sent === 4 && r.failed === 1 && count() === 4);
F._resetFcmCache(); const keep = globalThis.fetch; globalThis.fetch = async () => { throw new Error('offline'); };
const s2 = await SEND.onRequestPost({ request: req({ token: reg.token, kind: 'block' }, null, '8.8.8.8'), env });
check('Google being unreachable never breaks sending', s2.status === 200); globalThis.fetch = keep;
const other = await (await REG.onRequestPost({ request: req({ name: 'سامي الحسن', phone: '0788403917', consent: true }, null, '2.2.2.2'), env })).json();
await add(T(7), other.owner_key, env, { remove: true }); check('another owner cannot remove my phone', count() === 4);
await add(T(7), reg.owner_key, env, { remove: true }); check('signing out removes the phone', count() === 3);
const nk = (await (await ROT.onRequestPost({ request: req({}, reg.owner_key), env })).json()).owner_key;
check('replacing the link forgets every phone', count() === 0);
await add(T(2), nk); await DEL.onRequestPost({ request: req({}, nk), env }); check('deleting the account forgets its phones', count() === 0);
console.log(ok + '/' + n); process.exit(ok === n ? 0 : 1);
