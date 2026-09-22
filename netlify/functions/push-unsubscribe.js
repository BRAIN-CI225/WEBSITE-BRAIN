/* ============================================================
   Netlify Function — push-unsubscribe
   Désactive l'abonnement Web Push du visiteur (POST JSON avec
   { endpoint }) via RPC deactivate_push_subscription.
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
    console.error('[push-unsubscribe] SUPABASE_URL ou SUPABASE_SERVICE_KEY manquant.');
    return json(500, { ok: false, error: 'Service non configuré.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { ok: false, error: 'JSON invalide.' }); }

  const endpoint = (body.endpoint || '').trim();
  if (!endpoint || endpoint.length > 512) {
    return json(400, { ok: false, error: 'Endpoint manquant.' });
  }

  try {
    const res = await fetch(sb.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/deactivate_push_subscription', {
      method: 'POST',
      headers: { apikey: sb.SERVICE_KEY, Authorization: 'Bearer ' + sb.SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_endpoint: endpoint })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[push-unsubscribe] RPC deactivate ' + res.status + ': ' + errText.slice(0, 400));
      return json(502, { ok: false, error: 'Désinscription impossible.' });
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error('[push-unsubscribe]', err);
    return json(500, { ok: false, error: 'Erreur serveur.' });
  }
};