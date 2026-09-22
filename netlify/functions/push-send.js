/* ============================================================
   Netlify Function — push-send
   Envoi direct/immédiat d'une notification Web Push (POST JSON).

   Sécurité :
   - Vérifie la session admin via l'en-tête Authorization
     (token Supabase du super admin connecté au dashboard).
   - Re-vérifie l'appartenance à la table public.admins.
   - Ne lit JAMAIS la clé privée côté client : VAPID_PRIVATE_KEY est
     une variable d'environnement serveur (Netlify only).

   Variables d'environnement :
     - SUPABASE_URL, SUPABASE_SERVICE_KEY
     - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

   Corps (JSON) :
     { notification_id: 'uuid', force?: bool }
   La campagne doit exister en base (status 'scheduled' ou 'draft').
   ============================================================ */

const sb = require('./_lib/supabase.js');
const webpush = require('./_lib/webpush.js');

function json(status, data) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(data)
  };
}

/* ---------- Vérification de l'admin via Supabase Auth ---------- */
async function getAdminUser(bearer) {
  if (!bearer) return null;
  const token = bearer.replace(/^Bearer\s+/i, '');
  try {
    const res = await fetch(sb.SUPABASE_URL.replace(/\/+$/, '') + '/auth/v1/user', {
      headers: { apikey: sb.SERVICE_KEY, Authorization: 'Bearer ' + token }
    });
    if (!res.ok) return null;
    return (await res.json()) || null;
  } catch (e) {
    return null;
  }
}

async function isSuperAdmin(userId) {
  if (!userId) return false;
  try {
    const res = await fetch(
      sb.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/admins?user_id=eq.' + encodeURIComponent(userId) + '&select=id',
      { headers: { apikey: sb.SERVICE_KEY, Authorization: 'Bearer ' + sb.SERVICE_KEY } }
    );
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    return false;
  }
}

function worst(a, b) {
  return a.statusCode === 200 ? (b.statusCode === 200 ? a : b) : a;
}

exports.handler = async function (event) {
  if ((event.httpMethod || 'POST').toUpperCase() !== 'POST') {
    return json(405, { ok: false, error: 'Méthode non autorisée.' });
  }
  if (!sb.SUPABASE_URL || !sb.SERVICE_KEY || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.error('[push-send] Configuration serveur incomplète (Supabase ou VAPID).');
    return json(500, { ok: false, error: 'Service non configuré.' });
  }

  const h = event.headers || {};
  const bearer = h['authorization'] || h['Authorization'] || '';
  const adminUser = await getAdminUser(bearer);
  if (!adminUser || !(await isSuperAdmin(adminUser.id))) {
    return json(401, { ok: false, error: 'Non autorisé.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { ok: false, error: 'JSON invalide.' }); }

  const notificationId = (body.notification_id || '').trim();
  if (!notificationId) return json(400, { ok: false, error: 'notification_id manquant.' });

  /* Charge la campagne depuis la base */
  let notif;
  try {
    const rows = await sb.select('notifications?id=eq.' + encodeURIComponent(notificationId) + '&select=*');
    notif = Array.isArray(rows) ? rows[0] : null;
  } catch (e) {
    console.error('[push-send] select notifications :', e);
    return json(502, { ok: false, error: 'Lecture de la campagne impossible.' });
  }

  if (!notif) return json(404, { ok: false, error: 'Campagne introuvable.' });
  if (!body.force && notif.status === 'sent') {
    return json(409, { ok: false, error: 'Cette notification a déjà été envoyée.' });
  }
  if (notif.status === 'sending') {
    return json(409, { ok: false, error: 'Envoi en cours, veuillez réessayer dans un instant.' });
  }
  if (!notif.title) return json(400, { ok: false, error: 'La notification n\'a pas de titre.' });

  /* Marque la campagne comme en cours d'envoi */
  try {
    await fetch(sb.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/notifications?id=eq.' + encodeURIComponent(notificationId), {
      method: 'PATCH',
      headers: { apikey: sb.SERVICE_KEY, Authorization: 'Bearer ' + sb.SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'sending' })
    });
  } catch (e) {
    console.error('[push-send] PATCH sending :', e);
    return json(502, { ok: false, error: 'Mise à jour impossible.' });
  }

  /* Récupère les abonnements actifs */
  let subs;
  try {
    subs = await sb.select('push_subscriptions?is_active=eq.true&select=endpoint,p256dh,auth');
  } catch (e) {
    console.error('[push-send] select abonnements :', e);
    await sb.update('notifications?id=eq.' + encodeURIComponent(notificationId), { status: 'failed', last_error: 'lecture des abonnements' });
    return json(502, { ok: false, error: 'Lecture des abonnements impossible.' });
  }
  if (!Array.isArray(subs)) subs = [];

  const payload = {
    title: notif.title,
    message: notif.message || '',
    url: notif.url || '',
    image_url: notif.image_url || '',
    notification_id: notif.id
  };

  let sent = 0, failed = 0;
  const final = { ok: true };

  for (const sub of subs) {
    const r = await webpush.sendPush({
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      payload: JSON.stringify(payload),
      vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
      vapidSubject: process.env.VAPID_SUBJECT || 'mailto:braincobusiness@gmail.com'
    });
    if (r.ok) { sent++; }
    else {
      failed++;
      if (r.gone) {
        /* Endpoint mort (404/410) : désactive l'abonnement */
        try { await sb.update('push_subscriptions?endpoint=eq.' + encodeURIComponent(sub.endpoint), { is_active: false }); }
        catch (e) { /* non bloquant */ }
      } else if (r.forbidden) {
        /* 403 : VAPID invalide — on arrête, c'est une erreur de config */
        final.ok = false;
        final.error = 'Erreur de configuration push (403).';
        final.status = 502;
      }
    }
  }

  const status = !final.ok ? 'failed' : 'sent';
  const lastError = !final.ok ? ('Échec de configuration (' + failed + ' échecs, ' + sent + ' succès)') :
    (failed > 0 ? (sent + ' envoyé(s), ' + failed + ' échec(s)') : null);

  try {
    await sb.update('notifications?id=eq.' + encodeURIComponent(notificationId), {
      status,
      sent_count: sent,
      failed_count: failed,
      sent_at: new Date().toISOString(),
      last_error: lastError
    });
  } catch (e) {
    console.error('[push-send] PATCH final :', e);
  }

  return final.ok ? json(200, { ok: true, sent, failed }) : json(final.status, final);
};