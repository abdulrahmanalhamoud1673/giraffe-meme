// Photos for problem reports (hit, fault, open window, lights on). The photo must be taken live with the camera:
// the page uses getUserMedia (no gallery picker), and the server checks that it is a real, small JPEG and,
// when Cloudflare Workers AI is connected as `AI`, that it shows something car-related.
export const PHOTO_KINDS = ['hit', 'fault', 'open', 'lights'];
export const MAX_PHOTO_BYTES = 220 * 1024;
export const PHOTO_KEEP_SECONDS = 7 * 86400;

let ensured = false;
export async function ensurePhotoTable(env) {
  if (ensured) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS photos (msg_id TEXT PRIMARY KEY, car_id TEXT NOT NULL, data TEXT NOT NULL, verdict TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()))').run();
  ensured = true;
}

const PREFIX = 'data:image/jpeg;base64,';
// Returns { ok, b64, bytes } or { ok:false }
export function parsePhoto(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PREFIX)) return { ok: false };
  const b64 = dataUrl.slice(PREFIX.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64) || b64.length > MAX_PHOTO_BYTES * 1.4) return { ok: false };
  let bytes;
  try { bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); } catch { return { ok: false }; }
  if (bytes.length < 2000 || bytes.length > MAX_PHOTO_BYTES) return { ok: false };
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9)) return { ok: false };
  return { ok: true, b64, bytes };
}

const CAR_WORDS = /car|cab|taxi|van\b|minivan|wagon|jeep|limousine|convertible|racer|pickup|truck|vehicle|bus\b|minibus|grille|wheel|bumper|mirror|windshield|windscreen|headlight|dashboard|speedometer|odometer|go-kart|tow|moving|police|ambulance|trailer|tractor|motor|scooter|license|parking|street sign|traffic|Model T|steering|seat belt|tire|snowplow|garbage|fire engine|golfcart|cab/i;

// 'ok' | 'unrelated' | 'unchecked'. Fails open: an AI problem never blocks a real person.
export async function checkPhoto(env, bytes) {
  if (!env.AI || typeof env.AI.run !== 'function') return 'unchecked';
  try {
    const out = await env.AI.run('@cf/microsoft/resnet-50', { image: Array.from(bytes) });
    const top = (Array.isArray(out) ? out : []).slice().sort((a, b) => b.score - a.score).slice(0, 5);
    if (!top.length) return 'unchecked';
    if (top.some((t) => CAR_WORDS.test(String(t.label)))) return 'ok';
    return top[0].score >= 0.6 ? 'unrelated' : 'unchecked';
  } catch { return 'unchecked'; }
}
