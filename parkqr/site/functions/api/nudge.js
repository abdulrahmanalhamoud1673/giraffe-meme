import { json, NUDGE_PREFIX, NUDGE_AFTER_SECONDS, readJson } from './_shared.js';
import { escalate } from './_escalate.js';

// The sender (who holds the secret message id) can remind the owner once, after 3 minutes without a reply.
export async function onRequestPost(ctx) {
  try { return await handle({ request: ctx.request, env: ctx.env, waitUntil: ctx.waitUntil ? ctx.waitUntil.bind(ctx) : null }); }
  catch (err) { return json({ error: 'server', detail: String((err && err.message) || err).slice(0, 160) }, 500); }
}

async function handle({ request, env, waitUntil }) {
  let b;
  try { b = await readJson(request, 4096); } catch { return json({ error: 'bad_json' }, 400); }
  const id = String(b.id || '');
  const m = await env.DB.prepare("SELECT m.id, m.car_id, m.kind, m.reply, unixepoch() - m.created_at AS age, c.paused FROM messages m JOIN cars c ON c.id = m.car_id WHERE m.id = ? AND m.kind NOT LIKE 'nudge:%'").bind(id).first();
  if (!m) return json({ error: 'not_found' }, 404);
  if (m.reply) return json({ error: 'already_replied' }, 409);
  if (m.paused) return json({ error: 'paused' }, 423);
  if (m.age < NUDGE_AFTER_SECONDS) return json({ error: 'too_soon', wait: NUDGE_AFTER_SECONDS - m.age }, 429);
  const done = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE kind = ?').bind(NUDGE_PREFIX + id).first();
  if (done.n >= 1) return json({ error: 'already_nudged' }, 409);

  const jobs = await escalate(env, m);
  if (waitUntil) jobs.forEach((j) => waitUntil(j)); else await Promise.all(jobs);
  return json({ ok: true });
}
