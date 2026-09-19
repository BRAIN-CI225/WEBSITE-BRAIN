-- ============================================================
-- BRAIN CMS — Schéma Supabase (Page Builder / CMS)
-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Sécurité : RLS activée partout. Public = LECTURE du publié.
-- Super Admin = CRUD complet (via table admins).
-- ============================================================

-- ============================================================
-- ADMINS
-- ============================================================
create table if not exists public.admins(
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'super_admin' check (role in ('super_admin','editor')),
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- ---------- Helper : est-ce un super admin ? ----------
-- (Doit être créé APRÈS la table admins : PostgreSQL valide le corps à la création.)
-- search_path figé = durcissement pour une fonction SECURITY DEFINER.
create or replace function public.is_super_admin()
returns boolean language sql security definer stable set search_path = pg_catalog as $$
  select exists(select 1 from public.admins where user_id = auth.uid());
$$;

create policy "super_admin gestion admins"
  on public.admins for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Bootstrapping : le premier utilisateur authentifié devient super admin.
-- À retirer une fois le compte admin créé.
create or replace function public.bootstrap_first_admin()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if not exists(select 1 from public.admins) then
    insert into public.admins(user_id, role) values (new.id, 'super_admin');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bootstrap_first_admin on auth.users;
create trigger trg_bootstrap_first_admin
  after insert on auth.users
  for each row execute function public.bootstrap_first_admin();

-- ============================================================
-- PAGES
-- ============================================================
create table if not exists public.pages(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  template text not null default 'default',
  status text not null default 'draft' check (status in ('published','draft','hidden')),
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pages enable row level security;

create policy "pages lecture publique publiees"
  on public.pages for select
  to anon, authenticated
  using (status = 'published');

create policy "pages gestion super_admin"
  on public.pages for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- PAGE SECTIONS
-- ============================================================
create table if not exists public.page_sections(
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  section_type text not null,
  title text,
  subtitle text,
  content text,
  image text,
  background text,
  configuration jsonb not null default '{}'::jsonb,
  visibility text not null default 'visible' check (visibility in ('visible','hidden')),
  display_order int not null default 0,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_page_sections_page_order on public.page_sections(page_id, display_order);

alter table public.page_sections enable row level security;

create policy "sections lecture publique publiees"
  on public.page_sections for select
  to anon, authenticated
  using (status = 'published' and visibility = 'visible');

create policy "sections gestion super_admin"
  on public.page_sections for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- SERVICES
-- ============================================================
create table if not exists public.services(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  tagline text,
  description text,
  image text,
  icon text,
  url text,
  display_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services enable row level security;

create policy "services lecture publique"
  on public.services for select
  to anon, authenticated
  using (is_visible = true);

create policy "services gestion super_admin"
  on public.services for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- PROJECTS / PORTFOLIO
-- ============================================================
create table if not exists public.projects(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  image text,
  description text,
  url text,
  display_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "projects lecture publique"
  on public.projects for select
  to anon, authenticated
  using (is_visible = true);

create policy "projects gestion super_admin"
  on public.projects for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- BLOG POSTS
-- ============================================================
create table if not exists public.blog_posts(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  image text,
  category text,
  author text,
  published_at timestamptz,
  is_featured boolean not null default false,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blog_posts enable row level security;

create policy "blog lecture publique"
  on public.blog_posts for select
  to anon, authenticated
  using (is_visible = true);

create policy "blog gestion super_admin"
  on public.blog_posts for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- TESTIMONIALS
-- ============================================================
create table if not exists public.testimonials(
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  company text,
  position text,
  photo text,
  testimonial text not null,
  rating int not null default 5 check (rating between 1 and 5),
  display_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.testimonials enable row level security;

create policy "testimonials lecture publique"
  on public.testimonials for select
  to anon, authenticated
  using (is_visible = true);

create policy "testimonials gestion super_admin"
  on public.testimonials for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- STATISTICS / COUNTERS
-- ============================================================
create table if not exists public.statistics(
  id uuid primary key default gen_random_uuid(),
  number text not null,
  label text not null,
  icon text,
  display_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.statistics enable row level security;

create policy "statistics lecture publique"
  on public.statistics for select
  to anon, authenticated
  using (is_visible = true);

create policy "statistics gestion super_admin"
  on public.statistics for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- FAQS
-- ============================================================
create table if not exists public.faqs(
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  display_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.faqs enable row level security;

create policy "faqs lecture publique"
  on public.faqs for select
  to anon, authenticated
  using (is_visible = true);

create policy "faqs gestion super_admin"
  on public.faqs for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- MEDIA LIBRARY
-- ============================================================
create table if not exists public.media(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  type text,
  size int,
  created_at timestamptz not null default now()
);

alter table public.media enable row level security;

create policy "media lecture publique"
  on public.media for select
  to anon, authenticated
  using (true);

create policy "media gestion super_admin"
  on public.media for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- SITE SETTINGS (couleurs, boutons, containers, footer, nav...)
-- ============================================================
create table if not exists public.site_settings(
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

create policy "settings lecture publique"
  on public.site_settings for select
  to anon, authenticated
  using (true);

create policy "settings gestion super_admin"
  on public.site_settings for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- ADMIN ACTIVITY LOGS
-- ============================================================
create table if not exists public.admin_activity_logs(
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_activity_logs enable row level security;

create policy "logs lecture super_admin"
  on public.admin_activity_logs for select
  to authenticated
  using (public.is_super_admin());

create policy "logs insertion super_admin"
  on public.admin_activity_logs for insert
  to authenticated
  with check (public.is_super_admin());

-- ============================================================
-- MEDIA STORAGE BUCKET
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Lecture publique des objets du bucket media
create policy "storage media lecture publique"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'media');

-- Upload / maj / suppression réservés aux super administrateurs
create policy "storage media admin upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media' and public.is_super_admin());

create policy "storage media admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media' and public.is_super_admin());

create policy "storage media admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and public.is_super_admin());

-- ============================================================
-- GRANTS : exposer les tables à l'API REST (RLS reste garde-fou)
-- ============================================================
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
notify pgrst, 'reload schema';

-- ============================================================
-- SEEDS : contenu existant du site BRAIN
-- ============================================================

insert into public.services (title, slug, tagline, description, image, icon, url, display_order) values
  ('Identité visuelle & Branding', 'branding', 'Une image qui vous ressemble.', 'Créons une identité forte, cohérente et mémorable pour votre marque.', 'ASSET/SERVICES/branding.jpg', 'fa-palette', 'service-branding.html', 1),
  ('Sites Web & E-commerce', 'web', 'Votre vitrine digitale 24h/24.', 'Des sites modernes, rapides et pensés pour convertir vos visiteurs en clients.', 'ASSET/SERVICES/developpement-web-mobile.jpg', 'fa-laptop-code', 'service-web.html', 2),
  ('Community Management', 'social', 'Engagez votre communauté.', 'Stratégie, contenus, animation et publicité pour développer votre communauté.', 'ASSET/SERVICES/social.jpg', 'fa-hashtag', 'service-social.html', 3),
  ('Design Graphique & Print', 'design', 'Donnez vie à vos idées.', 'Affiches, brochures, contenus digitaux et supports de communication qui marquent.', 'ASSET/SERVICES/design.jpg', 'fa-pen-ruler', 'service-design.html', 4),
  ('Films Publicitaires', 'films', 'Racontez votre histoire.', 'De la conception au tournage et à la post-production, nous donnons vie à vos projets.', 'ASSET/SERVICES/films.jpg', 'fa-clapperboard', 'service-films.html', 5),
  ('Captation & Live', 'live', 'Immortalisez vos moments forts.', 'Événements, conférences, cérémonies, reportages et streaming professionnel.', 'ASSET/SERVICES/live.jpg', 'fa-video', 'service-live.html', 6),
  ('Digitalisation', 'digitalisation', 'Transformez votre façon de travailler.', 'Automatisation, applications, outils de gestion et solutions digitales sur mesure.', 'ASSET/SERVICES/digitalisation.jpg', 'fa-gears', 'service-digital.html', 7)
on conflict (slug) do nothing;

insert into public.projects (title, category, image, description, url, display_order) values
  ('Supports ilOfio', 'Branding', 'ASSET/REALISATIONS/ilofio-brochures.jpg', 'Conception de brochures et déclinaisons de marque.', 'portfolio.html', 1),
  ('Campagne IBK', 'Branding · Design', 'ASSET/REALISATIONS/ibk-campagne-vehicule.jpg', 'Habillage publicitaire et déclinaison de campagne.', 'portfolio.html', 2),
  ('Affichage Tiken Jah', 'Événementiel', 'ASSET/REALISATIONS/tiken-jah-affichage.jpg', 'Création de support grand format pour événement culturel.', 'portfolio.html', 3)
on conflict do nothing;

insert into public.testimonials (client_name, company, position, testimonial, rating, display_order) values
  ('Client Entreprise', 'Secteur Services', 'Direction', 'Un accompagnement professionnel et créatif, de la stratégie jusqu''à la production. Un vrai gain de temps pour notre équipe.', 5, 1),
  ('Client Institution', 'Secteur Public', 'Communication', 'L''équipe BRAIN a su comprendre nos objectifs et proposer une identité visuelle forte, alignée avec notre vision.', 5, 2),
  ('Client Communication', 'Audiovisuel', 'Producteur', 'Une production audiovisuelle de très haute qualité et un service client toujours disponible. Nous recommandons.', 5, 3)
on conflict do nothing;

insert into public.statistics (number, label, icon, display_order) values
  ('7', 'Pôles d''expertise', 'fa-layer-group', 1),
  ('120+', 'Projets réalisés', 'fa-rocket', 2),
  ('98%', 'Clients satisfaits', 'fa-heart', 3),
  ('24/7', 'Disponibilité équipe', 'fa-headset', 4)
on conflict do nothing;

insert into public.faqs (question, answer, display_order) values
  ('Combien de temps dure un projet de branding ?', 'Chaque projet est unique, mais une identité visuelle complète se déploie généralement en 3 à 6 semaines, selon les déclinaisons demandées.', 1),
  ('Proposez-vous un accompagnement après la livraison ?', 'Oui, nous proposons des formules d''accompagnement continu : maintenance, contenus, community management et optimisation.', 2),
  ('Travaillez-vous avec des clients hors d''Abidjan ?', 'Absolument. Nous collaborons avec des clients dans toute la Côte d''Ivoire et à l''international grâce à nos outils à distance.', 3),
  ('Comment est calculé le devis ?', 'Le devis est établi après un échange sur vos objectifs, le périmètre du projet et les livrables attendus. Il est gratuit et sans engagement.', 4)
on conflict do nothing;

-- ---------- PAGES ----------
insert into public.pages (title, slug, template, status, seo_title, seo_description) values
  ('Accueil', 'home', 'default', 'published', 'BRAIN — Agence de communication digitale à Abidjan', 'Agence digitale, audiovisuelle, créative et de transformation numérique basée à Abidjan.'),
  ('Nos Services', 'services', 'default', 'published', 'Nos Services — BRAIN', 'Toutes les expertises BRAIN pour faire grandir votre marque.'),
  ('Réalisations', 'portfolio', 'default', 'published', 'Réalisations — BRAIN', 'Un aperçu des projets récents de l''agence BRAIN.'),
  ('À propos', 'about', 'default', 'published', 'À propos — BRAIN', 'Une agence qui réunit communication, créativité, audiovisuel, technologie et digitalisation.'),
  ('Contact', 'contact', 'default', 'published', 'Contact — BRAIN', 'Parlons de votre prochain projet avec l''équipe BRAIN.')
on conflict (slug) do nothing;

-- ---------- SECTIONS PAGE D'ACCUEIL (reproduction fidèle du design actuel) ----------
insert into public.page_sections (page_id, section_type, title, subtitle, content, image, background, configuration, visibility, display_order, status) values
((select id from public.pages where slug = 'home'),
 'hero',
 'Donnez à votre marque une nouvelle dimension',
 'Une agence qui réunit communication, créativité, audiovisuel, technologie et digitalisation.',
 'Le hero du site BRAIN avec ses 7 slides expertises.',
 'ASSET/SLIDES/branding.jpg',
 'none',
 jsonb_build_object(
   'slides', jsonb_build_array(
     jsonb_build_object('label','Identité visuelle & Branding','image','ASSET/SLIDES/branding.jpg','title','Identité visuelle<br><span>& Branding</span>','subtitle','Une image qui vous ressemble.','description','Créons une identité forte, cohérente et mémorable pour votre marque.','cta','Découvrir le branding','href','service-branding.html','icon','fa-palette'),
     jsonb_build_object('label','Création Web & E-commerce','image','ASSET/SLIDES/web.jpg','title','Création Web<br><span>& E-commerce</span>','subtitle','Votre présence digitale commence ici.','description','Des sites modernes, rapides et conçus pour transformer vos visiteurs en clients.','cta','Créer mon site','href','service-web.html','icon','fa-laptop-code'),
     jsonb_build_object('label','Réseaux sociaux','image','ASSET/SLIDES/social.jpg','title','Réseaux sociaux<br><span>& Community Management</span>','subtitle','Faites vivre votre marque au quotidien.','description','Stratégie, contenus, animation et publicité pour développer votre communauté.','cta','Développer ma marque','href','service-social.html','icon','fa-hashtag'),
     jsonb_build_object('label','Design graphique','image','ASSET/SLIDES/design.jpg','title','Design graphique<br><span>& Contenus</span>','subtitle','Vos idées méritent de belles images.','description','Affiches, brochures, contenus digitaux et supports de communication qui marquent.','cta','Découvrir nos créations','href','service-design.html','icon','fa-pen-ruler'),
     jsonb_build_object('label','Films publicitaires','image','ASSET/SLIDES/films.jpg','title','Films publicitaires<br><span>& Institutionnels</span>','subtitle','Racontez votre histoire autrement.','description','De la conception au tournage et à la post-production, nous donnons vie à vos projets.','cta','Produire mon film','href','service-films.html','icon','fa-clapperboard'),
     jsonb_build_object('label','Captation & Live','image','ASSET/SLIDES/live.jpg','title','Captation vidéo<br><span>& Live</span>','subtitle','Ne laissez aucun moment important disparaître.','description','Événements, conférences, cérémonies, reportages et streaming professionnel.','cta','Couvrir mon événement','href','service-live.html','icon','fa-video'),
     jsonb_build_object('label','Digitalisation','image','ASSET/SLIDES/digitalisation.jpg','title','Digitalisation<br><span>des entreprises</span>','subtitle','Transformez votre façon de travailler.','description','Automatisation, applications, outils de gestion et solutions digitales sur mesure.','cta','Digitaliser mon entreprise','href','service-digital.html','icon','fa-gears')
   ),
   'autoplay', true, 'loop', true, 'interval', 6000
 ),
 'visible', 1, 'published'),
((select id from public.pages where slug = 'home'),
 'services',
 'Tout ce qu''il faut pour faire grandir **votre marque**',
 'De votre identité visuelle à votre transformation digitale, BRAIN réunit les expertises nécessaires pour construire, développer et faire rayonner votre entreprise.',
 'Grille des 7 services BRAIN.',
 null,
 'blue-orb',
 jsonb_build_object('tag','Nos expertises','columns_desktop',3,'columns_tablet',2,'columns_mobile',1,'limit',7,'show_image',true,'show_icon',true,'show_description',true,'show_cta',true,'layout','grid'),
 'visible', 2, 'published'),
((select id from public.pages where slug = 'home'),
 'features',
 'Une seule agence. **Plusieurs expertises.**',
 'Un partenaire unique capable de couvrir l''ensemble de votre écosystème de communication, de la stratégie à la production.',
 'Les 4 raisons de choisir BRAIN.',
 null,
 'orange-orb',
 jsonb_build_object(
   'tag','Pourquoi BRAIN ?',
   'items', jsonb_build_array(
     jsonb_build_object('icon','fa-lightbulb','title','Créativité','text','Des concepts originaux qui donnent de la personnalité aux marques.'),
     jsonb_build_object('icon','fa-microchip','title','Technologie','text','Des solutions digitales adaptées aux nouveaux usages.'),
     jsonb_build_object('icon','fa-video','title','Expertise audiovisuelle','text','De la conception au tournage jusqu''à la post-production.'),
     jsonb_build_object('icon','fa-handshake','title','Accompagnement','text','Une approche personnalisée orientée résultats.')
   )
 ),
 'visible', 3, 'published'),
((select id from public.pages where slug = 'home'),
 'statistics',
 'Des résultats **qui parlent**',
 'Quelques chiffres qui illustrent notre engagement et l''impact de nos réalisations.',
 null,
 null,
 'none',
 jsonb_build_object('tag','Chiffres clés','limit',4,'show_icon',true),
 'visible', 4, 'published'),
((select id from public.pages where slug = 'home'),
 'video',
 'Notre **showreel**',
 'Une immersion dans la créativité, la technologie et l''expertise audiovisuelle de BRAIN.',
 null,
 null,
 'blue-orb',
 jsonb_build_object('tag','BRAIN en images','video_url','6NziLBrldFo','provider','youtube','autoplay',true,'loop',true,'controls',true),
 'visible', 5, 'published'),
((select id from public.pages where slug = 'home'),
 'text',
 'Une méthode simple. **Des résultats concrets.**',
 'Chaque projet BRAIN suit un processus rigoureux en 5 étapes, du premier échange jusqu''à l''optimisation continue.',
 'Écouter|Comprendre votre entreprise et vos objectifs.
Analyser|Identifier vos besoins et opportunités.
Concevoir|Créer une stratégie et une direction artistique.
Produire|Déployer les contenus, outils et supports.
Déployer|Mettre en ligne, suivre et faire grandir.',
 null,
 'none',
 jsonb_build_object('tag','Notre approche','layout','timeline','align','center'),
 'visible', 6, 'published'),
((select id from public.pages where slug = 'home'),
 'portfolio',
 'Des idées qui **prennent vie.**',
 'Un aperçu de nos projets récents en branding, web, réseaux sociaux, design, audiovisuel, événementiel et digital.',
 null,
 null,
 'none',
 jsonb_build_object('tag','Portfolio','limit',3,'columns_desktop',3,'columns_tablet',2,'columns_mobile',1,'show_category',true,'show_description',true,'show_cta',true,'cta_text','Voir tout le portfolio'),
 'visible', 7, 'published'),
((select id from public.pages where slug = 'home'),
 'logos',
 'Nos **clients**',
 'Les marques et institutions qui nous font confiance.',
 null,
 null,
 'none',
 jsonb_build_object('tag','Ils nous font confiance','animation','marquee','items', jsonb_build_array(
   jsonb_build_object('src','ASSET/clients/universal-music-africa.png','alt','Universal Music Africa'),
   jsonb_build_object('src','ASSET/clients/diabateba-music.png','alt','Diabatéba Music'),
   jsonb_build_object('src','ASSET/clients/harnet-system.png','alt','Harnet System'),
   jsonb_build_object('src','ASSET/clients/l-independant.png','alt','L''Indépendant'),
   jsonb_build_object('src','ASSET/clients/giz.png','alt','GIZ'),
   jsonb_build_object('src','ASSET/clients/sahara-tv.png','alt','Sahara TV'),
   jsonb_build_object('src','ASSET/clients/unhcr.png','alt','UNHCR'),
   jsonb_build_object('src','ASSET/clients/etv.png','alt','ETV'),
   jsonb_build_object('src','ASSET/clients/pmu-mali.png','alt','PMU Mali'),
   jsonb_build_object('src','ASSET/clients/capal-sa.png','alt','CAPAL-SA'),
   jsonb_build_object('src','ASSET/clients/lbl.png','alt','LBL'),
   jsonb_build_object('src','ASSET/clients/millet-hotel.png','alt','Millet Hotel'),
   jsonb_build_object('src','ASSET/clients/yes-group.png','alt','YES Group'),
   jsonb_build_object('src','ASSET/clients/ak-group.png','alt','AK Group'),
   jsonb_build_object('src','ASSET/clients/jourdain.png','alt','Jourdain Informatique & Monétique'),
jsonb_build_object('src','ASSET/clients/sodishop.png','alt','Sodishop')
  )),
 'visible', 8, 'published'),
((select id from public.pages where slug = 'home'),
 'testimonials',
 'Ils nous **font confiance**',
 'Ce que nos partenaires disent de leur collaboration avec BRAIN.',
 null,
 null,
 'blue-orb',
 jsonb_build_object('tag','Témoignages','limit',3,'columns_desktop',3,'columns_tablet',2,'columns_mobile',1,'show_rating',true),
 'visible', 9, 'published'),
((select id from public.pages where slug = 'home'),
 'pricing',
 'Des solutions adaptées **à vos objectifs**',
 'Des formules modulaires, pensées pour chaque étape de croissance de votre entreprise.',
 null,
 null,
 'none',
 jsonb_build_object(
   'tag','Nos offres','cta_text','Demander un devis','cta_url','contact.html',
   'plans', jsonb_build_array(
     jsonb_build_object('name','Starter','description','Pour les petites entreprises et projets ponctuels.','featured',false,'features', jsonb_build_array('Identité visuelle de base','Supports de communication','Présence digitale essentielle')),
     jsonb_build_object('name','Growth','description','Pour les entreprises souhaitant développer leur visibilité.','featured',true,'features', jsonb_build_array('Branding complet','Site web ou e-commerce','Community management','Contenus réguliers')),
     jsonb_build_object('name','Premium','description','Pour les entreprises ayant besoin d''un accompagnement global.','featured',false,'features', jsonb_build_array('Branding & communication complète','Production audiovisuelle','Stratégie digitale avancée','Suivi mensuel dédié')),
      jsonb_build_object('name','Entreprise','description','Solutions personnalisées et transformation digitale.','featured',false,'features', jsonb_build_array('Accompagnement 360°','Digitalisation des process','Production sur mesure','Équipe dédiée'))
    )
  ),
 'visible', 10, 'published'),
((select id from public.pages where slug = 'home'),
 'cta',
 'Vous avez un projet ?',
 'Parlons-en et donnons-lui une nouvelle dimension.',
 null,
 null,
 'none',
 jsonb_build_object('buttons', jsonb_build_array(
   jsonb_build_object('text','Demander un devis','href','contact.html','style','primary'),
   jsonb_build_object('text','Nous contacter','href','contact.html','style','outline')
 )),
 'visible', 11, 'published'),
((select id from public.pages where slug = 'home'),
 'contact_form',
 'Contactez-**nous**',
 'Un projet, une question, un devis ? Notre équipe à Abidjan vous répond rapidement.',
 null,
 null,
 'orange-blue-orbs',
 jsonb_build_object('tag','Contact','phone','+2250711356324','phone_display','07 11 35 63 24','whatsapp','2250711356324','email','braincobusiness@gmail.com','website','www.braincobusiness.com','form_action','/.netlify/functions/send-mail'),
 'visible', 12, 'published')

on conflict do nothing;