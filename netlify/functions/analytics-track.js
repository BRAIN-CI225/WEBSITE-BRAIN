/* ============================================================
   Netlify Function — analytics-track
   Réceptionne une page vue (POST JSON) envoyée en asynchrone
   par js/analytics.js et la persiste via RPC track_visit.

   Respect RGPD :
   - Aucune adresse IP n'est stockée.
   - Géolocalisation APPROXIMATIVE lue depuis les en-têtes
     Netlify (x-nf-country / x-nf-region / x-nf-city / tz).
   - Identifiant = anonymous_id généré côté client (aléatoire),
     jamais un email ni une donnée personnelle.

   Variables d'environnement :
     - SUPABASE_URL
     - SUPABASE_SERVICE_KEY (secrète)
   ============================================================ */

const sb = require('./_lib/supabase.js');

/* ---------- Noms de pays (code ISO 2 lettres) ---------- */
const COUNTRY_NAME = {
  CI: 'Côte d\'Ivoire', SN: 'Sénégal', CM: 'Cameroun', GH: 'Ghana', BF: 'Burkina Faso',
  ML: 'Mali', TG: 'Togo', BJ: 'Bénin', GN: 'Guinée', GQ: 'Guinée équatoriale',
  CD: 'RD Congo', CG: 'Congo', GA: 'Gabon', AO: 'Angola', NG: 'Nigéria',
  KE: 'Kenya', ET: 'Éthiopie', TZ: 'Tanzanie', UG: 'Ouganda', RW: 'Rwanda',
  ZA: 'Afrique du Sud', MA: 'Maroc', DZ: 'Algérie', TN: 'Tunisie', EG: 'Égypte',
  MG: 'Madagascar', NE: 'Niger', TD: 'Tchad', CF: 'Centrafrique',
  FR: 'France', DE: 'Allemagne', BE: 'Belgique', CH: 'Suisse', LU: 'Luxembourg',
  IT: 'Italie', ES: 'Espagne', PT: 'Portugal', GB: 'Royaume-Uni', UK: 'Royaume-Uni',
  NL: 'Pays-Bas', SE: 'Suède', NO: 'Norvège', DK: 'Danemark', IE: 'Irlande',
  US: 'États-Unis', CA: 'Canada'
};
const CONTINENT_BY_CC = {
  CI: 'Afrique', SN: 'Afrique', CM: 'Afrique', GH: 'Afrique', BF: 'Afrique',
  ML: 'Afrique', TG: 'Afrique', BJ: 'Afrique', GN: 'Afrique', GQ: 'Afrique',
  CD: 'Afrique', CG: 'Afrique', GA: 'Afrique', AO: 'Afrique', NG: 'Afrique',
  KE: 'Afrique', ET: 'Afrique', TZ: 'Afrique', UG: 'Afrique', RW: 'Afrique',
  ZA: 'Afrique', MA: 'Afrique', DZ: 'Afrique', TN: 'Afrique', EG: 'Afrique',
  MG: 'Afrique', NE: 'Afrique', TD: 'Afrique', CF: 'Afrique',
  FR: 'Europe', DE: 'Europe', ES: 'Europe', IT: 'Europe', GB: 'Europe',
  UK: 'Europe', BE: 'Europe', NL: 'Europe', PT: 'Europe', CH: 'Europe',
  AT: 'Europe', IE: 'Europe', LU: 'Europe', SE: 'Europe', NO: 'Europe',
  DK: 'Europe', FI: 'Europe', PL: 'Europe', CZ: 'Europe', RO: 'Europe',
  BG: 'Europe', GR: 'Europe', HU: 'Europe', SK: 'Europe', HR: 'Europe',
  RS: 'Europe', UA: 'Europe', RU: 'Europe',
  US: 'Amérique du Nord', CA: 'Amérique du Nord', MX: 'Amérique du Nord',
  BR: 'Amérique du Sud', AR: 'Amérique du Sud', CL: 'Amérique du Sud',
  CO: 'Amérique du Sud', PE: 'Amérique du Sud', UY: 'Amérique du Sud',
  CN: 'Asie', JP: 'Asie', IN: 'Asie', KR: 'Asie', SG: 'Asie', HK: 'Asie',
  TW: 'Asie', TH: 'Asie', VN: 'Asie', PH: 'Asie', ID: 'Asie', MY: 'Asie',
  AU: 'Océanie', NZ: 'Océanie'
};

function countryName(cc) {
  if (!cc) return null;
  return COUNTRY_NAME[String(cc).toUpperCase()] || String(cc).toUpperCase();
}
function continentOf(cc) {
  if (!cc) return null;
  return CONTINENT_BY_CC[String(cc).toUpperCase()] || 'Autre';
}

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
    console.error('[analytics-track] SUPABASE_URL ou SUPABASE_SERVICE_KEY manquant.');
    return json(500, { ok: false, error: 'Service analytics non configuré.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { ok: false, error: 'JSON invalide.' }); }

  const anonymousId = (body.anonymous_id || '').trim();
  const sessionId = (body.session_id || '').trim();
  const pageUrl = (body.page_url || '').trim();
  if (!anonymousId || !sessionId || !pageUrl) {
    return json(400, { ok: false, error: 'Champs requis manquants.' });
  }
  if (anonymousId.length > 64 || sessionId.length > 64 || pageUrl.length > 512) {
    return json(400, { ok: false, error: 'Champs trop longs.' });
  }

  /* Géoloc APPROXIMATIVE depuis les en-têtes Netlify (aucune IP stockée) */
  const h = event.headers || {};
  const cc = (h['x-nf-country'] || h['x-country'] || '').trim().toUpperCase() || null;
  const region = (h['x-nf-region'] || h['x-region'] || '').trim() || null;
  const city = (h['x-nf-city'] || h['x-city'] || '').trim() || null;
  const tz = (h['x-nf-timezone'] || h['x-timezone'] || h['timezone'] || '').trim() || null;

  /* Appareil / navigateur / OS envoyés par le client (derivés du user-agent) */
  const deviceType = ['desktop', 'mobile', 'tablet'].indexOf(body.device_type) !== -1 ? body.device_type : null;
  const browser = (body.browser || '').trim().slice(0, 40) || null;
  const os = (body.os || '').trim().slice(0, 40) || null;
  const language = (body.language || '').trim().slice(0, 20) || null;
  const referrer = (body.referrer || '').trim().slice(0, 512) || null;

  const utmSource = (body.utm_source || '').trim().slice(0, 120) || null;
  const utmMedium = (body.utm_medium || '').trim().slice(0, 120) || null;
  const utmCampaign = (body.utm_campaign || '').trim().slice(0, 160) || null;

  try {
    const res = await fetch(sb.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/track_visit', {
      method: 'POST',
      headers: { apikey: sb.SERVICE_KEY, Authorization: 'Bearer ' + sb.SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_anonymous_id: anonymousId,
        p_session_id: sessionId,
        p_page_url: pageUrl,
        p_page_title: (body.page_title || '').trim().slice(0, 300) || null,
        p_referrer: referrer,
        p_utm_source: utmSource,
        p_utm_medium: utmMedium,
        p_utm_campaign: utmCampaign,
        p_device_type: deviceType,
        p_browser: browser,
        p_os: os,
        p_language: language,
        p_country: countryName(cc),
        p_country_code: cc,
        p_region: region,
        p_city: city,
        p_continent: continentOf(cc),
        p_timezone: tz
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[analytics-track] RPC track_visit ' + res.status + ': ' + errText.slice(0, 400));
      return json(502, { ok: false, error: 'Enregistrement impossible.' });
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error('[analytics-track]', err);
    return json(500, { ok: false, error: 'Erreur serveur.' });
  }
};