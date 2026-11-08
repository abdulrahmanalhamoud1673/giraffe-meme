// Validation rules shared by the server and the browser.
// Keep this file free of imports: the same text (minus "export ") is copied into shared.js for instant feedback.
// The server is the authority; the browser copy only saves the person a round trip.

const NAME_OK = /^[ء-يً-ٰٟـٮ-ۓA-Za-z'’.\- ]+$/;
const NAME_MARKS = /[ً-ٰٟـ'’.\-]/g;
const PLACEHOLDER_WORDS = ['test', 'tester', 'testing', 'name', 'fullname', 'admin', 'user', 'demo', 'asd', 'asdf', 'asdfg', 'qwerty', 'xxx', 'abc', 'null', 'none', 'تجربة', 'تجربه', 'تست', 'اختبار', 'فلان', 'فلانة', 'الاسم', 'اسم', 'مجهول', 'مستخدم'];

export function normalizeName(raw) {
  return String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
}

// Returns null when the name looks like a real full name, otherwise an error code.
export function validateName(raw) {
  const name = normalizeName(raw);
  if (!name) return 'name_required';
  if (name.length > 60) return 'name_long';
  if (!NAME_OK.test(name)) return 'name_chars';          // letters only: no digits, emoji or symbols
  const words = name.split(' ');
  if (words.length < 2) return 'name_two_words';          // first name + family name at least
  for (const w of words) {
    const letters = w.replace(NAME_MARKS, '');
    if (letters.length < 2) return 'name_short';
    if (letters.length > 20) return 'name_long';
    if (/(.)\1{3,}/.test(letters)) return 'name_fake';    // "اااااا", "xxxx"
    if (PLACEHOLDER_WORDS.includes(letters.toLowerCase())) return 'name_fake';
  }
  return null;
}

// Arabic keyboards type ٠١٢٣٤٥٦٧٨٩ (and Persian ۰۱۲۳۴۵۶۷۸۹): turn them into 0-9.
export function toAsciiDigits(s) {
  return String(s == null ? '' : s).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) & 15));
}

export function normalizeJoPhone(input) {
  const digits = toAsciiDigits(input).replace(/[\s\-()]/g, '');
  const m = digits.match(/^(?:\+?962|0)?(7[789]\d{7})$/);   // Zain 077, Orange 078, Umniah 079
  return m ? '+962' + m[1] : null;
}

function hasRun(s, n) {
  let up = 1, down = 1;
  for (let i = 1; i < s.length; i++) {
    const d = s.charCodeAt(i) - s.charCodeAt(i - 1);
    up = d === 1 ? up + 1 : 1;
    down = d === -1 ? down + 1 : 1;
    if (up >= n || down >= n) return true;
  }
  return false;
}

// Format and "does it look made up?" checks. This cannot prove the person owns the number: only a code sent to it can.
export function validatePhone(input) {
  const phone = normalizeJoPhone(input);
  if (!phone) return { error: 'bad_phone' };
  const sub = phone.slice(-7);
  if (new Set(sub.split('')).size <= 2) return { error: 'fake_phone' };   // 0777777777, 0797979797
  if (hasRun(sub, 6)) return { error: 'fake_phone' };                      // 1234567, 7654321
  return { phone };
}
