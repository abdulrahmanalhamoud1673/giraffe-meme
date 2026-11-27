// Short chat between the person who scanned and the owner.
import { SITE, makeDb } from '../helpers.mjs';
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; else console.log('FAIL', name); };
const REG = await import(SITE + 'functions/api/register.js'), SEND = await import(SITE + 'functions/api/send.js'), CHAT = await import(SITE + 'functions/api/chat.js'), OCHAT = await import(SITE + 'functions/api/inbox/chat.js'), INBOX = await import(SITE + 'functions/api/inbox.js'), BLOCK = await import(SITE + 'functions/api/inbox/block.js');
const { DB, db } = makeDb(); const env = { DB, SALT: 's' };
const req = (url, method, body, ip, h = {}) => new Request('http://x' + url, { method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip || '1.1.1.1', 'user-agent': 'ua', ...h }, body: body ? JSON.stringify(body) : undefined });
const a = await (await REG.onRequestPost({ request: req('/', 'POST', { name: 'أحمد الخطيب', phone: '0795551234', consent: true }), env })).json();
const b = await (await REG.onRequestPost({ request: req('/', 'POST', { name: 'سامي الحسن', phone: '0788403917', consent: true }, '2.2.2.2'), env })).json();
const sent = await (await SEND.onRequestPost({ request: req('/', 'POST', { token: a.token, kind: 'block' }, '7.7.7.7'), env })).json(); const id = sent.id;
const sGet = async (i = id) => { const r = await CHAT.onRequestGet({ request: req('/api/chat?id=' + i, 'GET'), env }); return [r.status, await r.json()]; };
const sPost = async (text, ip = '7.7.7.7', i = id) => { const r = await CHAT.onRequestPost({ request: req('/api/chat?id=' + i, 'POST', { text }, ip), env }); return [r.status, await r.json()]; };
const oPost = async (text, key = a.owner_key, i = id) => { const r = await OCHAT.onRequestPost({ request: req('/api/inbox/chat?id=' + i, 'POST', { text }, '9.9.9.9', key ? { authorization: 'Bearer ' + key } : {}), env }); return [r.status, await r.json()]; };
const oGet = async (key = a.owner_key, i = id) => { const r = await OCHAT.onRequestGet({ request: req('/api/inbox/chat?id=' + i, 'GET', null, '9.9.9.9', key ? { authorization: 'Bearer ' + key } : {}), env }); return [r.status, await r.json()]; };
const gap = () => db.prepare('UPDATE chat SET created_at = created_at - 10').run();

let [s, j] = await sGet(); check('empty thread, open', s === 200 && j.open === true && j.messages.length === 0);
[s, j] = await sGet('nope'); check('unknown id: 404', s === 404);
[s, j] = await sPost('انا قدام العمارة'); check('sender writes', s === 200);
[s, j] = await sPost('تاني رسالة'); check('too fast: 429 slow', s === 429 && j.error === 'slow');
gap();
[s, j] = await oPost('بنزل هلأ'); check('owner answers', s === 200);
[s, j] = await oPost('x', null); check('owner endpoint needs the key', s === 401);
[s, j] = await oPost('x', b.owner_key); check('another owner cannot write to this thread', s === 404);
[s, j] = await oGet(b.owner_key); check('another owner cannot read it', s === 404);
[s, j] = await oGet(); check('owner reads both sides in order', s === 200 && j.messages.length === 2 && j.messages[0].side === 's' && j.messages[1].side === 'o' && j.messages[1].text === 'بنزل هلأ');
gap();
[s, j] = await sPost('يا كلب'); check('insult refused (422)', s === 422 && j.error === 'text_rejected');
[s, j] = await sPost('رقمي 0795551234'); check('phone number refused', s === 422);
[s, j] = await sPost('واتساب'); check('contact request refused', s === 422);
[s, j] = await sPost('x'.repeat(141)); check('over 140 characters refused', s === 422);
[s, j] = await sPost('   '); check('empty refused', s === 422);
const inbox = await (await INBOX.onRequestGet({ request: req('/api/inbox', 'GET', null, '9.9.9.9', { authorization: 'Bearer ' + a.owner_key }), env })).json();
check('inbox list shows the chat count', inbox.messages.find((m) => m.id === id).chat === 2);
// limit
for (let i = 0; i < 40; i++) db.prepare("INSERT INTO chat (id, msg_id, side, text, created_at) VALUES (?,?,?,?, unixepoch() - 100)").run('c' + i, id, i % 2 ? 's' : 'o', 'تمام');
[s, j] = await oPost('اخر وحدة'); check('thread limit (30): 429 limit', s === 429 && j.error === 'limit');
db.prepare("DELETE FROM chat WHERE id LIKE 'c%'").run();
// blocked sender: silent
const hit = await BLOCK.onRequestPost({ request: req('/', 'POST', { id }, '9.9.9.9', { authorization: 'Bearer ' + a.owner_key }), env });
gap(); [s, j] = await sPost('رسالة من محظور'); check('blocked sender: looks fine', s === 200);
[, j] = await oGet(); check('...but nothing is stored', !j.messages.some((m) => m.text === 'رسالة من محظور'));
// closes after 6 hours
db.prepare('UPDATE messages SET created_at = unixepoch() - 7*3600 WHERE id = ?').run(id);
[s, j] = await sPost('متأخر', '8.8.8.8'); check('after 6 hours: 410 closed', s === 410);
[s, j] = await sGet(); check('thread reports closed', j.open === false);
console.log(ok + '/' + n); process.exit(ok === n ? 0 : 1);
