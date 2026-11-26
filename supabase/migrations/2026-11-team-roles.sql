-- Роли команды: author, reviewer, admin.
-- Запустить в Supabase SQL Editor для существующей базы после миграции тегов.
-- Переводит старую роль editor в reviewer; авторские данные не меняет.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists profiles_role_allowed;
update public.profiles set role = 'reviewer' where role = 'editor';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_allowed' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_role_allowed check (role in ('author', 'reviewer', 'admin'));
  end if;
end $$;
create or replace function public.is_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('reviewer', 'admin', 'editor'));
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_reviewer();
$$;
create or replace function public.set_profile_role(target_profile uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
declare old_role text;
begin
  if not public.is_admin() then raise exception 'Недостаточно прав'; end if;
  if new_role not in ('author', 'reviewer', 'admin') then raise exception 'Недопустимая роль'; end if;
  if target_profile = auth.uid() then raise exception 'Нельзя менять собственную роль'; end if;
  select role into old_role from public.profiles where id = target_profile;
  if old_role is null then raise exception 'Пользователь не найден'; end if;
  if old_role = 'admin' and new_role <> 'admin' and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Нельзя снять роль с последнего администратора';
  end if;
  update public.profiles set role = new_role where id = target_profile;
end;
$$;
revoke all on function public.set_profile_role(uuid, text) from public, anon;
grant execute on function public.set_profile_role(uuid, text) to authenticated;
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Перед удалением последнего администратора назначьте другого';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
