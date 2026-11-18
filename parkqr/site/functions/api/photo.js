import { json, carByKey } from './_shared.js';
import { ensurePhotoTable } from './_photo.js';

// Owner only: returns the photo of one of their own messages.
export async function onRequestGet({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  const id = new URL(request.url).searchParams.get('id') || '';
  await ensurePhotoTable(env);
  const row = await env.DB.prepare('SELECT data FROM photos WHERE msg_id = ? AND car_id = ?').bind(id, car.id).first();
  if (!row) return json({ error: 'not_found' }, 404);
  const bin = Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0));
  return new Response(bin, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
}
