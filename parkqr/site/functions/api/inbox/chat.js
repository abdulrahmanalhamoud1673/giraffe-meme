import { json, carByKey } from '../_shared.js';
import { loadThread, view, postChat } from '../_chat.js';

// Owner side (web or app): GET thread, POST a text. Needs the owner key.
export async function onRequestGet({ request, env }) {
  const car = await carByKey(env, request); if (!car) return json({ error: 'unauthorized' }, 401);
  const t = await loadThread(env, new URL(request.url).searchParams.get('id'));
  return t && t.m.car_id === car.id ? view(t) : json({ error: 'not_found' }, 404);
}
export async function onRequestPost(ctx) {
  const car = await carByKey(ctx.env, ctx.request); if (!car) return json({ error: 'unauthorized' }, 401);
  return postChat(ctx, 'o', new URL(ctx.request.url).searchParams.get('id') || '', car);
}
