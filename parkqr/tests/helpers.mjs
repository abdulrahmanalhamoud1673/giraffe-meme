import fs from 'node:fs';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export const SITE = new URL('../site/', import.meta.url).pathname;

// A throw-away VAPID key pair (public key = 65-byte uncompressed point, private = 32-byte d), both base64url.
export function makeKeys() {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]);
  return { VAPID_PUBLIC: pub.toString('base64url'), VAPID_PRIVATE: jwk.d };
}

// An in-memory SQLite database with the real schema, wrapped to look like Cloudflare D1.
export function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(SITE + 'schema.sql', 'utf8'));
  const DB = {
    prepare: (sql) => {
      const st = db.prepare(sql); let a = [];
      const o = { bind: (...x) => { a = x; return o }, run: async () => { st.run(...a); return {} }, first: async () => st.get(...a) ?? null, all: async () => ({ results: st.all(...a) }) };
      return o;
    },
  };
  return { db, DB };
}
