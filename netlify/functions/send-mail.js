/* ============================================================
   Netlify Function — Envoi d'email via Resend
   Point d'entrée : POST /.netlify/functions/send-mail
   Accepte application/json ET application/x-www-form-urlencoded
   (repli sans JavaScript du formulaire de contact).
   Variables d'environnement :
     - RESEND_API_KEY  (obligatoire, secrète)
     - CONTACT_TO      (destinataire, défaut : braincobusiness@gmail.com)
     - RESEND_FROM     (expéditeur vérifié sur Resend,
                        défaut : BRAIN <onboarding@resend.dev>)
   ============================================================ */

function json(status, data) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(data)
  };
}

function parse(event) {
  var ct = (event.headers && (event.headers['content-type'] || event.headers['Content-Type'])) || '';
  var raw = event.body || '';
  if (ct.indexOf('application/json') !== -1) {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  var out = {};
  try {
    var params = new URLSearchParams(raw);
    params.forEach(function (v, k) { out[k] = v; });
    return out;
  } catch (e) {
    var pairs = raw.split('&');
    pairs.forEach(function (p) {
      var kv = p.split('=');
      out[decodeURIComponent(kv[0] || '')] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
    });
    return out;
  }
}

exports.handler = async function (event) {
  if ((event.httpMethod || 'POST').toUpperCase() !== 'POST') {
    return json(405, { ok: false, error: 'Méthode non autorisée.' });
  }

  var apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[send-mail] RESEND_API_KEY non définie.');
    return json(500, { ok: false, error: 'Service mail non configuré.' });
  }

  var f = parse(event) || {};
  var honey = (f._honey || f.company || '').trim();
  if (honey) return json(200, { ok: true, ignored: true });

  var name = (f.nom || f.name || '').trim();
  var company = (f.entreprise || f.company || '').trim();
  var email = (f.email || '').trim();
  var phone = (f.telephone || f.phone || '').trim();
  var service = (f.service || '').trim();
  var budget = (f.budget || '').trim();
  var message = (f.message || '').trim();
  var subject = (f._subject || '').trim();

  if (!name) return json(400, { ok: false, error: 'Veuillez indiquer votre nom.' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { ok: false, error: 'Veuillez indiquer un email valide.' });
  }
  if (!message || message.length < 10) {
    return json(400, { ok: false, error: 'Votre message est trop court (10 caractères minimum).' });
  }

  var lines = [];
  if (company) lines.push('Entreprise : ' + company);
  if (phone) lines.push('Téléphone : ' + phone);
  if (service) {
    var services = {
      branding: 'Identité visuelle & Branding',
      web: 'Sites Web & E-commerce',
      social: 'Community Management',
      design: 'Design Graphique & Print',
      films: 'Films Publicitaires',
      live: 'Captation & Live',
      digital: "Digitalisation d'entreprise",
      autre: 'Autre / Projet global'
    };
    lines.push('Service recherché : ' + (services[service] || service));
  }
  if (budget) {
    var budgets = {
      starter: 'Moins de 500 000 FCFA',
      growth: '500 000 — 2 000 000 FCFA',
      premium: '2 000 000 — 10 000 000 FCFA',
      entreprise: 'Plus de 10 000 000 FCFA',
      'non-defini': "À définir avec l'équipe"
    };
    lines.push('Budget estimatif : ' + (budgets[budget] || budget));
  }
  lines.push('');
  lines.push(message);

  var from = process.env.RESEND_FROM || 'BRAIN <onboarding@resend.dev>';
  var to = (process.env.CONTACT_TO || 'braincobusiness@gmail.com').split(',').map(function (s) { return s.trim(); });

  var payload = {
    from: from,
    to: to,
    subject: subject || ('Nouvelle demande de contact — Site BRAIN · ' + name),
    reply_to: email,
    text: 'Nom : ' + name + '\n' + lines.join('\n'),
    headers: { 'X-Entity-Ref-ID': 'brain-section-contact' }
  };

  try {
    var res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (!res.ok || !data || data.error) {
      console.error('[send-mail] Resend ' + res.status + ': ' + JSON.stringify(data));
      return json(502, { ok: false, error: "L'envoi a échoué côté du service de messagerie." });
    }
    return json(200, { ok: true, id: data.id });
  } catch (err) {
    console.error('[send-mail]', err);
    return json(500, { ok: false, error: 'Erreur réseau lors de l\'envoi.' });
  }
};