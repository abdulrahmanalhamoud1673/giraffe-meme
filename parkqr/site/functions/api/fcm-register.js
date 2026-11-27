import { json, carByKey, readJson } from './_shared.js';
import { ensureFcmTable, fcmConfigured, MAX_APP_DEVICES } from './_fcm.js';

// Owner only: the app registers (or, with remove:true, forgets) the address Google gave this phone.
// `active` tells the app whether instant notifications really work, so it knows if it still has to check by itself.
export async function onRequestPost({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  let b; try { b = await readJson(request, 4096); } catch { return json({ error: 'bad_json' }, 400); }
  const token = String(b.token || '');
  if (!/^[A-Za-z0-9_:-]{20,400}$/.test(token)) return json({ error: 'bad_token' }, 400);
  await ensureFcmTable(env);
  if (b.remove) {
    await env.DB.prepare('DELETE FROM fcm_tokens WHERE token = ? AND car_id = ?').bind(token, car.id).run();
    return json({ ok: true, active: false });
  }
  // a phone belongs to the account that registered it last
  await env.DB.prepare('INSERT INTO fcm_tokens (token, car_id) VALUES (?,?) ON CONFLICT(token) DO UPDATE SET car_id = excluded.car_id, created_at = unixepoch()').bind(token, car.id).run();
  await env.DB.prepare('DELETE FROM fcm_tokens WHERE car_id = ?1 AND token NOT IN (SELECT token FROM fcm_tokens WHERE car_id = ?1 ORDER BY created_at DESC, rowid DESC LIMIT ?2)').bind(car.id, MAX_APP_DEVICES).run();
  return json({ ok: true, active: fcmConfigured(env) });
}
