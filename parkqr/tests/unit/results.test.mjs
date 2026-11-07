import { SITE, makeDb } from '../helpers.mjs';
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; else console.log('FAIL', name); };
const { db, DB } = makeDb();
const env = { DB, ADMIN_KEY: 'admin-secret-key-123' };
const R = await import(SITE + 'functions/api/results.js');
const get = (key) => R.onRequestGet({ request: new Request('http://x/api/results', { headers: key ? { authorization: 'Bearer ' + key } : {} }), env });

check('needs the admin key', (await get()).status === 401 && (await get('wrong')).status === 401);

// empty database: every number is zero, nothing crashes
let d = await (await get(env.ADMIN_KEY)).json();
check('empty db: zeros and null reply time', d.usage.cars.total === 0 && d.usage.messages.total === 0 && d.usage.messages.avgReplyMinutes === null && d.usage.pushDevices === 0);

const now = Math.floor(Date.now() / 1000);
const car = (id, ago) => db.prepare('INSERT INTO cars (id, owner_key, name, phone, created_at) VALUES (?,?,?,?,?)').run(id, 'k' + id, 'أحمد الخطيب', '+962795551234', now - ago);
car('c1', 100); car('c2', 3600); car('c3', 3 * 86400); car('c4', 20 * 86400);
const msg = (id, car_id, ago, replyAfter) => db.prepare('INSERT INTO messages (id, car_id, kind, reply, created_at, replied_at) VALUES (?,?,?,?,?,?)').run(id, car_id, 'block', replyAfter == null ? null : '2', now - ago, replyAfter == null ? null : now - ago + replyAfter);
msg('m1', 'c1', 300, 120); msg('m2', 'c1', 400, 240); msg('m3', 'c2', 500, null); msg('m4', 'c3', 2 * 86400, null);
db.prepare('INSERT INTO push_subs (id, car_id, endpoint, p256dh, auth) VALUES (?,?,?,?,?)').run('p1', 'c1', 'https://fcm.googleapis.com/a', 'x', 'y');
db.prepare('INSERT INTO push_subs (id, car_id, endpoint, p256dh, auth) VALUES (?,?,?,?,?)').run('p2', 'c1', 'https://fcm.googleapis.com/b', 'x', 'y');

d = await (await get(env.ADMIN_KEY)).json();
const u = d.usage;
check('cars: total / 24h / 7d', u.cars.total === 4 && u.cars.last24h === 2 && u.cars.last7d === 3);
check('registrations per day (last 7 days only)', u.cars.perDay.reduce((s, x) => s + x.n, 0) === 3);
check('push: 1 car, 2 devices', u.pushCars === 1 && u.pushDevices === 2);
check('cars that received a message', u.carsWithMessages === 3);
check('messages: total / replied / 24h / 7d', u.messages.total === 4 && u.messages.replied === 2 && u.messages.last24h === 3 && u.messages.last7d === 4);
check('average reply time = 3 minutes', u.messages.avgReplyMinutes === 3);
const text = JSON.stringify(d);
check('no names or phone numbers in the response', !text.includes('الخطيب') && !text.includes('962795551234') && !text.includes('kc1'));
check('survey fields are still there', 'total' in d && 'counts' in d && Array.isArray(d.contacts));
console.log(ok + '/' + n);
