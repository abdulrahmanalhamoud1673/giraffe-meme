export const OPTIONS = {
  age: ['under25', '25-34', '35-44', '45+'],
  city: ['amman', 'irbid', 'zarqa', 'other'],
  has_car: ['yes', 'no'],
  freq: ['weekly', 'monthly', 'rarely', 'never'],
  habit: ['honk', 'ask', 'note', 'wait', 'other'],
  would_use: ['sure', 'probably', 'maybe', 'no'],
  sticker_price: ['0', '1-2', '3-5', '5+'],
  sub_price: ['0', '3-5', '5-10', '10+'],
  worry: ['privacy', 'spam', 'adoption', 'other'],
};

export const MSG_KINDS = ['block', 'urgent', 'lights', 'open', 'fault', 'hit', 'thanks'];
export const REPLY_KINDS = ['2', '5', '10', 'cant'];

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alike characters
export function rid(len) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}

export async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export async function deviceHash(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  const ua = request.headers.get('user-agent') || '';
  return sha(ip + '|' + ua + '|' + (env.SALT || 'dev-salt'));
}

export { normalizeJoPhone } from './_validate.js';

export async function carByKey(env, request) {
  const auth = request.headers.get('authorization') || '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (key.length < 16) return null;
  return env.DB.prepare('SELECT * FROM cars WHERE owner_key = ?').bind(key).first();
}

// Text shown in the push notification (kept in sync with MSG in shared.js)
export const MSG_TEXT = {
  block: 'سيارتك مسكّرة عليّ، ممكن تحرّكها؟',
  urgent: 'أنا مستعجل، رجاءً بأسرع وقت',
  lights: 'الأضواء شغالة',
  open: 'الشباك أو الصندوق مفتوح',
  fault: 'في إشي غلط بسيارتك (دولاب منفّس / تسريب)',
  hit: 'سيارتك تتحرك أو تعرضت لضربة',
  thanks: 'شكراً، حرّكتها',
};

// Messages that should look and feel urgent on the owner's phone.
export const URGENT_KINDS = ['hit', 'urgent'];
// A reminder is stored as a row whose kind is "nudge:<original message id>" (no schema change needed).
export const NUDGE_PREFIX = 'nudge:';
export const NUDGE_AFTER_SECONDS = 180;
