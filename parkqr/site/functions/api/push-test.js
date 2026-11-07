import { json, carByKey } from './_shared.js';
import { notifyOwner, pushConfigured } from './_push.js';

// Owner-only: sends a test notification to all of the owner's registered devices.
export async function onRequestPost({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  if (!pushConfigured(env)) return json({ error: 'not_configured' }, 503);
  const r = await notifyOwner(env, car.id, { title: 'يا نشمي', body: 'تنبيه تجريبي: التنبيهات شغّالة على جهازك.', url: '/inbox.html', tag: 'yn-test' });
  return json({ ok: true, sent: r.sent, failed: r.failed });
}
