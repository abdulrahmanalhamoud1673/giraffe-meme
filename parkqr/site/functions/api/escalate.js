import { json, NUDGE_PREFIX } from './_shared.js';
import { escalate } from './_escalate.js';
import { sha256Hex, timingSafeEqual } from './_security.js';

// Called every minute by the small cron worker (see cron-worker/). Sends the second alert (and the ring) for messages
// that are 2 to 15 minutes old with no reply and no reminder yet, even if the sender closed the page.
export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const key = env.CRON_KEY ? String(env.CRON_KEY) : '';
  if (key.length < 20) return json({ error: 'not_configured' }, 503);
  const got = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
  if (!timingSafeEqual(await sha256Hex(got), await sha256Hex(key))) return json({ error: 'unauthorized' }, 401);
  const { results } = await env.DB.prepare(
    "SELECT m.id, m.car_id, m.kind FROM messages m JOIN cars c ON c.id = m.car_id WHERE m.kind NOT LIKE 'nudge:%' AND m.reply IS NULL AND c.paused = 0 AND m.created_at BETWEEN unixepoch() - 900 AND unixepoch() - 120 AND NOT EXISTS (SELECT 1 FROM messages n WHERE n.kind = ('nudge:' || m.id)) LIMIT 20").all();
  let n = 0;
  for (const m of results) {
    const jobs = await escalate(env, m);
    if (ctx.waitUntil) jobs.forEach((j) => ctx.waitUntil(j)); else await Promise.all(jobs);
    n++;
  }
  return json({ ok: true, escalated: n });
}
