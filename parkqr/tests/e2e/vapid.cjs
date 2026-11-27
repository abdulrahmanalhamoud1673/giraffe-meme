// The in-page VAPID generator makes a valid key pair (65-byte public point, 32-byte private) that the server's push code accepts.
const { chromium } = require('playwright'); const crypto = require('crypto');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ permissions: ['clipboard-read', 'clipboard-write'] }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/api/results', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, counts: {}, contacts: [], usage: { cars: {}, messages: {} }, exposed: ['VAPID_PRIVATE'] }) }));
  await p.goto('http://localhost:8788/results.html'); await p.fill('#k', 'any-key-for-this-mocked-test-00001'); await p.click('#kf button[type=submit], #kf .cta');
  await p.waitForSelector('#vapidBox:not([hidden])'); await p.click('#vGen'); await p.click('#vPub'); const pub = await p.evaluate(() => navigator.clipboard.readText()); await p.click('#vPriv'); const priv = await p.evaluate(() => navigator.clipboard.readText());
  const pb = Buffer.from(pub, 'base64url'), db = Buffer.from(priv, 'base64url');
  console.log('public is 65 bytes starting 0x04:', pb.length === 65 && pb[0] === 4, '| private is 32 bytes:', db.length === 32);
  const key = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', x: pb.subarray(1, 33).toString('base64url'), y: pb.subarray(33).toString('base64url'), d: priv }, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from('x'), { key, dsaEncoding: 'ieee-p1363' });
  const pubKey = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pb.subarray(1, 33).toString('base64url'), y: pb.subarray(33).toString('base64url') }, format: 'jwk' });
  console.log('the pair matches (signature verifies):', crypto.verify('sha256', Buffer.from('x'), { key: pubKey, dsaEncoding: 'ieee-p1363' }, sig));
  console.log('private key shown on the page:', await p.evaluate((v) => document.body.innerText.includes(v), priv), '| errs', errs); await b.close();
})();
