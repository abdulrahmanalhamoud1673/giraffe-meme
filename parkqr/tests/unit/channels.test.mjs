// WhatsApp message + phone ring (mocked network), and the minute-by-minute escalation endpoint.
import { SITE, makeDb, fakeJpeg } from '../helpers.mjs';
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; else console.log('FAIL', name); };
const C = await import(SITE + 'functions/api/_channels.js');
const REG = await import(SITE + 'functions/api/register.js'), SEND = await import(SITE + 'functions/api/send.js'), NUDGE = await import(SITE + 'functions/api/nudge.js'), ESC = await import(SITE + 'functions/api/escalate.js');
check('waNumber: 07.. -> 962..', C.waNumber('0795551234') === '962795551234');
check('waNumber: +962 kept', C.waNumber('+962 79 555 1234') === '962795551234');
check('waNumber: junk -> empty', C.waNumber('12') === '');

const calls = []; const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response('{}', { status: 200 }); };
const { DB, db } = makeDb();
const base = { DB, SALT: 's' };
const wa = { WA_TOKEN: 'tok', WA_PHONE_ID: '123', WA_TEMPLATE: 'new_alert', SITE_URL: 'https://yanashmi.com' };
const tw = { TWILIO_SID: 'ACabc', TWILIO_TOKEN: 'secret', TWILIO_FROM: '+15005550006' };
const req = (body, ip, h = {}) => new Request('http://x/', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...h }, body: JSON.stringify(body) });
const reg = await (await REG.onRequestPost({ request: req({ name: 'أحمد الخطيب', phone: '0795551234', consent: true }, '3.3.3.3'), env: base })).json();
const pending = []; const ctx = (env, request) => ({ request, env, waitUntil: (p) => pending.push(p) });
const done = async () => { await Promise.all(pending.splice(0)); };

// not configured: nothing leaves the server
let r = await SEND.onRequestPost(ctx(base, req({ token: reg.token, kind: 'block' }, '4.4.4.4'))); await done();
check('not configured: no WhatsApp, no call', r.status === 200 && calls.length === 0);

// WhatsApp on send
calls.length = 0;
r = await SEND.onRequestPost(ctx({ ...base, ...wa }, req({ token: reg.token, kind: 'fault', photo: fakeJpeg() }, '4.4.4.5'))); await done();
const w = calls.find((c) => c.url.includes('graph.facebook.com'));
check('WhatsApp: sent to the Graph API with the phone id', !!w && w.url.includes('/123/messages'));
const wb = JSON.parse(w.init.body);
check('WhatsApp: to the owner number (962...)', wb.to === '962795551234' && wb.type === 'template' && wb.template.name === 'new_alert');
check('WhatsApp: text mentions the photo, link opens the inbox', wb.template.components[0].parameters[0].text.includes('مع صورة') && wb.template.components[0].parameters[1].text === 'https://yanashmi.com/inbox.html#' + reg.owner_key);
check('WhatsApp: bearer token', w.init.headers.authorization === 'Bearer tok');
check('no phone ring on the first message', !calls.some((c) => c.url.includes('twilio')));
const msgId = db.prepare("SELECT id FROM messages WHERE kind='fault'").get().id;

// ring through the sender's reminder
calls.length = 0; db.prepare('UPDATE messages SET created_at = created_at - 130').run();
r = await NUDGE.onRequestPost(ctx({ ...base, ...wa, ...tw }, req({ id: msgId }, '4.4.4.5'))); await done();
const t = calls.find((c) => c.url.includes('api.twilio.com'));
check('ring: Twilio call created', r.status === 200 && !!t && t.url.includes('/Accounts/ACabc/Calls.json'));
const tb = new URLSearchParams(t.init.body);
check('ring: to the owner, from the service number, short timeout', tb.get('To') === '+962795551234' && tb.get('From') === '+15005550006' && tb.get('Timeout') === '25');
check('ring: basic auth', t.init.headers.authorization === 'Basic ' + btoa('ACabc:secret'));
check('reminder also sent on WhatsApp', calls.some((c) => c.url.includes('graph.facebook.com') && JSON.parse(c.init.body).template.components[0].parameters[0].text.includes('تذكير')));

// escalation endpoint (cron)
db.prepare("UPDATE messages SET reply='2' WHERE kind='block'").run();
const m2 = await (await SEND.onRequestPost(ctx(base, req({ token: reg.token, kind: 'urgent' }, '5.5.5.5')))).json(); await done();
db.prepare('UPDATE messages SET created_at = unixepoch() - 200 WHERE id = ?').run(m2.id);
const post = (env, key) => ESC.onRequestPost(ctx(env, new Request('http://x/', { method: 'POST', headers: key ? { authorization: 'Bearer ' + key } : {} })));
r = await post(base, 'x'.repeat(30)); check('escalate: not configured -> 503', r.status === 503);
const env2 = { ...base, ...wa, ...tw, CRON_KEY: 'cron-key-for-tests-0000000001' };
r = await post(env2, null); check('escalate: no key -> 401', r.status === 401);
r = await post(env2, 'wrong-key-wrong-key-wrong-key'); check('escalate: wrong key -> 401', r.status === 401);
calls.length = 0; r = await post(env2, env2.CRON_KEY); await done(); let j = await r.json();
check('escalate: the unanswered 200s-old message is escalated (once)', r.status === 200 && j.escalated === 1 && calls.some((c) => c.url.includes('twilio')));
calls.length = 0; r = await post(env2, env2.CRON_KEY); await done(); j = await r.json();
check('escalate: not repeated', j.escalated === 0 && calls.length === 0);
db.prepare("INSERT INTO messages (id, car_id, kind, created_at) VALUES ('fresh', ?, 'block', unixepoch() - 30)").run(reg.token);
db.prepare("INSERT INTO messages (id, car_id, kind, created_at, reply) VALUES ('answered', ?, 'block', unixepoch() - 300, '2')").run(reg.token);
r = await post(env2, env2.CRON_KEY); await done(); j = await r.json();
check('escalate: ignores fresh and answered messages', j.escalated === 0);
globalThis.fetch = realFetch;
console.log(ok + '/' + n); process.exit(ok === n ? 0 : 1);
