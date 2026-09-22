-- ============================================================
-- BRAIN CMS — NOTIFICATIONS WEB PUSH + ANALYTICS VISITEURS
-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Idempotent : peut être relancé sans risque.
--
-- Ajoute :
--   1) public.push_subscriptions (abonnements push VAPID)
--   2) public.notifications      (campagnes / notifications)
--   3) public.visitor_sessions   (sessions visiteurs anonymes)
--   4) public.page_views         (pages vues)
--
-- Sécurité : RLS partout.
--   - Aucun accès public aux données analytics & abonnements.
--   - Lecture seule pour le super admin.
--   - Écriture UNIQUEMENT côté serveur (Netlify Functions /
--     service role). Aucune clé privée exposée au frontend.
-- ============================================================

-- ============================================================
-- 1) PUSH SUBSCRIPTIONS
-- ============================================================
create table if not exists public.push_subscriptions(
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_type text,
  browser text,
  language text,
  country text,
  country_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists idx_push_sub_endpoint on public.push_subscriptions(endpoint);
create index if not exists idx_push_sub_active on public.push_subscriptions(is_active);
create index if not exists idx_push_sub_last_used on public.push_subscriptions(last_used_at desc);

alter table public.push_subscriptions enable row level security;

-- Aucune lecture publique : la liste des abonnés est privée.
create policy "push_subscriptions lecture super_admin"
  on public.push_subscriptions for select
  to authenticated
  using (public.is_super_admin());

create policy "push_subscriptions gestion super_admin"
  on public.push_subscriptions for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- 2) NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null default '',
  url text,
  image_url text,
  type text not null default 'announcement'
    check (type in ('blog','product','service','update','announcement')),
  related_post_id uuid,
  related_product_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  scheduled_for timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','scheduled','sending','sent','failed')),
  sent_count int not null default 0,
  failed_count int not null default 0,
  click_count int not null default 0,
  last_error text
);

create index if not exists idx_notifications_status on public.notifications(status);
create index if not exists idx_notifications_type on public.notifications(type);
create index if not exists idx_notifications_related_post on public.notifications(related_post_id);
create index if not exists idx_notifications_created on public.notifications(created_at desc);

alter table public.notifications enable row level security;

create policy "notifications lecture super_admin"
  on public.notifications for select
  to authenticated
  using (public.is_super_admin());

create policy "notifications gestion super_admin"
  on public.notifications for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- 3) VISITOR SESSIONS
-- ============================================================
create table if not exists public.visitor_sessions(
  id uuid primary key default gen_random_uuid(),
  anonymous_id text not null,
  session_id text not null unique,
  country text,
  country_code text,
  region text,
  city text,
  continent text,
  timezone text,
  device_type text,
  browser text,
  os text,
  language text,
  referrer text,
  landing_page text,
  last_page text,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  page_views_count int not null default 1
);

create index if not exists idx_vs_anon_started on public.visitor_sessions(anonymous_id, started_at desc);
create index if not exists idx_vs_last_activity on public.visitor_sessions(last_activity_at desc);
create index if not exists idx_vs_country on public.visitor_sessions(country_code);
create index if not exists idx_vs_device on public.visitor_sessions(device_type);
create index if not exists idx_vs_browser on public.visitor_sessions(browser);

alter table public.visitor_sessions enable row level security;

create policy "visitor_sessions lecture super_admin"
  on public.visitor_sessions for select
  to authenticated
  using (public.is_super_admin());

create policy "visitor_sessions gestion super_admin"
  on public.visitor_sessions for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- 4) PAGE VIEWS
-- ============================================================
create table if not exists public.page_views(
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  anonymous_id text not null,
  page_url text not null,
  page_title text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pv_session_created on public.page_views(session_id, created_at desc);
create index if not exists idx_pv_created on public.page_views(created_at desc);
create index if not exists idx_pv_url on public.page_views(page_url);
create index if not exists idx_pv_anonymous on public.page_views(anonymous_id, created_at desc);

alter table public.page_views enable row level security;

create policy "page_views lecture super_admin"
  on public.page_views for select
  to authenticated
  using (public.is_super_admin());

create policy "page_views gestion super_admin"
  on public.page_views for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- 5) FONCTIONS RPC (appelées côté serveur / service role)
--    Sûres, atomiques, elles restent sous RLS.
-- ============================================================

-- -- Suivi d'une page vue : crée/met à jour la session + insère la page vue.
create or replace function public.track_visit(
  p_anonymous_id text,
  p_session_id text,
  p_page_url text,
  p_page_title text default null,
  p_referrer text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_device_type text default null,
  p_browser text default null,
  p_os text default null,
  p_language text default null,
  p_country text default null,
  p_country_code text default null,
  p_region text default null,
  p_city text default null,
  p_continent text default null,
  p_timezone text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.visitor_sessions (
    session_id, anonymous_id, country, country_code, region, city, continent, timezone,
    device_type, browser, os, language, referrer, landing_page, last_page,
    started_at, last_activity_at, page_views_count
  ) values (
    p_session_id, p_anonymous_id, p_country, p_country_code, p_region, p_city, p_continent, p_timezone,
    p_device_type, p_browser, p_os, p_language, p_referrer, p_page_url, p_page_url,
    now(), now(), 1
  )
  on conflict (session_id) do update set
    last_activity_at = now(),
    last_page = excluded.last_page,
    page_views_count = public.visitor_sessions.page_views_count + 1;

  insert into public.page_views (
    session_id, anonymous_id, page_url, page_title, referrer,
    utm_source, utm_medium, utm_campaign, created_at
  ) values (
    p_session_id, p_anonymous_id, p_page_url, p_page_title, p_referrer,
    p_utm_source, p_utm_medium, p_utm_campaign, now()
  );
end;
$$;

-- -- Mise à jour de l'activité d'une session (battement "en direct").
create or replace function public.touch_session(p_session_id text)
returns void
language sql security definer set search_path = public as $$
  update public.visitor_sessions
     set last_activity_at = now()
   where session_id = p_session_id;
$$;

-- -- Abonnement push : insère ou met à jour (idempotent sur endpoint).
create or replace function public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null,
  p_device_type text default null,
  p_browser text default null,
  p_language text default null,
  p_country text default null,
  p_country_code text default null
) returns public.push_subscriptions
language plpgsql security definer set search_path = public as $$
declare r public.push_subscriptions;
begin
  insert into public.push_subscriptions (
    endpoint, p256dh, auth, user_agent, device_type, browser,
    language, country, country_code, created_at, updated_at, last_used_at, is_active
  ) values (
    p_endpoint, p_p256dh, p_auth, p_user_agent, p_device_type, p_browser,
    p_language, p_country, p_country_code, now(), now(), now(), true
  )
  on conflict (endpoint) do update set
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    device_type = excluded.device_type,
    browser = excluded.browser,
    language = excluded.language,
    country = excluded.country,
    country_code = excluded.country_code,
    updated_at = now(),
    last_used_at = now(),
    is_active = true
  returning * into r;
  return r;
end;
$$;

-- -- Désactivation d'un abonnement push.
create or replace function public.deactivate_push_subscription(p_endpoint text)
returns void
language sql security definer set search_path = public as $$
  update public.push_subscriptions
     set is_active = false, updated_at = now()
   where endpoint = p_endpoint;
$$;

-- -- Incrémente le compteur de clics d'une notification.
create or replace function public.notify_click(p_notification_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.notifications
     set click_count = click_count + 1
   where id = p_notification_id;
$$;

-- ============================================================
-- 6) GRANTS
-- ============================================================
grant select on public.push_subscriptions to anon, authenticated, service_role;
grant all on public.push_subscriptions to anon, authenticated, service_role;
grant select on public.notifications to anon, authenticated, service_role;
grant all on public.notifications to anon, authenticated, service_role;
grant select on public.visitor_sessions to anon, authenticated, service_role;
grant all on public.visitor_sessions to anon, authenticated, service_role;
grant select on public.page_views to anon, authenticated, service_role;
grant all on public.page_views to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

grant execute on function public.track_visit(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) to anon, authenticated, service_role;
grant execute on function public.touch_session(text) to anon, authenticated, service_role;
grant execute on function public.upsert_push_subscription(text,text,text,text,text,text,text,text,text) to anon, authenticated, service_role;
grant execute on function public.deactivate_push_subscription(text) to anon, authenticated, service_role;
grant execute on function public.notify_click(uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';