/* ============================================================
   Netlify Function — push-subscribe
   Sauvegarde l'abonnement Web Push du visiteur (POST JSON).
   Stoque uniquement les informations nécessaires à l'envoi
   (endpoint + touches VAPID). Aucune IP ni donnée personnelle.

   Variables d'environnement :
     - SUPABASE_URL
     - SUPABASE_SERVICE_KEY (secrète)
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
    console.error('[push-subscribe] SUPABASE_URL ou SUPABASE_SERVICE_KEY manquant.');
    return json(500, { ok: false, error: 'Service non configuré.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { ok: false, error: 'JSON invalide.' }); }

  const endpoint = (body.endpoint || '').trim();
  const p256dh = (body.keys && body.keys.p256dh || '').trim();
  const auth = (body.keys && body.keys.auth || '').trim();

  if (!endpoint || !p256dh || !auth) {
    return json(400, { ok: false, error: 'Abonnement incomplet (endpoint, p256dh, auth).' });
  }
  if (endpoint.length > 512 || !/^https:\/\//.test(endpoint)) {
    return json(400, { ok: false, error: 'Endpoint invalide.' });
  }
  if (p256dh.length > 128 || auth.length > 128) {
    return json(400, { ok: false, error: 'Clés invalides.' });
  }

  const h = event.headers || {};
  const cc = (h['x-nf-country'] || '').trim().toUpperCase() || null;
  const ua = (h['user-agent'] || h['User-Agent'] || '').slice(0, 300) || null;

  const browser = (body.browser || '')
    .charAt(0).toUpperCase() + (body.browser || '').slice(1).toLowerCase();

  const deviceType = ['mobile', 'tablet'].indexOf(body.device_type) !== -1 ? body.device_type : 'desktop';

  try {
    const res = await fetch(sb.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/upsert_push_subscription', {
      method: 'POST',
      headers: { apikey: sb.SERVICE_KEY, Authorization: 'Bearer ' + sb.SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_endpoint: endpoint,
        p_p256dh: p256dh,
        p_auth: auth,
        p_user_agent: ua,
        p_device_type: deviceType,
        p_browser: browser.slice(0, 40) || null,
        p_language: (h['accept-language'] || '').slice(0, 20) || null,
        p_country: null,
        p_country_code: cc
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[push-subscribe] RPC upsert ' + res.status + ': ' + errText.slice(0, 400));
      return json(502, { ok: false, error: 'Enregistrement impossible.' });
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error('[push-subscribe]', err);
    return json(500, { ok: false, error: 'Erreur serveur.' });
  }
};