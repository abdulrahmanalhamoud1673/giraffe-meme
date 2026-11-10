// "I want a ready-made sticker": owner-only, validated, one answer per car, table created on first use.
import { SITE, makeDb } from '../helpers.mjs';
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; else console.log('FAIL', name); };
const { db, DB } = makeDb(); const env = { DB, SALT: 's', ADMIN_KEY: 'adm' };
const R = await import(SITE + 'functions/api/register.js');
const I = await import(SITE + 'functions/api/interest.js?fresh=' + Date.now());   // fresh module: "table ensured" flag starts false
const RES = await import(SITE + 'functions/api/results.js');
let ip = 0;
const req = (method, body, h = {}) => new Request('http://x/', { method, body: body && JSON.stringify(body), headers: { 'cf-connecting-ip': '8.8.8.' + (ip++ % 250), 'user-agent': 'u' + ip, ...h } });
const mk = async (phone) => (await (await R.onRequestPost({ request: req('POST', { name: 'أحمد الخطيب', phone, consent: true }), env })).json());
const a = await mk('0795551234'), b = await mk('0788612398');
const auth = (c) => ({ authorization: 'Bearer ' + c.owner_key });
const post = async (c, body) => { const r = await I.onRequestPost({ request: req('POST', body, auth(c)), env }); return [r.status, await r.json()]; };
const results = async () => (await (await RES.onRequestGet({ request: new Request('http://x/', { headers: { authorization: 'Bearer adm' } }), env })).json()).usage.interest;

// results work even if nobody ever used it and the table does not exist (older database)
db.exec('DROP TABLE interests');
let it = await results(); check('no table yet: results still work, zeros', it.total === 0);
check('owner key required', (await I.onRequestPost({ request: req('POST', { area: 'amman', price: '3' }), env })).status === 401);
let [s, j] = await post(a, { area: 'amman', price: '3', qty: 1 });
check('first use creates the table and saves', s === 200 && j.ok && db.prepare('SELECT COUNT(*) n FROM interests').get().n === 1);
check('invalid area refused', (await post(a, { area: 'mars', price: '3' }))[1].error === 'bad_area');
check('invalid price refused', (await post(a, { area: 'amman', price: '0.1' }))[1].error === 'bad_price');
check('invalid quantity refused', (await post(a, { area: 'amman', price: '3', qty: 99 }))[1].error === 'bad_qty');
await post(a, { area: 'irbid', price: '5', qty: 2 });
check('same car again: updates, still one row', db.prepare('SELECT COUNT(*) n FROM interests').get().n === 1 && db.prepare('SELECT area, price, qty FROM interests').get().area === 'irbid');
await post(b, { area: 'amman', price: '3' });
const g = await (await I.onRequestGet({ request: req('GET', null, auth(a)), env })).json();
check('owner can read back their own answer', g.interest.area === 'irbid' && g.interest.price === '5' && g.interest.qty === 2);
check('GET needs the owner key', (await I.onRequestGet({ request: req('GET', null, { authorization: 'Bearer wrongwrongwrongwrong' }), env })).status === 401);
it = await results();
check('results: 2 interested, 3 units, by area and price', it.total === 2 && it.units === 3 && it.byArea.irbid === 1 && it.byArea.amman === 1 && it.byPrice['5'] === 1 && it.byPrice['3'] === 1);
check('results never include a name or phone number', !JSON.stringify(it).includes('962') && !JSON.stringify(it).includes('أحمد'));
console.log(ok + '/' + n);
