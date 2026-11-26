-- Настройки сайта «Черновик». Выполнить один раз в Supabase SQL Editor.
create table if not exists public.site_settings (
  id text primary key check (id = 'main'),
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "site settings are public" on public.site_settings;
create policy "site settings are public" on public.site_settings for select using (true);
drop policy if exists "admins manage site settings" on public.site_settings;
create policy "admins manage site settings" on public.site_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
insert into public.site_settings (id, settings) values ('main', '{
  "site_name":"Черновик",
  "tagline":"Веб-журнал студентов Новосибирска",
  "home_label":"Веб-журнал студентов Новосибирска",
  "home_heading":"Здесь студенты публикуют то, что пишут, рисуют и снимают",
  "home_lead":"Редактор читает каждую работу. Авторы получают читателей, а не лайки.",
  "theme_title":"Первый снег",
  "theme_description":"Тема необязательная: можно участвовать, а можно публиковать своё.",
  "theme_deadline":"30 ноября",
  "announcement_title":"",
  "announcement_body":"",
  "about_text":"«Черновик» — веб-журнал студентов вузов Новосибирска. Мы помогаем найти аудиторию тем, кто пишет, рисует, снимает и сочиняет, но не знает, где это показать."
}'::jsonb) on conflict (id) do nothing;

-- Column-level API privileges: public can read only site identity/content;
-- authenticated users can submit changes, but RLS permits writes only to admins.
grant select (id, settings) on table public.site_settings to anon, authenticated;
grant insert (id, settings, updated_by) on table public.site_settings to authenticated;
grant update (settings, updated_by, updated_at) on table public.site_settings to authenticated;
