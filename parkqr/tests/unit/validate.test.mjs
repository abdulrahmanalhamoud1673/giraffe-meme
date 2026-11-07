import fs from 'node:fs'; import vm from 'node:vm';
import { SITE, makeDb } from '../helpers.mjs';
const V = await import(SITE + 'functions/api/_validate.js');
let ok = 0, n = 0; const check = (name, c) => { n++; if (c) ok++; else console.log('FAIL', name); };

// ---- names that must be accepted
for (const good of ['أحمد الخطيب', 'محمد عبدالله الحمود', 'عبد الرحمن الحمود', 'سارة المومني', 'Ahmad Khatib', 'Omar Al-Majali', "Rana O'Brien", 'أبو أحمد الحمود', 'لينا  الرفاعي', 'مَحمّد الخَطيب'])
  check('accept name: ' + good, V.validateName(good) === null);
// ---- names that must be rejected
const badNames = {
  '': 'name_required', '   ': 'name_required', 'أحمد': 'name_two_words', 'Ahmad': 'name_two_words', 'x': 'name_two_words',
  'أحمد 123': 'name_chars', 'Ahmad_Khatib': 'name_chars', 'أحمد @خطيب': 'name_chars', 'أحمد ١٢٣': 'name_chars', 'أحمد 😀': 'name_chars',
  'أ ب': 'name_short', 'A B': 'name_short', 'تجربة تجربة': 'name_fake', 'test test': 'name_fake', 'Test User': 'name_fake', 'اختبار فلان': 'name_fake',
  'اااااا ببببب': 'name_fake', 'asdf qwerty': 'name_fake', 'xxxx yyyy': 'name_fake', ['أحمد ' + 'ب'.repeat(25)]: 'name_long', ['أ'.repeat(61)]: 'name_long',
};
for (const [bad, code] of Object.entries(badNames)) check('reject name "' + bad.slice(0, 20) + '" -> ' + code, V.validateName(bad) === code);

// ---- phones
for (const good of ['0795551234', '+962795551234', '962 79 555 1234', '0777123987', '078-612-3987', '(079) 4412 906'])
  check('accept phone ' + good, !!V.validatePhone(good).phone);
const badPhones = { '12345': 'bad_phone', '0701234567': 'bad_phone', '0651234567': 'bad_phone', '079555123': 'bad_phone', '07955512345': 'bad_phone', 'abc': 'bad_phone', '': 'bad_phone',
  '0777777777': 'fake_phone', '0799999999': 'fake_phone', '0797979797': 'fake_phone', '0791234567': 'fake_phone', '0797654321': 'fake_phone', '0790000000': 'fake_phone', '0781111112': 'fake_phone' };
for (const [bad, code] of Object.entries(badPhones)) check('reject phone ' + bad + ' -> ' + code, V.validatePhone(bad).error === code);
check('phone normalised to +962', V.validatePhone('0795551234').phone === '+962795551234');

// ---- parity: the browser copy in shared.js must be exactly the server rules
const shared = fs.readFileSync(SITE + 'shared.js', 'utf8');
const block = shared.slice(shared.indexOf('/* VALIDATE:BEGIN'), shared.indexOf('/* VALIDATE:END */'));
const body = block.slice(block.indexOf('*/') + 3);
const serverSrc = fs.readFileSync(SITE + 'functions/api/_validate.js', 'utf8').replace(/export /g, '');
check('browser copy identical to server file', body.trim() === serverSrc.trim());
const ctx = {}; vm.createContext(ctx); vm.runInContext(body + ';this.validateName=validateName;this.validatePhone=validatePhone;', ctx);
const sample = [...Object.keys(badNames), 'أحمد الخطيب', 'Ahmad Khatib'];
check('browser and server agree on names', sample.every(s => ctx.validateName(s) === V.validateName(s)));
const phones = [...Object.keys(badPhones), '0795551234', '0777123987'];
check('browser and server agree on phones', phones.every(p => JSON.stringify(ctx.validatePhone(p)) === JSON.stringify(V.validatePhone(p))));
check('every error code has a message', ['name_required','name_two_words','name_chars','name_short','name_long','name_fake','bad_phone','fake_phone','phone_limit','consent_required','rate_limited'].every(k => new RegExp(k + ':').test(shared)));

// ---- API: register endpoint enforces it, with a real SQL database
const { db, DB } = makeDb();
const env = { DB, SALT: 's' };
const R = await import(SITE + 'functions/api/register.js');
let ipc = 0;
const reg = async (b) => { const r = await R.onRequestPost({ request: new Request('http://x/', { method: 'POST', body: JSON.stringify(b), headers: { 'cf-connecting-ip': '5.5.5.' + (ipc++ % 250), 'user-agent': 'u' + ipc } }), env }); return [r.status, await r.json()]; };
const base = { name: 'أحمد الخطيب', phone: '0795551234', consent: true };
let [s1, j1] = await reg(base); check('API accepts a real name + number', s1 === 200 && j1.token);
check('API stores the cleaned name and +962 number', db.prepare('SELECT name,phone FROM cars').get().name === 'أحمد الخطيب' && db.prepare('SELECT phone FROM cars').get().phone === '+962795551234');
check('API rejects single name', (await reg({ ...base, name: 'أحمد' }))[1].error === 'name_two_words');
check('API rejects digits in name', (await reg({ ...base, name: 'أحمد 2' }))[1].error === 'name_chars');
check('API rejects test name', (await reg({ ...base, name: 'test test' }))[1].error === 'name_fake');
check('API rejects fake phone', (await reg({ ...base, phone: '0777777777' }))[1].error === 'fake_phone');
check('API rejects non-Jordan number', (await reg({ ...base, phone: '0701234567' }))[1].error === 'bad_phone');
check('API still needs consent', (await reg({ ...base, consent: false }))[1].error === 'consent_required');
check('nothing invalid was saved', db.prepare('SELECT COUNT(*) n FROM cars').get().n === 1);
await reg({ ...base, name: 'أحمد الخطيب' }); await reg({ ...base, name: 'أحمد الخطيب' });
check('same number: 3 cars allowed', db.prepare('SELECT COUNT(*) n FROM cars WHERE phone=?').get('+962795551234').n === 3);
let [s4, j4] = await reg(base); check('4th car on the same number is refused', s4 === 429 && j4.error === 'phone_limit');
let [s5] = await reg({ ...base, phone: '0788612398' }); check('another number still works', s5 === 200);
console.log(ok + '/' + n);
