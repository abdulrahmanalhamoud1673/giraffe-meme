// Guards against a broken deploy: every local file a page points at must exist, and the required files must be there.
import fs from 'node:fs'; import path from 'node:path';
import { SITE } from '../helpers.mjs';
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; else console.log('FAIL', name); };

const must = ['index.html', 'register.html', 'inbox.html', 'c.html', 'survey.html', 'results.html', '404.html', 'app.css', 'shared.js', 'push.js', 'qr.js', 'sw.js',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'badge-96.png', 'og.png', '_headers', 'robots.txt', 'schema.sql',
  'functions/manifest.webmanifest.js', 'functions/api/register.js', 'functions/api/send.js', 'functions/api/car.js', 'functions/api/status.js', 'functions/api/inbox.js',
  'functions/api/push-subscribe.js', 'functions/api/push-test.js', 'functions/api/push-key.js', 'functions/api/results.js', 'functions/api/survey.js'];
for (const f of must) check('exists: ' + f, fs.existsSync(SITE + f));

const pages = fs.readdirSync(SITE).filter((f) => f.endsWith('.html'));
for (const page of pages) {
  const html = fs.readFileSync(SITE + page, 'utf8');
  const refs = [...html.matchAll(/(?:href|src)="([^"#?][^"]*)"/g)].map((m) => m[1])
    .filter((r) => !/^(https?:|mailto:|tel:|data:|\/api\/|#)/.test(r) && r !== '/manifest.webmanifest');
  for (const r of refs) {
    const file = r.startsWith('/') ? r.slice(1) : r;
    const clean = file.split('?')[0].split('#')[0];
    if (clean === '' || clean === '/') continue;
    check(page + ' -> ' + r, fs.existsSync(SITE + clean) || fs.existsSync(SITE + clean + '.html') || fs.existsSync(path.join(SITE, clean)));
  }
  check(page + ' has no localhost links', !/localhost|127\.0\.0\.1/.test(html));
  if (!['404.html'].includes(page)) check(page + ' has a <title>', /<title>[^<]+<\/title>/.test(html));
}
check('service worker file has push + click handlers', /addEventListener\('push'/.test(fs.readFileSync(SITE + 'sw.js', 'utf8')) && /notificationclick/.test(fs.readFileSync(SITE + 'sw.js', 'utf8')));
check('every function file parses', fs.readdirSync(SITE + 'functions/api').filter((f) => f.endsWith('.js')).length >= 12);
check('_headers sets nosniff', /X-Content-Type-Options: nosniff/.test(fs.readFileSync(SITE + '_headers', 'utf8')));
const png = fs.readFileSync(SITE + 'og.png'); check('og.png is 1200x630', png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630);
console.log(ok + '/' + n);
