import { json, carByKey } from '../_shared.js';

// Owner only: deletes the account and everything that belongs to it (messages, photos, notes, devices, blocks, interest, source).
export async function onRequestPost({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  const id = car.id;
  const run = async (sql) => { try { await env.DB.prepare(sql).bind(id).run(); } catch (_) { /* table not created yet */ } };
  await run('DELETE FROM chat WHERE msg_id IN (SELECT id FROM messages WHERE car_id = ?)');
  await run('DELETE FROM photos WHERE car_id = ?');
  await run('DELETE FROM notes WHERE car_id = ?');
  await run("DELETE FROM messages WHERE kind LIKE 'nudge:%' AND car_id = ?");
  await run('DELETE FROM messages WHERE car_id = ?');
  await run('DELETE FROM push_subs WHERE car_id = ?');
  await run('DELETE FROM fcm_tokens WHERE car_id = ?');
  await run('DELETE FROM blocks WHERE car_id = ?');
  await run('DELETE FROM interests WHERE car_id = ?');
  await run('DELETE FROM sources WHERE car_id = ?');
  await run('DELETE FROM accounts WHERE car_id = ?');
  await env.DB.prepare('DELETE FROM cars WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
