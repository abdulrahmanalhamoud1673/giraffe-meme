import { json } from './_shared.js';

// Public: the VAPID public key the browser needs to subscribe.
export async function onRequestGet({ env }) {
  if (!env.VAPID_PUBLIC) return json({ error: 'not_configured' }, 503);
  return json({ key: env.VAPID_PUBLIC });
}
