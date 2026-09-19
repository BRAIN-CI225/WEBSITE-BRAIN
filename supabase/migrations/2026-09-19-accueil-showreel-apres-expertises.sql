-- ============================================================
-- BRAIN CMS — ACCUEIL : SHOWREEL JUSTE APRÈS « NOS EXPERTISES »
-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Déplace la section "video" (showreel) de la page d'accueil
-- juste après la section "services" (Nos expertises).
-- Idempotent : peut être relancé sans risque.
-- ============================================================

do $$
declare
  v_page uuid;
begin
  select id into v_page from public.pages where slug = 'home';
  if v_page is null then
    raise notice 'Page home introuvable, rien à faire.';
    return;
  end if;

  -- Déjà en position (3 = juste après services) ? Ne rien faire.
  if exists (
    select 1 from public.page_sections
    where page_id = v_page and section_type = 'video' and display_order = 3
  ) then
    return;
  end if;

  -- Décale toutes les sections suivantes (ordre >= 3) d'un cran, hors showreel
  update public.page_sections
     set display_order = display_order + 1
   where page_id = v_page
     and section_type <> 'video'
     and display_order >= 3;

  -- Place le showreel juste après "Nos expertises" (services, ordre 2)
  update public.page_sections
     set display_order = 3
   where page_id = v_page
     and section_type = 'video';
end $$;

notify pgrst, 'reload schema';