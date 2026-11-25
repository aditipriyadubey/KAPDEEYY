-- Closet Remix — migration 003: private Storage buckets + per-user folder policies.
-- Object path convention: <user_id>/<filename>  (first folder = owner's auth uid)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('wardrobe-original',  'wardrobe-original',  false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('wardrobe-segmented', 'wardrobe-segmented', false, 10485760, array['image/png','image/webp']),
  ('wardrobe-temp',      'wardrobe-temp',      false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy wardrobe_storage_select on storage.objects
  for select to authenticated
  using (bucket_id in ('wardrobe-original','wardrobe-segmented','wardrobe-temp')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy wardrobe_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id in ('wardrobe-original','wardrobe-segmented','wardrobe-temp')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy wardrobe_storage_update on storage.objects
  for update to authenticated
  using (bucket_id in ('wardrobe-original','wardrobe-segmented','wardrobe-temp')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy wardrobe_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('wardrobe-original','wardrobe-segmented','wardrobe-temp')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
