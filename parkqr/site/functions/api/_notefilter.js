// Filter for the optional short note a sender can add. Rejects insults, sexual or flirting words, threats,
// requests for contact details, phone numbers and links, in Arabic dialects and English, including the usual tricks
// (diacritics, stretched letters, dots or spaces between letters, Arabic-Indic digits).
// The reason is never shown to the sender (it would teach them what to avoid).
export const MAX_NOTE = 80;

const norm = (t) => String(t || '').toLowerCase()
  .replace(/[ً-ٰٟـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/(.)\1+/g, '$1');                         // stretched letters: كلللب -> كلب
const n = (list) => new Set(list.map(norm));

// whole-word terms (also matched after the common prefixes و ف ب ل ك ال)
const WORDS = n(`كلب حمار حمير غبي غبيه اهبل هبل زفت حيوان خرا خره زباله قذر وسخ كس طيز زب عرص شرموط شرموطه قحبه منيوك متناك نيك نيكه ينيك سكس عاهر عاهره
  ملعون لعنه يلعن تفو حقير واطي نذل ديوث خنزير حثاله تيس معرص كسمك كسختك خول لوطي شاذ مجنون معتوه تافه
  اقتلك بقتلك اذبحك ذبحك احرقك احرق تهديد بضربك اضربك اكسرلك
  حبيبتي حبيبي احبك بحبك عشقك عشقتك جميله حلوه قمر جسمك مثيره بوسه بوس حضن تعارف عزباء خطيبتي
  رقمك رقمي واتس واتساب وتساب سناب انستا انستغرام تلغرام تليجرام تيكتوك خاص كلمني اتصل اتصلي
  fuck fucking shit bitch asshole dick pussy sex sexy nude porn idiot stupid whore slut bastard whatsapp snap snapchat insta instagram telegram tiktok`.split(/\s+/));
// long terms also caught when letters are separated or glued (ك.ل.ب / ابنالكلب)
const STRONG = n(`شرموط قحبه منيوك متناك كسمك كسختك كساختك يلعن ابنالكلب ابنالحرام ابنالقحبه fuck shit bitch asshole pussy whore bastard nude porn`.split(/\s+/));
const PREFIX = /^(?:وال|بال|فال|كال|لل|ال|و|ف|ب|ل|ك)/;

export function checkNote(text, max = MAX_NOTE) {
  const raw = String(text == null ? '' : text).trim();
  if (!raw) return { ok: true, note: '' };
  if (raw.length > max) return { ok: false, reason: 'long' };
  const digits = raw.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '');
  if (digits.length >= 6) return { ok: false, reason: 'number' };
  if (/https?:|www\.|\.com|\.net|\.org|\.jo\b|@|t\.me|wa\.me/i.test(raw)) return { ok: false, reason: 'link' };
  if (/[\u{1F300}-\u{1FAFF}❤♥]/u.test(raw) && /[\u{1F498}-\u{1F49F}\u{1F48B}\u{1F618}\u{1F60D}\u{1F970}\u{1F633}❤♥]/u.test(raw)) return { ok: false, reason: 'flirt' };
  const t = norm(raw).replace(/[^\p{L}\p{N}\s]/gu, (c) => (/[._\-*+~|\\/]/.test(c) ? '\u0001' : ' '));  // separators inside words become \u0001
  const compact = t.replace(/[\s\u0001]+/g, '');
  for (const s of STRONG) if (compact.includes(s)) return { ok: false, reason: 'strong' };
  const spaced = t.replace(/\u0001/g, ' ').split(/\s+/).filter(Boolean);
  const bad = (w) => WORDS.has(w) || WORDS.has(w.replace(PREFIX, '')) || (w.startsWith('يا') && WORDS.has(w.slice(2)));
  for (const w of spaced) if (bad(w)) return { ok: false, reason: 'word' };
  // single letters spaced out: ك ل ب
  let run = '';
  for (const w of [...spaced, '']) { if (w.length === 1) run += w; else { if (run.length >= 2 && bad(run)) return { ok: false, reason: 'spaced' }; run = ''; } }
  // letters split by dots/dashes: ك.ل.ب
  for (const w of t.split(/\s+/).filter(Boolean)) if (w.includes('\u0001') && bad(w.replace(/\u0001/g, ''))) return { ok: false, reason: 'dotted' };
  return { ok: true, note: raw.replace(/\s+/g, ' ') };
}
