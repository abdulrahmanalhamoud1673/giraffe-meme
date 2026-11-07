import { OPTIONS } from './_shared.js';

export async function onRequestGet({ request, env }) {
  const auth = request.headers.get('authorization') || '';
  if (!env.ADMIN_KEY || auth !== 'Bearer ' + env.ADMIN_KEY) {
    return new Response('unauthorized', { status: 401 });
  }
  const total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM responses').first()).n;
  const counts = {};
  for (const key of Object.keys(OPTIONS)) {
    const { results } = await env.DB.prepare(`SELECT ${key} AS v, COUNT(*) AS n FROM responses GROUP BY ${key}`).all();
    counts[key] = Object.fromEntries(results.map(r => [r.v, r.n]));
  }
  const { results: contacts } = await env.DB.prepare("SELECT contact FROM responses WHERE contact != ''").all();
  return new Response(JSON.stringify({ total, counts, contacts: contacts.map(c => c.contact) }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
