/* ============================================================
   Netlify Function (scheduled) — push-queue
   Exécutée par le planificateur Netlify (voir netlify.toml
   [functions."push-queue"] schedule).
   Envoie les notifications en statut 'scheduled' dont
   scheduled_for est atteint ou dépassé.

   Idempotent : protégé contre les exécutions simultanées par
   bascule initiale sur 'sending' (cf. push-send.js).

   Variables d'environnement :
     - SUPABASE_URL, SUPABASE_SERVICE_KEY
     - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
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

exports.handler = async function (event) {
  if (!sb.SUPABASE_URL || !sb.SERVICE_KEY || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.error('[push-queue] Configuration serveur incomplète.');
    return json(500, { ok: false, error: 'Service non configuré.' });
  }

  /* Notifications programmées, échues, pas encore lancées */
  let due;
  try {
    due = await sb.select(
      'notifications?status=eq.scheduled&scheduled_for=lte.' + encodeURIComponent(new Date().toISOString()) + '&select=*'
    );
  } catch (e) {
    console.error('[push-queue] select échues :', e);
    return json(502, { ok: false, error: 'Lecture impossible.' });
  }
  if (!Array.isArray(due) || due.length === 0) {
    return json(200, { ok: true, sent: 0, failed: 0 });
  }

  let totalSent = 0, totalFailed = 0;

  for (const notif of due) {
    /* Bascule atomique-ish : sending → ce runner s'en occupe */
    try {
      const res = await fetch(sb.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/notifications?id=eq.' + encodeURIComponent(notif.id), {
        method: 'PATCH',
        headers: { apikey: sb.SERVICE_KEY, Authorization: 'Bearer ' + sb.SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'sending' })
      });
      if (!res.ok) { console.error('[push-queue] bascule sending échouée', notif.id); continue; }
    } catch (e) {
      console.error('[push-queue] bascule sending (réseau)', notif.id, e);
      continue;
    }

    let subs;
    try { subs = await sb.select('push_subscriptions?is_active=eq.true&select=endpoint,p256dh,auth'); }
    catch (e) {
      console.error('[push-queue] select abonnements :', e);
      await sb.update('notifications?id=eq.' + encodeURIComponent(notif.id), { status: 'failed', last_error: 'lecture des abonnements' });
      continue;
    }
    if (!Array.isArray(subs)) subs = [];

    const payload = {
      title: notif.title,
      message: notif.message || '',
      url: notif.url || '',
      image_url: notif.image_url || '',
      notification_id: notif.id
    };

    let sent = 0, failed = 0, fatal = false;

    for (const sub of subs) {
      try {
        const r = await webpush.sendPush({
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          payload: JSON.stringify(payload),
          vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
          vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
          vapidSubject: process.env.VAPID_SUBJECT || 'mailto:braincobusiness@gmail.com'
        });
        if (r.ok) sent++;
        else {
          failed++;
          if (r.gone) {
            try { await sb.update('push_subscriptions?endpoint=eq.' + encodeURIComponent(sub.endpoint), { is_active: false }); }
            catch (e) { /* non bloquant */ }
          } else if (r.forbidden) { fatal = true; }
        }
      } catch (e) {
        failed++;
        console.error('[push-queue] envoi', notif.id, e);
      }
    }

    const status = fatal ? 'failed' : 'sent';
    try {
      await sb.update('notifications?id=eq.' + encodeURIComponent(notif.id), {
        status,
        sent_count: sent,
        failed_count: failed,
        sent_at: new Date().toISOString(),
        last_error: fatal ? 'Échec de configuration (403).' : (failed > 0 ? (sent + ' envoyé(s), ' + failed + ' échec(s)') : null)
      });
    } catch (e) {
      console.error('[push-queue] PATCH final :', e);
    }

    totalSent += sent;
    totalFailed += failed;
  }

  return json(200, { ok: true, sent: totalSent, failed: totalFailed });
};