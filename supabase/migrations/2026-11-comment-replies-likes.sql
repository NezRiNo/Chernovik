-- Ответы на комментарии и сердечки.
-- Выполнить один раз в Supabase SQL Editor для уже работающего проекта.

alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade;
create index if not exists comments_parent_idx on public.comments (parent_id, created_at);

drop policy if exists "comments: insert own" on public.comments;
create policy "comments: insert own" on public.comments for insert
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.works w where w.id = work_id and w.status = 'published')
    and (
      parent_id is null
      or exists (
        select 1 from public.comments parent
        where parent.id = comments.parent_id
          and parent.work_id = comments.work_id
          and parent.parent_id is null
          and parent.hidden = false
      )
    )
  );

create table if not exists public.comment_reactions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table public.comment_reactions enable row level security;

drop policy if exists "comment reactions: read all" on public.comment_reactions;
create policy "comment reactions: read all" on public.comment_reactions
  for select using (true);
drop policy if exists "comment reactions: insert own" on public.comment_reactions;
create policy "comment reactions: insert own" on public.comment_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.comments c where c.id = comment_id and c.hidden = false)
  );
drop policy if exists "comment reactions: delete own" on public.comment_reactions;
create policy "comment reactions: delete own" on public.comment_reactions
  for delete to authenticated using (user_id = auth.uid());

grant select on public.comment_reactions to anon, authenticated;
grant insert, delete on public.comment_reactions to authenticated;
