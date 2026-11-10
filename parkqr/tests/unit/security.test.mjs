// Admin protection: strong keys work; wrong, missing, weak or exposed keys do not.
import crypto from 'node:crypto';
import { SITE, makeDb } from '../helpers.mjs';
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; else console.log('FAIL', name); };
const S = await import(SITE + 'functions/api/_security.js');
const R = await import(SITE + 'functions/api/results.js');
const { DB } = makeDb();
// fake "exposed" values (the real leaked ones are never stored in plaintext anywhere)
const fake = { ADMIN_KEY: 'fake-leaked-admin-key-for-tests-1', SALT: 'fake-leaked-salt-for-tests', VAPID_PRIVATE: 'fake-leaked-vapid-for-tests' };
for (const k of Object.keys(fake)) S.EXPOSED[k].push(await S.sha256Hex(fake[k]));
const good = 'a-brand-new-strong-admin-key-2026';
const call = async (env, auth) => { const r = await R.onRequestGet({ request: new Request('http://x/api/results', { headers: auth ? { authorization: auth } : {} }), env: { DB, ...env } }); return [r.status, await r.json().catch(() => ({}))]; };

let [s, j] = await call({ ADMIN_KEY: good }, 'Bearer ' + good); check('strong key + correct header: 200', s === 200 && 'usage' in j);
[s, j] = await call({ ADMIN_KEY: good }, 'Bearer wrong' + good); check('wrong key: 401', s === 401);
[s] = await call({ ADMIN_KEY: good }); check('no key: 401', s === 401);
[s] = await call({ ADMIN_KEY: good }, good); check('key without "Bearer": 401', s === 401);
[s, j] = await call({ ADMIN_KEY: good }, 'Bearer ' + good + 'x'); check('almost right (one extra char): 401', s === 401);

// the key that was pasted into a chat is refused even when presented correctly
const exposed = fake.ADMIN_KEY;
[s, j] = await call({ ADMIN_KEY: exposed }, 'Bearer ' + exposed); check('exposed key: switched off (503 leaked_key), even with the right header', s === 503 && j.error === 'leaked_key');
[s, j] = await call({ ADMIN_KEY: exposed }); check('exposed key: same answer without any header (so the page can show the fix)', s === 503 && j.error === 'leaked_key');
check('the response never contains the key', !JSON.stringify(j).includes(exposed));
[s, j] = await call({ ADMIN_KEY: 'short123' }, 'Bearer short123'); check('weak (short) key: 503 weak_key', s === 503 && j.error === 'weak_key');
[s, j] = await call({}, 'Bearer anything'); check('no ADMIN_KEY configured: 503 no_key', s === 503 && j.error === 'no_key');
[s] = await call({ ADMIN_KEY: 'x'.repeat(19) }, 'Bearer ' + 'x'.repeat(19)); check('19 characters is still too short', s === 503);
[s] = await call({ ADMIN_KEY: 'x1'.repeat(10) }, 'Bearer ' + 'x1'.repeat(10)); check('20 characters is accepted', s === 200);

// other exposed secrets are reported by name only, and only to a logged-in admin
const env = { ADMIN_KEY: good, SALT: fake.SALT, VAPID_PRIVATE: fake.VAPID_PRIVATE };
[s, j] = await call(env, 'Bearer ' + good); check('exposed SALT and VAPID_PRIVATE are listed by name', s === 200 && j.exposed.length === 2 && j.exposed.includes('SALT') && j.exposed.includes('VAPID_PRIVATE'));
check('...without printing their values', !JSON.stringify(j).includes(fake.SALT) && !JSON.stringify(j).includes(fake.VAPID_PRIVATE));
[s, j] = await call({ ADMIN_KEY: good, SALT: 'a-new-random-salt-value' }, 'Bearer ' + good); check('replaced secrets are not flagged', j.exposed.length === 0);
check('exposedSecrets without admin context', (await S.exposedSecrets({ SALT: env.SALT })).join() === 'SALT');

check('constant-time compare: equal', S.timingSafeEqual('abc123', 'abc123'));
check('constant-time compare: different, same length', !S.timingSafeEqual('abc123', 'abc124'));
check('constant-time compare: different length', !S.timingSafeEqual('abc', 'abc1'));
check('sha256Hex matches node', (await S.sha256Hex('hello')) === crypto.createHash('sha256').update('hello').digest('hex'));
console.log(ok + '/' + n);
