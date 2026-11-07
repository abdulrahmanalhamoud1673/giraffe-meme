import { json } from './_shared.js';

// Public: the sender polls this (id is an unguessable random string) to see the owner's reply.
export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get('id') || '';
  const m = await env.DB.prepare('SELECT reply FROM messages WHERE id = ?').bind(id).first();
  if (!m) return json({ error: 'not_found' }, 404);
  return json({ reply: m.reply || null });
}
