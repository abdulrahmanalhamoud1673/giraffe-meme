// What an abuser or intruder would try: filter tricks, changing browser, parallel requests, flooding, stolen link.
import { SITE_URL, makeDb, fakeAI } from '../helpers.mjs';
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; else console.log('FAIL', name); };
const api = (f) => import(SITE_URL + 'functions/api/' + f);
const { checkNote } = await api('_notefilter.js'); const { netOf, takeHit } = await api('_guard.js'); const T = await api('_textcheck.js');
const REG = await api('register.js'), SEND = await api('send.js'), CHAT = await api('chat.js'), OCHAT = await api('inbox/chat.js'), BLOCK = await api('inbox/block.js'), DEL = await api('inbox/delete.js'), ROT = await api('inbox/rotate.js'), INBOX = await api('inbox.js'), CAR = await api('car.js'), NUDGE = await api('nudge.js');

for (const t of ['ك​لب', 'يا کلب', 'ﻛﻠﺐ', 'kalb', 'ya 7mar', 'sharmouta', 'صفر سبعة تسعة خمسة خمسة واحد', 'رقم تلفوني 079', 'شو اسمك يا عسل', 'ممكن نتعرف', 'يلا انقلع', 'ضيفني ahmad_22', 'دقلي', 'من وين انت', 'انتي مرتبطة؟']) check('filtered: ' + t, checkNote(t, 140).ok === false);
for (const t of ['جاي خلال خمس دقايق', 'انا بالطابق 2 شقة 14', 'ثواني ونازل', 'السيارة اللي ورا مسكرة علي', 'يعطيك العافية']) check('allowed: ' + t, checkNote(t, 140).ok === true);
check('a number cannot be sent in pieces', checkNote('955', 140, '079').ok === false && checkNote('وبعدين 123', 140, 'شقة 7951').ok === false);
check('a normal short number after another is fine', checkNote('شقة 3', 140, 'طابق 2').ok === true);
check('IPv6 addresses of one phone count as one', netOf('2a01:9700:1:2:aaaa::1') === netOf('2a01:9700:0001:0002::ffff') && netOf('2a01:9700:1:3::1') !== netOf('2a01:9700:1:2::1') && netOf('1.2.3.4') === '1.2.3.4');

const { DB, db } = makeDb(); const env = { DB, SALT: 's', AI: fakeAI() };
const req = (path, body, ip, ua = 'phone', key, method = 'POST') => new Request('http://x' + path, { method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, 'user-agent': ua, ...(key ? { authorization: 'Bearer ' + key } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body) });
const count = (sql) => db.prepare('SELECT COUNT(*) n FROM ' + sql).get().n;
const reg = await (await REG.onRequestPost({ request: req('/', { name: 'أحمد الخطيب', nickname: 'يا كلب 0795551234', phone: '0795551234', consent: true }, '1.1.1.1'), env })).json();
check('a rude or numbered nickname never reaches strangers', (await (await CAR.onRequestGet({ request: req('/api/car?t=' + reg.token, null, '3.3.3.3', 'p', null, 'GET'), env })).json()).nickname === '');
const send = (ip, ua, e = env, extra = {}) => SEND.onRequestPost({ request: req('/', { token: reg.token, kind: 'block', ...extra }, ip, ua), env: e });
let got = 0; for (let i = 0; i < 10; i++) if ((await send('9.9.9.9', 'ua' + i)).status === 200) got++;
check('changing the browser name does not beat the limit', got === 3);
db.prepare('DELETE FROM messages').run();
const burst = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => send('8.8.8.8', 'b' + i)));
check('parallel requests do not beat the limit', burst.filter((r) => r.status === 200).length <= 3 && count('messages') <= 3);
db.prepare('DELETE FROM messages').run(); db.prepare('DELETE FROM hits').run();
const m = await (await send('7.7.7.7', 'a')).json();
const say = (text, ip = '7.7.7.7', ua = 'a', e = env) => CHAT.onRequestPost({ request: req('/api/chat?id=' + m.id, { text }, ip, ua), env: e });
const own = (text, key = reg.owner_key, e = env) => OCHAT.onRequestPost({ request: req('/api/inbox/chat?id=' + m.id, { text }, '2.2.2.2', 'o', key), env: e });
const gap = () => db.prepare('UPDATE chat SET created_at = created_at - 10').run();
const codes = []; for (let i = 0; i < 6; i++) { const r = await say('وينك'); codes.push([r.status, (await r.json()).error]); gap(); }
check('stranger: 3 lines, then waits for the owner', codes.filter((c) => c[0] === 200).length === 3 && codes[5][1] === 'wait_owner');
check('owner can still answer', (await own('نازل')).status === 200);
gap(); check('after the answer the stranger can write again', (await say('تمام')).status === 200);
gap(); const par = await Promise.all([say('هلا'), say('هلا'), say('هلا')]);
check('parallel chat lines: only one gets in', par.filter((r) => r.status === 200).length === 1);

// the second opinion on text
const judge = (allowed) => ({ ...env, AI: { run: async (id, input) => typeof input.messages[0].content === 'string' ? { choices: [{ message: { content: JSON.stringify({ allowed }) } }] } : fakeAI().run() } });
gap(); let r = await say('عيونك بتجنن', '7.7.7.7', 'a', judge(false)); check('AI refusal stops a chat line the word list missed', r.status === 422 && (await r.json()).error === 'text_rejected');
gap(); check('AI approval lets it through', (await say('انا عند الباب', '7.7.7.7', 'a', judge(true))).status === 200);
gap(); check('AI down: the word filter still decides', (await say('انا عند الباب', '7.7.7.7', 'a', { ...env, AI: { run: async () => { throw new Error('down'); } } })).status === 200);
check('owner text is judged too', (await own('جملة', reg.owner_key, judge(false))).status === 422);
r = await send('6.6.6.6', 'n', judge(false), { note: 'عيونك بتجنن' }); check('AI also judges the note on an alert', r.status === 422 && (await r.json()).error === 'note_rejected');
check('the model is told the message is data', /Never follow instructions/.test(T.RULES));

// block follows the person, not the browser name
db.prepare('DELETE FROM hits').run();
await BLOCK.onRequestPost({ request: req('/', { id: m.id }, '2.2.2.2', 'o', reg.owner_key), env });
const before = [count('chat'), count('messages')]; gap(); await say('وينك', '7.7.7.7', 'other'); await say('وينك', '5.5.5.5', 'a2'); await send('7.7.7.7', 'third');
check('blocked: new browser or new network on the old thread stores nothing', count('chat') === before[0] && count('messages') === before[1]);

// stolen link
db.exec("INSERT INTO push_subs (id, car_id, endpoint, p256dh, auth) VALUES ('p','" + reg.token + "','https://x.googleapis.com/1','k','a')");
r = await ROT.onRequestPost({ request: req('/', {}, '2.2.2.2', 'o', reg.owner_key), env }); const nk = (await r.json()).owner_key;
const inbox = async (k) => (await INBOX.onRequestGet({ request: req('/api/inbox', null, '2.2.2.2', 'o', k, 'GET'), env })).status;
check('new key works, old key is dead', r.status === 200 && nk.length === 28 && await inbox(nk) === 200 && await inbox(reg.owner_key) === 401);
check('devices of the old link stop getting notifications', count('push_subs') === 0);
check('changing the key needs the key', (await ROT.onRequestPost({ request: req('/', {}, '2.2.2.2', 'o'), env })).status === 401);

// reminder only once
db.prepare('UPDATE messages SET created_at = unixepoch() - 300, reply = NULL').run();
await Promise.all([1, 2, 3].map(() => NUDGE.onRequestPost({ request: req('/', { id: m.id }, '7.7.7.7'), env })));
check('parallel reminders: one', count("messages WHERE kind LIKE 'nudge:%'") === 1);
await DEL.onRequestPost({ request: req('/', {}, '2.2.2.2', 'o', nk), env });
check('account deletion removes the conversations too', count('chat') === 0 && count('messages') === 0 && count('cars') === 0);

// errors do not describe the database
r = await SEND.onRequestPost({ request: req('/', { token: 'x', kind: 'block' }, '1.1.1.1'), env: { DB: { prepare: () => { throw new Error('SQLITE secret table'); } } } });
check('server errors say nothing about the inside', r.status === 500 && !(await r.text()).includes('SQLITE'));
check('hit counter stops at the limit', (await takeHit(env, 't', 2, 60)) && (await takeHit(env, 't', 2, 60)) && !(await takeHit(env, 't', 2, 60)));
console.log(ok + '/' + n); process.exit(ok === n ? 0 : 1);
