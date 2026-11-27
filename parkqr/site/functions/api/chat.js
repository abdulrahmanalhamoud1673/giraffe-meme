import { json } from './_shared.js';
import { loadThread, view, postChat } from './_chat.js';

// Sender side. The secret is the message id the sender got when sending (same as the status page).
export async function onRequestGet({ request, env }) {
  const t = await loadThread(env, new URL(request.url).searchParams.get('id'));
  return t ? view(t) : json({ error: 'not_found' }, 404);
}
export async function onRequestPost(ctx) {
  let id = '';
  try { id = new URL(ctx.request.url).searchParams.get('id') || ''; } catch { /* ignore */ }
  return postChat(ctx, 's', id, null);
}
