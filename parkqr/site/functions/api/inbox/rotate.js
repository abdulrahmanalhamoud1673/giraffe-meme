import { json, rid, carByKey } from '../_shared.js';

// Owner only: "someone got my link". Makes a new secret key; the old one stops working everywhere at once,
// and every device registered for notifications is forgotten.
export async function onRequestPost({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  const key = rid(28);
  await env.DB.prepare('UPDATE cars SET owner_key = ? WHERE id = ?').bind(key, car.id).run();
  try { await env.DB.prepare('DELETE FROM push_subs WHERE car_id = ?').bind(car.id).run(); } catch (_) { /* table not created yet */ }
  try { await env.DB.prepare('DELETE FROM fcm_tokens WHERE car_id = ?').bind(car.id).run(); } catch (_) { /* table not created yet */ }
  return json({ ok: true, owner_key: key });
}
