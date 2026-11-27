import { json } from './_shared.js';
import { ensureChat } from './_extra.js';
import { ensurePhotoTable } from './_photo.js';

// Sender side: a picture sent in the chat of the message the sender holds the id of (?id=<message id>&c=<chat id>).
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  await ensureChat(env); await ensurePhotoTable(env);
  const row = await env.DB.prepare('SELECT p.data FROM chat c JOIN photos p ON p.msg_id = c.id WHERE c.id = ? AND c.msg_id = ? AND c.photo = 1').bind(u.searchParams.get('c') || '', u.searchParams.get('id') || '').first();
  if (!row) return json({ error: 'not_found' }, 404);
  return new Response(Uint8Array.from(atob(row.data), (ch) => ch.charCodeAt(0)), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" } });
}
