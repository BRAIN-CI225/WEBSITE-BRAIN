-- ============================================================
-- BRAIN CMS — MÉDIATHÈQUE AUDIOVISUELLE
-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Idempotent : peut être relancé sans risque.
--
-- Ajoute :
--   1) Table public.audiovisual_videos (réalisations vidéo)
--      sources : youtube / vimeo / upload (MP4, WebM, MOV)
--   2) RLS : public = lecture des vidéos publiées uniquement,
--      super admin = CRUD complet (régime identique à products/blog)
--   3) Bucket de stockage public audiovisual-videos
--      (cohérent avec le bucket "media" déjà utilisé par le projet)
--   4) Trigger automatique updated_at + index utiles
--
-- Note : l'architecture du site n'est PAS multi-tenant (une seule
-- agence, table "admins" globale). Aucun organization_id n'est donc
-- ajouté : le schéma suit strictement les conventions existantes.
--
-- Limite de taille : la limite Max File Size du bucket se règle
-- dans Supabase > Storage > Settings (projet gratuit = 50 Mo,
-- projets payants = jusqu'à 5 Go). La limite côté UI est
-- configurable via site_settings (clé audiovisual_max_video_size_mb),
-- défaut 200 Mo côté interface.
-- ============================================================

-- ============================================================
-- 1) TABLE AUDIOVISUAL_VIDEOS
-- ============================================================
create table if not exists public.audiovisual_videos(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text,
  description text,
  category text,
  source_type text not null check (source_type in ('youtube','vimeo','upload')),
  external_url text,
  storage_path text,
  thumbnail_url text,
  duration integer,
  featured boolean not null default false,
  display_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_av_slug on public.audiovisual_videos(slug);
create index if not exists idx_av_published on public.audiovisual_videos(published);
create index if not exists idx_av_order on public.audiovisual_videos(display_order, created_at);
-- Une seule vidéo peut être « à la une » à la fois
create unique index if not exists idx_av_featured_one on public.audiovisual_videos(featured) where featured;

alter table public.audiovisual_videos enable row level security;

-- Public : lecture des vidéos publiées uniquement
create policy "av lecture publique publiees"
  on public.audiovisual_videos for select
  to anon, authenticated
  using (published = true);

-- Super admin : CRUD complet (y compris les brouillons / dépubliées)
create policy "av gestion super_admin"
  on public.audiovisual_videos for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- 2) TRIGGER : updated_at automatique
-- ============================================================
create or replace function public.av_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_av_updated_at on public.audiovisual_videos;
create trigger trg_av_updated_at
  before update on public.audiovisual_videos
  for each row execute function public.av_touch_updated_at();

-- ============================================================
-- 3) STORAGE : bucket dédié audiovisual-videos (public)
--    Même stratégie que le bucket "media" déjà utilisé par le site.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('audiovisual-videos', 'audiovisual-videos', true)
on conflict (id) do nothing;

-- Lecture publique des objets du bucket (lecture vidéo grand public)
create policy "storage av lecture publique"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'audiovisual-videos');

-- Upload / maj / suppression réservés aux super administrateurs
create policy "storage av admin upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'audiovisual-videos' and public.is_super_admin());

create policy "storage av admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'audiovisual-videos' and public.is_super_admin());

create policy "storage av admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'audiovisual-videos' and public.is_super_admin());

-- ============================================================
-- 4) GRANTS (identiques à l'existant : RLS reste le garde-fou)
-- ============================================================
grant select on public.audiovisual_videos to anon;
grant all on public.audiovisual_videos to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

notify pgrst, 'reload schema';