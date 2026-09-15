-- ============================================================
-- BRAIN CMS — MODULE PRODUITS + BLOG DYNAMIQUE
-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Idempotent : peut être relancé sans risque.
--
-- Ajoute :
--   1) Table public.products (produits numériques administrables)
--   2) Colonnes SEO + statut sur public.blog_posts (articles)
--   3) Seed : les 2 articles réels existants (contenu vérifié du site)
--   4) RLS + grants (cohérents avec l'existant)
--
-- IMPORTANT : aucun produit fictif n'est créé ici. Seuls les
-- produits réellement renseignés par l'administrateur apparaîtront.
-- Le nom « BRAIN CARE » est une marque : il n'est jamais traduit
-- et ne doit être créé que si l'entreprise l'a réellement édité.
-- ============================================================

-- ============================================================
-- 1) TABLE PRODUCTS
-- ============================================================
create table if not exists public.products(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text,
  slogan text,
  short_description text not null,
  full_description text,
  problem_solved text,
  presentation text,
  logo text,
  image text,
  gallery jsonb not null default '[]'::jsonb,
  video text,
  external_url text,
  cta_text text,
  sector text,
  target_audience text,
  features jsonb not null default '[]'::jsonb,
  benefits jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  display_order int not null default 0,
  seo_title text,
  seo_description text,
  canonical_url text,
  og_title text,
  og_description text,
  og_image text,
  indexing text not null default 'index' check (indexing in ('index','noindex')),
  schema_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_slug on public.products(slug);
create index if not exists idx_products_order on public.products(display_order, created_at);
create index if not exists idx_products_status on public.products(status);

alter table public.products enable row level security;

-- Public : lecture des produits publiés uniquement
-- (draft et archived ne sont JAMAIS exposés publiquement)
create policy "products lecture publique publies"
  on public.products for select
  to anon, authenticated
  using (status = 'published');

-- Super admin : CRUD complet
create policy "products gestion super_admin"
  on public.products for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- 2) BLOG_POSTS : statut (draft/published/archived) + SEO
-- ============================================================
-- On conserve is_visible / is_featured (rétro-compatibilité avec
-- le page builder existant) et on ajoute un statut plus riche.
alter table public.blog_posts
  add column if not exists status text not null default 'published'
    check (status in ('draft','published','archived'));

alter table public.blog_posts
  add column if not exists tags text;

alter table public.blog_posts
  add column if not exists seo_title text;

alter table public.blog_posts
  add column if not exists seo_description text;

alter table public.blog_posts
  add column if not exists canonical_url text;

alter table public.blog_posts
  add column if not exists og_title text;

alter table public.blog_posts
  add column if not exists og_description text;

alter table public.blog_posts
  add column if not exists og_image text;

alter table public.blog_posts
  add column if not exists indexing text not null default 'index'
    check (indexing in ('index','noindex'));

create index if not exists idx_blog_posts_status on public.blog_posts(status);
create index if not exists idx_blog_posts_published on public.blog_posts(published_at desc);

-- ============================================================
-- 3) SEED : les deux articles réels du site (contenu authentique)
-- ============================================================
-- Ces articles existent déjà sur braincobusiness.com sous
-- /articles/*. Aucun contenu inventé : reproduction fidèle.
-- URL propre dynamique : /blog/<slug>

insert into public.blog_posts (title, slug, excerpt, content, image, category, author, tags, published_at, is_featured, is_visible, status, seo_title, seo_description, indexing)
values (
  'Combien coûte la création d''un site web en Côte d''Ivoire ?',
  'combien-coute-la-creation-d-un-site-web-en-cote-divoire',
  'Les critères qui font varier le coût d''un projet web — type de site, fonctionnalités, maintenance, SEO — et comment préparer un budget réaliste.',
  $PROSE$
<p>« Combien coûte un site web ? » est la première question que nous recevons. La réponse honnête est que le prix dépend entièrement du projet. Un site vitrine simple et un site e-commerce avec des milliers de produits n'ont pas le même coût, ni les mêmes délais. Voici comment estimer un budget réaliste pour votre projet web en Côte d'Ivoire.</p>

<h2>1. Le type de site : vitrine vs e-commerce vs sur-mesure</h2>
<p>Le premier critère de prix est la nature même du site :</p>
<ul>
  <li><strong>Site vitrine</strong> : idéal pour présenter votre activité, vos services, et faciliter la prise de contact. C'est l'option la plus accessible pour démarrer une présence en ligne professionnelle.</li>
  <li><strong>Site e-commerce</strong> : si vous vendez des produits en ligne, il faut ajouter un catalogue, des fiches produits, un panier, un processus de paiement, et la gestion des commandes. Le périmètre est plus large.</li>
  <li><strong>Application web / plateforme sur-mesure</strong> : pour les projets nécessitant une logique spécifique (gestion de stock complexe, portail client, outil interne), le développement est plus technique et nécessite plus de temps.</li>
</ul>

<h2>2. Le nombre de pages et la quantité de contenu</h2>
<p>Un site avec 5 pages (accueil, services, à propos, contact, FAQ) sera naturellement plus rapide à concevoir qu'un site avec 30 pages. Le nombre de pages impacte la structure du site, le travail de mise en page, et le volume de contenu à rédiger.</p>
<p>Pensez dès le départ à votre <strong>architecture de contenus</strong> : quelles pages sont essentielles pour vos clients, et lesquelles peuvent être ajoutées plus tard ?</p>

<h2>3. Le design : template ou création sur-mesure ?</h2>
<p>Un site réalisé à partir d'un template professionnel est plus rapide et plus économique qu'un design entièrement conçu sur-mesure. Les templates modernes offrent un rendu très soigné, sont responsives par défaut, et conviennent parfaitement à de nombreux projets.</p>
<p>Le design sur-mesure est pertinent lorsque vous avez une identité visuelle très spécifique, ou que votre secteur d'activité exige un positionnement visuel unique. Il implique des maquettes, des itérations et un travail graphique plus poussé.</p>

<h2>4. Les fonctionnalités et la technique</h2>
<p>Chaque fonctionnalité ajoutée est un poste de coût distinct :</p>
<ul>
  <li>Formulaires de contact simples ou avancés (devis, prise de RDV)</li>
  <li>Espace blog avec catégories et tags</li>
  <li>Boutique en ligne avec gestion de stock, livraison et paiement mobile (Wave, Orange Money)</li>
  <li>Multilingue (français + anglais, par exemple)</li>
  <li>Connexion à des outils tiers (CRM, comptabilité, réseaux sociaux)</li>
</ul>
<p>Un bon agence web vous aidera à prioriser ces fonctionnalités selon votre budget réel, sans compromettre l'expérience utilisateur.</p>

<h2>5. Le référencement naturel (SEO) et la maintenance</h2>
<p>Un site sans SEO est comme une boutique sans enseigne : difficile à trouver. L'optimisation pour les moteurs de recherche (balises, structure, contenu, vitesse de chargement) est un investissement essentiel. Le référencement local à Abidjan et en Côte d'Ivoire est un levier souvent sous-exploité.</p>
<p>À cela s'ajoute la <strong>maintenance</strong> : mises à jour de sécurité, sauvegardes, support technique, et éventuels ajouts de contenu réguliers. Un site n'est jamais vraiment « terminé », et un budget maintenance annuel est recommandé pour maintenir le site performant et sécurisé.</p>

<h2>Comment préparer votre demande de devis ?</h2>
<p>Pour obtenir un devis précis et adapté à votre besoin, préparez ces informations :</p>
<ul>
  <li>Le type de site souhaité (vitrine, e-commerce, application)</li>
  <li>Une liste approximative des pages souhaitées</li>
  <li>Les fonctionnalités clés nécessaires</li>
  <li>Votre identité visuelle existante (logo, charte graphique)</li>
  <li>Votre calendrier de mise en ligne souhaité</li>
</ul>

<div class="article-card-cta">
  <p><strong>Vous avez un projet web ?</strong> BRAIN établit des devis gratuits et adaptés à chaque projet. <a href="../contact.html">Contactez-nous</a> pour discuter de votre besoin et recevoir une proposition chiffrée.</p>
</div>
$PROSE$,
  'ASSET/SERVICES/developpement-web-mobile.jpg',
  'Web & e-commerce',
  'BRAIN',
  'web, e-commerce, devis, SEO, Côte d''Ivoire',
  '2026-09-14T10:00:00+00:00',
  false,
  true,
  'published',
  'Combien coûte un site web en Côte d''Ivoire ? | BRAIN',
  'Les critères qui font varier le coût d''un projet web — type de site, fonctionnalités, maintenance, SEO — et comment préparer un budget réaliste.',
  'index'
),
(
  'Comment digitaliser une PME en Côte d''Ivoire ?',
  'comment-digitaliser-une-pme-en-cote-divoire',
  'Étapes concrètes pour passer de la gestion manuelle à un système digital fiable : audit, priorisation, choix d''outils et accompagnement au changement.',
  $PROSE$
<p>La digitalisation n'est pas un projet réservé aux grandes entreprises. Pour les PME en Côte d'Ivoire, elle représente un levier concret d'efficacité, de réduction des coûts et de visibilité. Mais par où commencer ? Voici une feuille de route simple et actionnable.</p>

<h2>1. Faire un audit des processus existants</h2>
<p>Avant de choisir un outil, il faut comprendre comment votre entreprise fonctionne aujourd'hui. Listez vos activités quotidiennes : suivi des clients, facturation, gestion des stocks, communication, prise de commandes, gestion RH. Identifiez ce qui est entièrement manuel, ce qui utilise des fichiers Excel dispersés, et ce qui génère des erreurs récurrentes.</p>
<p>Cet audit ne demande pas de compétences techniques. Il suffit d'un tableau simple avec trois colonnes : <strong>processus</strong>, <strong>outil actuel</strong>, <strong>principales difficultés</strong>. Le but est de repérer les zones de friction les plus coûteuses en temps.</p>

<h2>2. Prioriser les blocages à résoudre en premier</h2>
<p>Tout digitaliser en même temps est une erreur classique. Concentrez-vous d'abord sur les processus qui impactent le plus votre chiffre d'affaires ou votre capacité à servir vos clients :</p>
<ul>
  <li><strong>Présence en ligne</strong> : si vos clients ne vous trouvent pas sur Google ou sur les réseaux sociaux, vous perdez des opportunités chaque jour.</li>
  <li><strong>Prise de contact simplifiée</strong> : un formulaire de devis en ligne, un chat WhatsApp structuré ou un système de réservation peut réduire considérablement les ventes manquées.</li>
  <li><strong>Facturation et suivi clients</strong> : passer de cahiers ou de fiches papier à un outil de gestion permet de suivre les paiements, d'envoyer des factures professionnelles et d'éviter les oublis.</li>
</ul>

<h2>3. Choisir des outils adaptés à votre réalité</h2>
<p>En Côte d'Ivoire, la connexion internet peut varier d'une zone à l'autre. Privilégiez des solutions qui fonctionnent bien sur mobile, qui ne nécessitent pas une connexion permanente, et qui disposent d'une interface simple pour vos équipes. Parmi les pistes concrètes :</p>
<ul>
  <li><strong>Un site web vitrine</strong> : pour être trouvé sur Google et offrir une vitrine professionnelle accessible 24h/24.</li>
  <li><strong>Des réseaux sociaux animés</strong> : Facebook, Instagram, TikTok et LinkedIn restent les canaux de visibilité les plus accessibles en Côte d'Ivoire.</li>
  <li><strong>Un outil de gestion</strong> : un simple CRM, un tableur partagé structuré ou une application de gestion peut suffire pour démarrer.</li>
  <li><strong>Un système de paiement mobile</strong> : Orange Money, Wave et MTN MoMo permettent d'encaisser sans compte bancaire classique.</li>
</ul>

<h2>4. Former vos équipes progressivement</h2>
<p>Un outil introduit sans formation crée de la frustration. Former ne signifie pas envoyer toute l'équipe en stage : cela peut se faire en courtes sessions pratiques, en créant des guides simples, ou en accompagnant les équipes pendant les premières semaines d'utilisation.</p>
<p>L'objectif est que chacun comprenne <strong>pourquoi</strong> il utilise le nouvel outil et <strong>comment</strong> cela facilite son travail quotidien. La conduite du changement est souvent la clé du succès d'un projet de digitalisation.</p>

<h2>5. Mesurer, ajuster, et aller étape par étape</h2>
<p>La digitalisation est un processus continu, pas un événement ponctuel. Après avoir lancé votre premier outil ou première solution, mesurez les résultats après quelques semaines. Le temps gagné est-il réel ? Les erreurs ont-elles diminué ? Les clients sont-ils plus satisfaits ?</p>
<p>En fonction des résultats, vous pourrez activer l'étape suivante : ajouter un blog pour améliorer votre <a href="../service-social.html">référencement naturel</a>, automatiser des relances, ou lancer une <a href="../service-web.html">boutique en ligne</a>.</p>

<div class="article-card-cta">
  <p><strong>Besoin d'un accompagnement sur mesure ?</strong> BRAIN accompagne les PME ivoiriennes dans leur transformation digitale, de l'audit initial à la mise en place des solutions concrètes. <a href="../contact.html">Demandez un devis gratuit.</a></p>
</div>
$PROSE$,
  'ASSET/SERVICES/digitalisation.jpg',
  'Digitalisation',
  'BRAIN',
  'digitalisation, PME, transformation digitale, Côte d''Ivoire, outils',
  '2026-09-14T10:30:00+00:00',
  true,
  true,
  'published',
  'Comment digitaliser une PME en Côte d''Ivoire ? | BRAIN',
  'Étapes concrètes pour digitaliser une PME en Côte d''Ivoire : audit des processus, priorisation, choix d''outils adaptés, formation et accompagnement au changement.',
  'index'
)
on conflict (slug) do nothing;

-- ============================================================
-- 4) GRANTS (identiques à l'existant : RLS reste le garde-fou)
-- ============================================================
grant select on public.products to anon;
grant all on public.products to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

notify pgrst, 'reload schema';