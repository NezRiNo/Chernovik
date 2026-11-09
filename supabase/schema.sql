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
  role       text not null default 'author' check (role in ('author', 'editor')),
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
  cover_url    text,
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
  body       text not null check (char_length(body) between 1 and 2000),
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_work_idx on public.comments (work_id, created_at);

create table public.reactions (
  work_id uuid not null references public.works(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind    text not null check (kind in ('like', 'hit', 'more')),
  primary key (work_id, user_id, kind)
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
create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'editor');
$$;

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
returns void language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;
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
  using (status = 'published' or author_id = auth.uid() or public.is_editor());
create policy "works: insert own for review" on public.works for insert
  with check (author_id = auth.uid() and status = 'review');
create policy "works: author edits while review or fix" on public.works for update
  using (author_id = auth.uid() and status in ('review', 'fix'))
  with check (author_id = auth.uid() and status = 'review');
create policy "works: editor updates" on public.works for update
  using (public.is_editor()) with check (public.is_editor());
create policy "works: delete own or editor" on public.works for delete
  using (author_id = auth.uid() or public.is_editor());

-- comments: комментировать опубликованные работы могут только авторизованные.
create policy "comments: read visible" on public.comments for select
  using (hidden = false or author_id = auth.uid() or public.is_editor());
create policy "comments: insert own" on public.comments for insert
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.works w where w.id = work_id and w.status = 'published')
  );
create policy "comments: editor hides" on public.comments for update
  using (public.is_editor()) with check (public.is_editor());
create policy "comments: delete own or editor" on public.comments for delete
  using (author_id = auth.uid() or public.is_editor());

-- reactions: видны всем, ставить и снимать можно только свои.
create policy "reactions: read all" on public.reactions for select using (true);
create policy "reactions: insert own" on public.reactions for insert with check (user_id = auth.uid());
create policy "reactions: delete own" on public.reactions for delete using (user_id = auth.uid());

-- reports: подавать может любой вошедший, читать и закрывать только редакторы.
create policy "reports: insert own" on public.reports for insert with check (reporter_id = auth.uid());
create policy "reports: editor reads" on public.reports for select using (public.is_editor());
create policy "reports: editor updates" on public.reports for update
  using (public.is_editor()) with check (public.is_editor());

-- ============ Хранилище обложек ============

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "covers: public read" on storage.objects for select using (bucket_id = 'covers');
create policy "covers: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "covers: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============ После регистрации первого редактора ============
-- update public.profiles set role = 'editor' where nick = 'ваш_ник';
