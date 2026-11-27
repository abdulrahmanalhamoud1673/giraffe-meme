import { rid, MSG_TEXT, NUDGE_PREFIX, URGENT_KINDS } from './_shared.js';
import { notifyOwner } from './_push.js';
import { ownerContact, sendWhatsApp, ringOwner, whatsappConfigured, ringConfigured } from './_channels.js';

// Second alert for a message nobody answered: push again, WhatsApp reminder, and a phone ring (when those are set up).
// Returns the promises so the caller can keep them alive with waitUntil. Never throws.
export async function escalate(env, m) {
  const first = await env.DB.prepare('INSERT INTO messages (id, car_id, kind) SELECT ?1, ?2, ?3 WHERE NOT EXISTS (SELECT 1 FROM messages WHERE kind = ?3) RETURNING id').bind(rid(14), m.car_id, NUDGE_PREFIX + m.id).first();
  if (!first) return [];
  const text = (MSG_TEXT[m.kind] || '') + ' (تذكير)';
  const tell = notifyOwner(env, m.car_id, { title: 'تذكير: يا نشمي', body: text, url: '/inbox.html', tag: 'yn-' + m.id, urgent: URGENT_KINDS.includes(m.kind) }).catch(() => {});
  const more = (whatsappConfigured(env) || ringConfigured(env))
    ? ownerContact(env, m.car_id).then((c) => Promise.all([ringOwner(env, c), sendWhatsApp(env, c, text)])).catch(() => {})
    : Promise.resolve();
  return [tell, more];
}
