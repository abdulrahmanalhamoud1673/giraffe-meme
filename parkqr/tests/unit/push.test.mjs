import crypto from 'node:crypto';
import http from 'node:http';
import { SITE, makeKeys } from '../helpers.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ece = require('http_ece');
const { encryptPayload, vapidJwt, sendPush, validEndpoint, pushConfigured } = await import(SITE + 'functions/api/_push.js');
const keys = makeKeys();
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; console.log(c ? 'PASS' : 'FAIL', name); };

// a fake browser subscription (user agent keys)
const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
const authSecret = crypto.randomBytes(16);
const sub = { p256dh: ua.getPublicKey().toString('base64url'), auth: authSecret.toString('base64url') };

// 1) encryption round trip against an independent implementation
const msg = JSON.stringify({ title: 'يا نشمي', body: 'سيارتك مسكّرة عليّ، ممكن تحرّكها؟', url: '/inbox.html' });
const body = await encryptPayload(new TextEncoder().encode(msg), sub.p256dh, sub.auth);
const plain = ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: ua, authSecret });
check('encrypt -> http_ece decrypt (Arabic JSON)', plain.toString('utf8') === msg);
check('header: record size 4096 & 65-byte key', body[16] === 0 && body[17] === 0 && body[18] === 16 && body[19] === 0 && body[20] === 65);

// 2) a second message uses a fresh salt and key
const body2 = await encryptPayload(new TextEncoder().encode(msg), sub.p256dh, sub.auth);
check('fresh salt every time', Buffer.compare(Buffer.from(body.slice(0, 16)), Buffer.from(body2.slice(0, 16))) !== 0);

// 3) VAPID JWT verifies with the public key
const env = { VAPID_PUBLIC: keys.VAPID_PUBLIC, VAPID_PRIVATE: keys.VAPID_PRIVATE, VAPID_SUBJECT: 'https://yanashmi.com' };
const jwt = await vapidJwt(env, 'https://fcm.googleapis.com', 1000000);
const [h, c, s] = jwt.split('.');
const pub = Buffer.from(keys.VAPID_PUBLIC, 'base64url');
const keyObj = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }, format: 'jwk' });
const valid = crypto.verify('sha256', Buffer.from(h + '.' + c), { key: keyObj, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
check('VAPID JWT signature valid (ES256)', valid);
check('VAPID claims aud/exp/sub', claims.aud === 'https://fcm.googleapis.com' && claims.exp === 1000000 + 43200 && claims.sub === 'https://yanashmi.com');

// 4) full send to a local fake push service, then decrypt what it received
let got;
const srv = http.createServer((req, res) => { const chunks = []; req.on('data', d => chunks.push(d)); req.on('end', () => { got = { headers: req.headers, body: Buffer.concat(chunks) }; res.writeHead(201); res.end(); }); });
await new Promise(r => srv.listen(0, r));
const endpoint = 'http://127.0.0.1:' + srv.address().port + '/push/abc';
const status = await sendPush(env, { endpoint, ...sub }, { title: 't', body: 'مرحبا' });
check('push service answered 201', status === 201);
check('headers: vapid/ttl/encoding', /^vapid t=.+, k=.+$/.test(got.headers.authorization) && got.headers.ttl === '7200' && got.headers['content-encoding'] === 'aes128gcm' && got.headers.urgency === 'high');
const received = JSON.parse(ece.decrypt(got.body, { version: 'aes128gcm', privateKey: ua, authSecret }).toString('utf8'));
check('payload received and decrypted', received.body === 'مرحبا');
srv.close();
check('network failure returns 0', (await sendPush(env, { endpoint: 'http://127.0.0.1:1/x', ...sub }, { a: 1 })) === 0);

// 5) endpoint allow-list and config guard
check('allow fcm', validEndpoint('https://fcm.googleapis.com/fcm/send/abc'));
check('allow apple', validEndpoint('https://web.push.apple.com/Qabc'));
check('allow mozilla', validEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc'));
check('reject http', !validEndpoint('http://fcm.googleapis.com/x'));
check('reject random host', !validEndpoint('https://evil.example.com/x'));
check('reject internal', !validEndpoint('https://127.0.0.1/x'));
check('not configured without keys', !pushConfigured({}) && pushConfigured(env));
console.log(ok + '/' + n);
