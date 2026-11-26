-- Добавляет теги к работам в уже созданной базе.
-- Безопасно для повторного запуска; существующие записи получают пустой массив.
alter table public.works
  add column if not exists tags text[] not null default '{}';

alter table public.works
  drop constraint if exists works_tags_limit;

alter table public.works
  add constraint works_tags_limit
  check (cardinality(tags) <= 5 and array_position(tags, null) is null);
