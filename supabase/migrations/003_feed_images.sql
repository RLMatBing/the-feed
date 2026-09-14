insert into storage.buckets (id, name, public)
values ('feed-images', 'feed-images', true)
on conflict (id) do update set public = true;

drop policy if exists "feed images public read" on storage.objects;
create policy "feed images public read"
on storage.objects
for select
using (bucket_id = 'feed-images');

drop policy if exists "feed images public insert" on storage.objects;
create policy "feed images public insert"
on storage.objects
for insert
with check (bucket_id = 'feed-images');
