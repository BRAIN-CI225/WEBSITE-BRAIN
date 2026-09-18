/* =========================================================
   BRAIN — Produits : jeu de secours local
   Utilisé par la page /produits (js/page-produits.js) lorsque
   Supabase est indisponible ou que la table "products" est vide,
   afin que le site ne soit jamais vide.
   Source de vérité : table products (Supabase / admin).
   ========================================================= */
window.BRAIN_PRODUITS_FALLBACK = window.BRAIN_PRODUITS_FALLBACK || [
  {
    "name": "BRAIN CARE",
    "slug": "brain-care",
    "category": "E-santé",
    "slogan": "La gestion décentralisée de vos établissements de santé, en Afrique",
    "short_description": "Plateforme digitale de BRAINCO BUSINESS pour gérer les rendez-vous, dossiers patients, médicaments, profils des praticiens et structures de santé — accessible depuis ordinateur et mobile.",
    "full_description": "<p>BRAIN CARE est la solution digitale développée par BRAINCO BUSINESS pour les établissements de santé en Afrique. Elle centralise la gestion des rendez-vous, des dossiers patients, des médicaments et des profils des praticiens, tout en permettant une gestion décentralisée des structures de santé.</p><p>Simple à prendre en main, la plateforme s'utilise aussi bien depuis un ordinateur que depuis un mobile, partout où l'accès à l'internet existe.</p>",
    "problem_solved": "Les établissements de santé africains gèrent trop souvent rendez-vous, dossiers et stocks sur le papier ou dans des outils dispersés. BRAIN CARE rassemble l'essentiel de la gestion dans une seule plateforme accessible partout : moins de perte d'information, moins de double saisie, un meilleur suivi des patients.",
    "presentation": "<p>Une gestion décentralisée : chaque structure de santé pilote ses rendez-vous, ses patients, ses praticiens et ses médicaments. L'orientation est résolument africaine, pensée pour les réalités des cliniques, cabinets, centres de santé et hôpitaux du continent.</p>",
    "image": "ASSET/VISUEL-BRAINCARE-1.png",
    "image_alt": "BRAIN CARE, solution digitale de BRAINCO BUSINESS pour la gestion des établissements de santé en Afrique",
    "external_url": "https://www.braincares.site",
    "cta_text": "Découvrir BRAIN CARE",
    "sector": "Santé",
    "target_audience": "Cliniques, cabinets, centres de santé et hôpitaux en Afrique",
    "features": [
      { "title": "Gestion des rendez-vous", "description": "Planifiez et suivez les rendez-vous des patients, par praticien et par structure." },
      { "title": "Dossiers patients", "description": "Historique médical centralisé, accessible et sécurisé pour chaque patient." },
      { "title": "Gestion des médicaments", "description": "Suivi des stocks, des prescriptions et des produits disponibles." },
      { "title": "Profils des praticiens", "description": "Agenda, spécialités et activités de chaque membre de l'équipe médicale." },
      { "title": "Structures de santé", "description": "Administration centralisée et décentralisée des établissements." },
      { "title": "Ordinateur & mobile", "description": "Accès à la plateforme depuis un ordinateur ou un téléphone, partout en Afrique." }
    ],
    "benefits": [
      { "title": "Gestion décentralisée", "description": "Chaque structure pilote ses données sans perdre la vision globale." },
      { "title": "Conçu pour l'Afrique", "description": "Pensé pour les réalités des établissements de santé du continent." },
      { "title": "Accès mobile", "description": "Utilisable sur ordinateur et téléphone, même avec une connexion simple." }
    ],
    "status": "published",
    "is_visible": true,
    "display_order": 1,
    "seo_title": "BRAIN CARE — Gestion des établissements de santé en Afrique | BRAIN",
    "seo_description": "BRAIN CARE, la solution de BRAINCO BUSINESS pour la gestion des rendez-vous, dossiers patients, médicaments et structures de santé en Afrique.",
    "og_title": "BRAIN CARE | Gestion des établissements de santé",
    "og_description": "Gérez rendez-vous, dossiers patients, médicaments, profils des praticiens et structures de santé depuis une seule plateforme, en Afrique.",
    "og_image": "ASSET/VISUEL-BRAINCARE-1.png",
    "indexing": "index"
  }
];