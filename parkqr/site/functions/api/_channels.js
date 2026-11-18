// WhatsApp message and phone ring to the owner's own number. The sender never sees any number, and the owner only
// sees the service's number. Both are optional: nothing happens until the secrets below are set in Cloudflare.
//   WhatsApp (Meta Cloud API): WA_TOKEN, WA_PHONE_ID, WA_TEMPLATE (approved template with 2 text variables), WA_LANG (default "ar")
//   Ring (Twilio):             TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM
export const whatsappConfigured = (env) => Boolean(env.WA_TOKEN && env.WA_PHONE_ID && env.WA_TEMPLATE);
export const ringConfigured = (env) => Boolean(env.TWILIO_SID && env.TWILIO_TOKEN && env.TWILIO_FROM);

// "+962795551234" / "0795551234" -> "962795551234"
export function waNumber(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('962')) return d;
  if (d.startsWith('0')) return '962' + d.slice(1);
  return d.length === 9 ? '962' + d : '';
}

export async function ownerContact(env, carId) {
  return env.DB.prepare('SELECT phone, owner_key FROM cars WHERE id = ?').bind(carId).first();
}

export async function sendWhatsApp(env, car, text) {
  if (!whatsappConfigured(env) || !car) return false;
  const to = waNumber(car.phone); if (!to) return false;
  const base = env.SITE_URL || 'https://yanashmi.com';
  try {
    const r = await fetch('https://graph.facebook.com/v21.0/' + encodeURIComponent(env.WA_PHONE_ID) + '/messages', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.WA_TOKEN, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to, type: 'template',
        template: { name: env.WA_TEMPLATE, language: { code: env.WA_LANG || 'ar' }, components: [{ type: 'body', parameters: [{ type: 'text', text: text.slice(0, 200) }, { type: 'text', text: base + '/inbox.html#' + car.owner_key }] }] },
      }),
    });
    return r.ok;
  } catch { return false; }
}

// A short phone ring that does not need to be answered. If answered, a short spoken line is played.
export async function ringOwner(env, car) {
  if (!ringConfigured(env) || !car) return false;
  const to = waNumber(car.phone); if (!to) return false;
  const twiml = '<Response><Pause length="1"/><Say language="ar-SA">تنبيه من يا نشمي. افتح الواتساب.</Say></Response>';
  try {
    const r = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(env.TWILIO_SID) + '/Calls.json', {
      method: 'POST',
      headers: { authorization: 'Basic ' + btoa(env.TWILIO_SID + ':' + env.TWILIO_TOKEN), 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: '+' + to, From: env.TWILIO_FROM, Twiml: twiml, Timeout: '25' }).toString(),
    });
    return r.ok;
  } catch { return false; }
}
