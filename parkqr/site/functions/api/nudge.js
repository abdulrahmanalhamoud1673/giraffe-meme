import { json, rid, MSG_TEXT, NUDGE_PREFIX, NUDGE_AFTER_SECONDS, URGENT_KINDS } from './_shared.js';
import { notifyOwner } from './_push.js';

// The sender (who holds the secret message id) can remind the owner once, after 3 minutes without a reply.
export async function onRequestPost(ctx) {
  try { return await handle({ request: ctx.request, env: ctx.env, waitUntil: ctx.waitUntil ? ctx.waitUntil.bind(ctx) : null }); }
  catch (err) { return json({ error: 'server', detail: String((err && err.message) || err).slice(0, 160) }, 500); }
}

async function handle({ request, env, waitUntil }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const id = String(b.id || '');
  const m = await env.DB.prepare("SELECT m.id, m.car_id, m.kind, m.reply, unixepoch() - m.created_at AS age, c.paused FROM messages m JOIN cars c ON c.id = m.car_id WHERE m.id = ? AND m.kind NOT LIKE 'nudge:%'").bind(id).first();
  if (!m) return json({ error: 'not_found' }, 404);
  if (m.reply) return json({ error: 'already_replied' }, 409);
  if (m.paused) return json({ error: 'paused' }, 423);
  if (m.age < NUDGE_AFTER_SECONDS) return json({ error: 'too_soon', wait: NUDGE_AFTER_SECONDS - m.age }, 429);
  const done = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE kind = ?').bind(NUDGE_PREFIX + id).first();
  if (done.n >= 1) return json({ error: 'already_nudged' }, 409);

  await env.DB.prepare('INSERT INTO messages (id, car_id, kind) VALUES (?,?,?)').bind(rid(14), m.car_id, NUDGE_PREFIX + id).run();
  const tell = notifyOwner(env, m.car_id, { title: 'تذكير: يا نشمي', body: (MSG_TEXT[m.kind] || '') + ' (تذكير)', url: '/inbox.html', tag: 'yn-' + id, urgent: URGENT_KINDS.includes(m.kind) }).catch(() => {});
  if (waitUntil) waitUntil(tell); else await tell;
  return json({ ok: true });
}
