-- Черновик: схема базы данных для Supabase.
-- Запустите целиком в Supabase → SQL Editor → New query → Run.

-- ============ Таблицы ============

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nick       text not null unique check (nick ~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,22}[A-Za-z0-9]$'),
  uni        text,
  bio        text not null default '',
  avatar     text not null default 'a1' check (avatar ~ '^a[1-8]$'),   -- готовый аватар из набора, фото не загружаются
  socials    jsonb not null default '{}'::jsonb,   -- {"vk": "...", "telegram": "...", "behance": "..."}
  role       text not null default 'author' check (role in ('author', 'reviewer', 'admin')),
  consent_at      timestamptz not null default now(),   -- когда пользователь дал согласие (отметка при регистрации)
  consent_version text not null default '2026-11',      -- версия текста согласия
  created_at timestamptz not null default now()
);

-- Ник уникален без учёта регистра (Mila и mila это один и тот же ник).
create unique index profiles_nick_lower_idx on public.profiles (lower(nick));

create table public.works (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 140),
  form         text not null check (form in ('Проза', 'Стихи', 'Иллюстрация', 'Фото', 'Музыка')),
  uni          text,
  body         text not null check (char_length(body) <= 50000),
  description  text not null default '' check (char_length(description) <= 1000),
  tags         text[] not null default '{}' check (cardinality(tags) <= 5 and array_position(tags, null) is null),
  cover_url    text,
  attachments  jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  status       text not null default 'review' check (status in ('review', 'published', 'fix', 'rejected')),
  editor_note  text,
  views        integer not null default 0,
  created_at   timestamptz not null default now(),
  published_at timestamptz
);
create index works_status_idx on public.works (status, created_at desc);
create index works_author_idx on public.works (author_id);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  work_id    uuid not null references public.works(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  parent_id  uuid references public.comments(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_work_idx on public.comments (work_id, created_at);
create index comments_parent_idx on public.comments (parent_id, created_at);

create table public.reactions (
  work_id uuid not null references public.works(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind    text not null check (kind in ('like', 'hit', 'more')),
  primary key (work_id, user_id, kind)
);

create table public.comment_reactions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('work', 'comment')),
  target_id   uuid not null,
  reason      text not null,
  note        text not null default '',
  status      text not null default 'new' check (status in ('new', 'done')),
  created_at  timestamptz not null default now()
);

-- ============ Функции ============

-- Проверка роли редактора (security definer, чтобы не упираться в RLS самой таблицы).
create or replace function public.is_reviewer()
returns boolean language sql stable security definer set search_path = public as $
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('reviewer', 'admin', 'editor'));
$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$;

create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = public as $
  select public.is_reviewer();
$;

create or replace function public.set_profile_role(target_profile uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $
declare
  old_role text;
begin
  if not public.is_admin() then raise exception 'Недостаточно прав'; end if;
  if new_role not in ('author', 'reviewer', 'admin') then raise exception 'Недопустимая роль'; end if;
  if target_profile = auth.uid() then raise exception 'Нельзя менять собственную роль'; end if;
  select role into old_role from public.profiles where id = target_profile;
  if old_role is null then raise exception 'Пользователь не найден'; end if;
  if old_role = 'admin' and new_role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Нельзя снять роль с последнего администратора';
  end if;
  update public.profiles set role = new_role where id = target_profile;
end;
$;
revoke all on function public.set_profile_role(uuid, text) from public, anon;
grant execute on function public.set_profile_role(uuid, text) to authenticated;

-- Профиль создаётся автоматически при регистрации. Ник и вуз приходят из метаданных signUp.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nick, uni, avatar)
  values (
    new.id,
    new.raw_user_meta_data->>'nick',
    new.raw_user_meta_data->>'uni',
    case when new.raw_user_meta_data->>'avatar' ~ '^a[1-8]$' then new.raw_user_meta_data->>'avatar' else 'a1' end
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Счётчик просмотров (обычный update запрещён политиками, поэтому через функцию).
create or replace function public.increment_views(work_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.works set views = views + 1 where id = work_id and status = 'published';
$$;

-- Пользователь может сам удалить аккаунт: вместе с ним удаляются профиль, работы, комментарии и реакции.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $
begin
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Перед удалением последнего администратора назначьте другого';
  end if;
  delete from auth.users where id = auth.uid();
end;
$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ============ Row Level Security ============

alter table public.profiles  enable row level security;
alter table public.works     enable row level security;
alter table public.comments  enable row level security;
alter table public.reactions enable row level security;
alter table public.reports   enable row level security;

-- profiles: публичный профиль виден всем (почта здесь не хранится), менять можно только свой, роль менять нельзя.
create policy "profiles: read all" on public.profiles for select using (true);
create policy "profiles: update own" on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

-- works: читать опубликованное всем; свои и всё для редакторов.
create policy "works: read" on public.works for select
  using (status = 'published' or author_id = auth.uid() or public.is_reviewer());
create policy "works: insert own for review" on public.works for insert
  with check (author_id = auth.uid() and status = 'review');
create policy "works: author edits while review or fix" on public.works for update
  using (author_id = auth.uid() and status in ('review', 'fix'))
  with check (author_id = auth.uid() and status = 'review');
create policy "works: editor updates" on public.works for update
  using (public.is_reviewer()) with check (public.is_reviewer());
create policy "works: delete own or editor" on public.works for delete
  using (author_id = auth.uid() or public.is_reviewer());

-- comments: комментировать опубликованные работы могут только авторизованные.
create policy "comments: read visible" on public.comments for select
  using (hidden = false or author_id = auth.uid() or public.is_reviewer());
create policy "comments: insert own" on public.comments for insert
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.works w where w.id = work_id and w.status = 'published')
    and (
      parent_id is null
      or exists (select 1 from public.comments parent where parent.id = comments.parent_id and parent.work_id = comments.work_id and parent.parent_id is null and parent.hidden = false)
    )
  );
create policy "comments: editor hides" on public.comments for update
  using (public.is_reviewer()) with check (public.is_reviewer());
create policy "comments: delete own or editor" on public.comments for delete
  using (author_id = auth.uid() or public.is_reviewer());

-- reactions: видны всем, ставить и снимать можно только свои.
create policy "reactions: read all" on public.reactions for select using (true);
create policy "reactions: insert own" on public.reactions for insert with check (user_id = auth.uid());
create policy "reactions: delete own" on public.reactions for delete using (user_id = auth.uid());

-- reports: подавать может любой вошедший, читать и закрывать только редакторы.
create policy "reports: insert own" on public.reports for insert with check (reporter_id = auth.uid());
create policy "reports: editor reads" on public.reports for select using (public.is_reviewer());
create policy "reports: editor updates" on public.reports for update
  using (public.is_reviewer()) with check (public.is_reviewer());

-- Лайки комментариев
alter table public.comment_reactions enable row level security;
create policy "comment reactions: read all" on public.comment_reactions for select using (true);
create policy "comment reactions: insert own" on public.comment_reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.comments c where c.id = comment_id and c.hidden = false));
create policy "comment reactions: delete own" on public.comment_reactions for delete to authenticated
  using (user_id = auth.uid());
grant select on public.comment_reactions to anon, authenticated;
grant insert, delete on public.comment_reactions to authenticated;

-- ============ Хранилище обложек ============

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 52428800, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "covers: public read" on storage.objects for select using (bucket_id = 'covers');
create policy "covers: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "covers: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============ После регистрации первого редактора ============
-- update public.profiles set role = 'editor' where nick = 'ваш_ник';


-- ============ Настройки сайта ============
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


-- Подписки на авторов
create table if not exists public.author_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, author_id),
  constraint author_follows_no_self check (follower_id <> author_id)
);
create index if not exists author_follows_author_idx on public.author_follows(author_id);
alter table public.author_follows enable row level security;
create policy "follows: read counts" on public.author_follows for select to anon, authenticated using (true);
create policy "follows: insert own" on public.author_follows for insert to authenticated with check ((select auth.uid()) = follower_id and follower_id <> author_id);
create policy "follows: delete own" on public.author_follows for delete to authenticated using ((select auth.uid()) = follower_id);
grant select on public.author_follows to anon, authenticated;
grant insert, delete on public.author_follows to authenticated;


-- ============ Галереи и аудиовложения работ ============

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-media',
  'work-media',
  true,
  52428800,
  array[
    'image/jpeg','image/png','image/webp',
    'audio/mpeg','audio/mp3','audio/mp4','audio/aac',
    'audio/ogg','audio/wav','audio/x-wav','audio/webm','audio/flac'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "work media public read" on storage.objects
  for select using (bucket_id = 'work-media');
create policy "work media upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'work-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "work media delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'work-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
