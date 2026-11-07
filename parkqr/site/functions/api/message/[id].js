import { json } from '../_shared.js';

// Public: the sender polls this (id is an unguessable random string) to see the owner's reply.
export async function onRequestGet({ params, env }) {
  const m = await env.DB.prepare('SELECT reply FROM messages WHERE id = ?').bind(params.id).first();
  if (!m) return json({ error: 'not_found' }, 404);
  return json({ reply: m.reply || null });
}
