-- Closet Remix — migration 002: Row Level Security
-- Every table is locked to the owning user. `(select auth.uid())` is wrapped in a
-- sub-select so Postgres evaluates it once per query (Supabase performance advice).

alter table public.profiles            enable row level security;
alter table public.wardrobe_items      enable row level security;
alter table public.outfits             enable row level security;
alter table public.outfit_items        enable row level security;
alter table public.saved_outfits       enable row level security;
alter table public.outfit_feedback     enable row level security;
alter table public.outfit_wear_history enable row level security;

-- Table privileges: nothing for anon; authenticated gets only what the app needs.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select, update                 on public.profiles            to authenticated;
grant select, insert, update, delete on public.wardrobe_items      to authenticated;
grant select, insert, delete         on public.outfits             to authenticated;
grant select, insert, delete         on public.outfit_items        to authenticated;
grant select, insert, delete         on public.saved_outfits       to authenticated;
grant select, insert, delete         on public.outfit_feedback     to authenticated;
grant select, insert, delete         on public.outfit_wear_history to authenticated;

-- profiles: read/update own row. Insert happens only via the signup trigger.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- wardrobe_items
create policy wardrobe_select_own on public.wardrobe_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy wardrobe_insert_own on public.wardrobe_items
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy wardrobe_update_own on public.wardrobe_items
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy wardrobe_delete_own on public.wardrobe_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- outfits
create policy outfits_select_own on public.outfits
  for select to authenticated using (user_id = (select auth.uid()));
create policy outfits_insert_own on public.outfits
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy outfits_delete_own on public.outfits
  for delete to authenticated using (user_id = (select auth.uid()));

-- outfit_items: both the outfit AND the wardrobe item must belong to the caller.
create policy outfit_items_select_own on public.outfit_items
  for select to authenticated
  using (exists (select 1 from public.outfits o
                 where o.id = outfit_id and o.user_id = (select auth.uid())));
create policy outfit_items_insert_own on public.outfit_items
  for insert to authenticated
  with check (
    exists (select 1 from public.outfits o
            where o.id = outfit_id and o.user_id = (select auth.uid()))
    and exists (select 1 from public.wardrobe_items w
                where w.id = wardrobe_item_id and w.user_id = (select auth.uid()))
  );
create policy outfit_items_delete_own on public.outfit_items
  for delete to authenticated
  using (exists (select 1 from public.outfits o
                 where o.id = outfit_id and o.user_id = (select auth.uid())));

-- saved_outfits / outfit_feedback / outfit_wear_history
-- (the composite FK (outfit_id, user_id) already forces the outfit to be the caller's)
create policy saved_select_own on public.saved_outfits
  for select to authenticated using (user_id = (select auth.uid()));
create policy saved_insert_own on public.saved_outfits
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy saved_delete_own on public.saved_outfits
  for delete to authenticated using (user_id = (select auth.uid()));

create policy feedback_select_own on public.outfit_feedback
  for select to authenticated using (user_id = (select auth.uid()));
create policy feedback_insert_own on public.outfit_feedback
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy feedback_delete_own on public.outfit_feedback
  for delete to authenticated using (user_id = (select auth.uid()));

create policy history_select_own on public.outfit_wear_history
  for select to authenticated using (user_id = (select auth.uid()));
create policy history_insert_own on public.outfit_wear_history
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy history_delete_own on public.outfit_wear_history
  for delete to authenticated using (user_id = (select auth.uid()));
