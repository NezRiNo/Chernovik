-- Галереи изображений и аудиовложения для работ «Черновика».
alter table public.works
  add column if not exists attachments jsonb not null default '[]'::jsonb;

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

drop policy if exists "work media public read" on storage.objects;
create policy "work media public read" on storage.objects
  for select using (bucket_id = 'work-media');

drop policy if exists "work media upload own folder" on storage.objects;
create policy "work media upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'work-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "work media delete own" on storage.objects;
create policy "work media delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'work-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
