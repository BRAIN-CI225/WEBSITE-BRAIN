/* ============================================================
   BRAIN — Lib Web Push (zéro dépendance, Node built-ins only)
   Implémente :
     - Signature JWT VAPID (ES256 / P-256)
     - Chiffrement RFC 8291 + RFC 8188 (aes128gcm)
     - Envoi vers l'endpoint de push (Push API)
   ⚠️ La clé privée VAPID vit UNIQUEMENT ici (env Netlify).
   ============================================================ */

const crypto = require('crypto');

const UTF8 = 'utf8';

function b64urlToBuf(s) {
  const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  return Buffer.from(b64 + pad, 'base64');
}
function bufToB64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ---------- HMAC / HKDF ---------- */
function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function hkdfExpand(prk, info, length) {
  const blocks = Math.ceil(length / 32);
  const okm = [];
  let t = Buffer.alloc(0);
  for (let i = 1; i <= blocks; i++) {
    t = hmac(prk, Buffer.concat([t, info, Buffer.from([i])]));
    okm.push(t);
  }
  return Buffer.concat(okm).slice(0, length);
}

/* ---------- Clés VAPID ---------- */
function loadVapidPrivateKey(privB64url) {
  const privBuf = b64urlToBuf(privB64url);
  if (privBuf.length !== 32) throw new Error('VAPID_PRIVATE_KEY invalide (32 octets attendus)');
  return privBuf;
}

/* ---------- JWT VAPID (ES256) ---------- */
function signVapidJwt({ privateKey, publicKey, subject, audience }) {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const claims = { aud: audience, exp: now + 12 * 3600, sub: subject || 'mailto:braincobusiness@gmail.com' };

  const enc = (o) => bufToB64url(Buffer.from(JSON.stringify(o), UTF8));
  const token = enc(header) + '.' + enc(claims);
  const tokenBuf = Buffer.from(token, UTF8);

  const pub = b64urlToBuf(publicKey); // 65 octets : 0x04 || X || Y
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY invalide (point non compressé attendu)');
  const x = pub.subarray(1, 33).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const y = pub.subarray(33, 65).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const d = b64urlToBuf(privateKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const jwk = { kty: 'EC', crv: 'P-256', x, y, d };
  const keyObject = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
  const signature = crypto.sign('sha256', tokenBuf, { key: keyObject, dsaEncoding: 'ieee-p1363' });

  return 'vapid t=' + token + ', k=' + bufToB64url(pub);
}

/* ---------- Chiffrement RFC 8291 / RFC 8188 (aes128gcm) ---------- */
function encryptPayload(payloadBuf, p256dhB64, authB64) {
  const salt = crypto.randomBytes(16);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const asPublicKey = ecdh.getPublicKey(); // 65 octets non compressés
  const uaPublicKey = b64urlToBuf(p256dhB64);
  const authSecret = b64urlToBuf(authB64);

  const sharedSecret = ecdh.computeSecret(uaPublicKey, null, null);

  // IKM (RFC 8291 §4.2)
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info' + '\u0000', UTF8),
    uaPublicKey,
    asPublicKey
  ]);
  const prkIk = hmac(sharedSecret, keyInfo);
  const ikm = hkdfExpand(prkIk, Buffer.alloc(0), 32);

  // Clés de contenu (RFC 8188)
  const prk = hmac(salt, ikm);
  const cek = hkdfExpand(prk, Buffer.from('Content-Encoding: aes128gcm\u0000', UTF8), 16);
  const nonce = hkdfExpand(prk, Buffer.from('Content-Encoding: nonce\u0000', UTF8), 12);

  // Enregistrement aes128gcm : délimiteur 0x02 + données, sans AAD (comme web-push).
  const internal = Buffer.concat([Buffer.from([0x02]), payloadBuf]);

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const enc = Buffer.concat([cipher.update(internal), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  const header = Buffer.concat([salt, rs, Buffer.from([0x00])]); // idlen = 0
  return Buffer.concat([header, enc]);
}

/* ---------- Envoi ---------- */
async function sendPush({ endpoint, p256dh, auth, payload, vapidPrivateKey, vapidPublicKey, vapidSubject }) {
  const origin = new URL(endpoint).origin;
  const authorization = signVapidJwt({
    privateKey: vapidPrivateKey,
    publicKey: vapidPublicKey,
    subject: vapidSubject,
    audience: origin
  });

  const body = encryptPayload(Buffer.from(JSON.stringify(payload), UTF8), p256dh, auth);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
      'Content-Length': String(body.length)
    },
    body
  });

  return {
    ok: res.ok,
    status: res.status,
    gone: res.status === 404 || res.status === 410,
    forbidden: res.status === 403,
    message: res.status === 201 || res.status === 202 || res.status === 204 ? null : (await res.text().catch(() => '')).slice(0, 300)
  };
}

module.exports = {
  sendPush,
  signVapidJwt,
  encryptPayload,
  loadVapidPrivateKey,
  b64urlToBuf,
  bufToB64url
};