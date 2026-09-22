/* ============================================================
   Netlify Function — notify-click
   Incrémente le compteur de clics d'une notification (POST JSON
   { notification_id }). Appelé de manière best-effort par sw.js.
   Public (pas d'auth) — seul l'incrément est possible.
   ============================================================ */

const sb = require('./_lib/supabase.js');

function json(status, data) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(data)
  };
}

exports.handler = async function (event) {
  if ((event.httpMethod || 'POST').toUpperCase() !== 'POST') {
    return json(405, { ok: false, error: 'Méthode non autorisée.' });
  }
  if (!sb.SUPABASE_URL || !sb.SERVICE_KEY) {
    return json(500, { ok: false, error: 'Service non configuré.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { ok: false, error: 'JSON invalide.' }); }

  const notificationId = (body.notification_id || '').trim();
  if (!notificationId) return json(400, { ok: false, error: 'notification_id manquant.' });

  try {
    const res = await fetch(sb.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/notify_click', {
      method: 'POST',
      headers: { apikey: sb.SERVICE_KEY, Authorization: 'Bearer ' + sb.SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_notification_id: notificationId })
    });
    if (!res.ok) return json(502, { ok: false, error: 'Incrément impossible.' });
    return json(200, { ok: true });
  } catch (err) {
    console.error('[notify-click]', err);
    return json(500, { ok: false, error: 'Erreur serveur.' });
  }
};