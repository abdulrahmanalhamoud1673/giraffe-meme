// Abuse protection shared by the endpoints strangers can reach.
// A browser name is free to change, so every limit that matters is also tied to the network address.
import { sha, deviceHash } from './_shared.js';

// IPv6 hands every phone a whole /64, so the first four groups are the "address" there.
export function netOf(ip) {
  const s = String(ip || '').toLowerCase();
  if (!s.includes(':') || s.includes('.')) return s;
  const [head, tail = ''] = s.split('::');
  const a = head ? head.split(':') : [], b = tail ? tail.split(':') : [];
  const groups = s.includes('::') ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b] : a;
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':');
}

// Salted hashes only: no address is ever stored.
export async function sender(request, env) {
  return { dev: await deviceHash(request, env), net: 'ip:' + await sha(netOf(request.headers.get('cf-connecting-ip')) + '|' + (env.SALT || 'dev-salt')) };
}

// True when the owner blocked any of these (browser or network).
export async function isBlocked(env, carId, ...keys) {
  const list = keys.filter(Boolean);
  if (!list.length) return false;
  const row = await env.DB.prepare('SELECT 1 AS x FROM blocks WHERE car_id = ? AND device_hash IN (' + list.map(() => '?').join(',') + ')').bind(carId, ...list).first();
  return !!row;
}

let origins = false, hits = false;
export async function ensureOrigins(env) {
  if (origins) return;
  try { await env.DB.prepare('ALTER TABLE messages ADD COLUMN ip_hash TEXT').run(); } catch (_) { /* column already there */ }
  origins = true;
}

// Counts one try under `key` and says whether it is allowed. One statement, so parallel requests cannot slip past.
export async function takeHit(env, key, limit, windowSeconds) {
  if (!hits) {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS hits (k TEXT NOT NULL, expires_at INTEGER NOT NULL)').run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_hits ON hits(k, expires_at)').run();
    hits = true;
  }
  await env.DB.prepare('DELETE FROM hits WHERE expires_at < unixepoch()').run();
  const row = await env.DB.prepare('INSERT INTO hits (k, expires_at) SELECT ?, unixepoch() + ? WHERE (SELECT COUNT(*) FROM hits WHERE k = ? AND expires_at >= unixepoch()) < ? RETURNING k')
    .bind(key, windowSeconds, key, limit).first();
  return !!row;
}
