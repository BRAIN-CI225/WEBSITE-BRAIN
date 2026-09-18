-- ============================================================
-- BRAIN CMS — VISUEL OFFICIEL BRAIN CARE
-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Idempotent : peut être relancé sans risque.
--
-- 1) Ajoute la colonne products.image_alt (texte ALT SEO)
--    servie par le rendu de la page « Nos produits ».
-- 2) Applique ASSET/VISUEL-BRAINCARE-1.png comme image
--    principale + Open Graph du produit BRAIN CARE.
-- 3) Si aucun produit BRAIN CARE n'existe encore, en crée un
--    (contenu basé sur le visuel officiel), sinon ne fait que
--    mettre à jour les champs image/alt/OG du produit trouvé.
-- ============================================================

alter table public.products
  add column if not exists image_alt text;

-- Mise à jour ciblée si le produit BRAIN CARE existe déjà (quel que soit son slug)
update public.products set
  image     = 'ASSET/VISUEL-BRAINCARE-1.png',
  image_alt = 'BRAIN CARE, solution digitale de BRAINCO BUSINESS pour la gestion des établissements de santé en Afrique',
  og_image  = 'ASSET/VISUEL-BRAINCARE-1.png'
where lower(name) = 'brain care'
   or lower(slug) like 'brain-care%'
   or lower(slug) like 'braincare%';

-- Insertion uniquement si BRAIN CARE n'existe pas encore (évite tout doublon)
insert into public.products (
  name, slug, category, slogan, short_description, full_description,
  problem_solved, presentation, image, image_alt, external_url, cta_text,
  sector, target_audience, status, display_order,
  seo_title, seo_description, og_title, og_description, og_image, indexing,
  created_at, updated_at
)
select
  'BRAIN CARE',
  'brain-care',
  'E-santé',
  'La gestion décentralisée de vos établissements de santé, en Afrique',
  'Plateforme digitale de BRAINCO BUSINESS pour gérer les rendez-vous, dossiers patients, médicaments, profils des praticiens et structures de santé — accessible depuis ordinateur et mobile.',
  '<p>BRAIN CARE est la solution digitale développée par BRAINCO BUSINESS pour les établissements de santé en Afrique. Elle centralise la gestion des rendez-vous, des dossiers patients, des médicaments et des profils des praticiens, tout en permettant une gestion décentralisée des structures de santé.</p><p>Simple à prendre en main, la plateforme s''utilise aussi bien depuis un ordinateur que depuis un mobile, partout où l''accès à l''internet existe.</p>',
  'Les établissements de santé africains gèrent trop souvent rendez-vous, dossiers et stocks sur le papier ou dans des outils dispersés. BRAIN CARE rassemble l''essentiel de la gestion dans une seule plateforme accessible partout : moins de perte d''information, moins de double saisie, un meilleur suivi des patients.',
  '<p>Une gestion décentralisée : chaque structure de santé pilote ses rendez-vous, ses patients, ses praticiens et ses médicaments. L''orientation est résolument africaine, pensée pour les réalités des cliniques, cabinets, centres de santé et hôpitaux du continent.</p>',
  'ASSET/VISUEL-BRAINCARE-1.png',
  'BRAIN CARE, solution digitale de BRAINCO BUSINESS pour la gestion des établissements de santé en Afrique',
  'https://www.braincares.site',
  'Découvrir BRAIN CARE',
  'Santé',
  'Cliniques, cabinets, centres de santé et hôpitaux en Afrique',
  'published', 1,
  'BRAIN CARE — Gestion des établissements de santé en Afrique | BRAIN',
  'BRAIN CARE, la solution de BRAINCO BUSINESS pour la gestion des rendez-vous, dossiers patients, médicaments et structures de santé en Afrique.',
  'BRAIN CARE | Gestion des établissements de santé',
  'Gérez rendez-vous, dossiers patients, médicaments, profils des praticiens et structures de santé depuis une seule plateforme, en Afrique.',
  'ASSET/VISUEL-BRAINCARE-1.png',
  'index',
  now(), now()
where not exists (
  select 1 from public.products
  where lower(name) = 'brain care'
     or lower(slug) like 'brain-care%'
     or lower(slug) like 'braincare%'
);

notify pgrst, 'reload schema';