import { json, readJson } from './_shared.js';
import { createCar } from './_register.js';

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await readJson(request, 4096); } catch { return json({ error: 'bad_json' }, 400); }
  if (b.website) return json({ ok: true }); // honeypot
  return createCar(env, request, b);
}
