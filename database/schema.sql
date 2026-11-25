-- Closet Remix full schema = migrations 001 + 002 + 003 concatenated (generated; edit the migrations, not this file).

-- ===== migrations/001_init.sql =====
-- Closet Remix — migration 001: core schema
-- Run in the Supabase SQL Editor (or `psql`) BEFORE 002 and 003.
-- Conventions: text + CHECK constraints (easy to evolve), uuid PKs, timestamptz.

-- ── helpers ──────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles ─────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 100),
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile whenever a user registers (name comes from signUp metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── wardrobe_items ───────────────────────────────────────────────
-- category = Roboflow class; occasion is a SEPARATE concept (suggested_occasions).
create table public.wardrobe_items (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  item_name             text not null check (char_length(item_name) between 1 and 80),
  category              text not null
    check (category in ('Tops','Bottoms','Dresses','Outerwear','Shoes','Bags','Other')),
  subcategory           text,
  colour                text,
  colour_hex            text check (colour_hex is null or colour_hex ~ '^#[0-9A-Fa-f]{6}$'),
  pattern               text,
  style                 text,
  suggested_occasions   text[] not null default '{}'
    check (suggested_occasions <@ array['College','Casual','Dinner','Party']),
  season                text
    check (season is null or season in ('Spring','Summer','Autumn','Winter','All-season')),
  original_image_path   text,
  segmented_image_path  text,
  segmentation_status   text not null default 'pending'
    check (segmentation_status in ('pending','completed','failed','manual')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index wardrobe_items_user_category_idx on public.wardrobe_items (user_id, category);
create index wardrobe_items_occasions_idx on public.wardrobe_items using gin (suggested_occasions);

create trigger wardrobe_items_set_updated_at
  before update on public.wardrobe_items
  for each row execute function public.set_updated_at();

-- ── outfits ──────────────────────────────────────────────────────
-- One row per UNIQUE combination per user. combo_key = sorted item ids joined
-- by '|' (built by the backend). The same combination recommended twice maps to
-- the same outfit row, so Not-For-Me / saved / worn all refer to the combination.
create table public.outfits (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  outfit_name           text not null check (char_length(outfit_name) between 1 and 120),
  occasion              text check (occasion is null or occasion in ('College','Casual','Dinner','Party')),
  recommendation_score  numeric(5,2) check (recommendation_score is null or recommendation_score between 0 and 100),
  styling_explanation   text,
  combo_key             text not null,
  created_at            timestamptz not null default now(),
  unique (user_id, combo_key),
  unique (id, user_id)
);

create table public.outfit_items (
  id                uuid primary key default gen_random_uuid(),
  outfit_id         uuid not null references public.outfits (id) on delete cascade,
  wardrobe_item_id  uuid not null references public.wardrobe_items (id) on delete cascade,
  unique (outfit_id, wardrobe_item_id)
);

create index outfit_items_item_idx on public.outfit_items (wardrobe_item_id);

-- Deleting a wardrobe item invalidates every combination containing it, so those
-- outfits (and their saved / feedback / history rows) are removed with it.
create or replace function public.delete_outfits_of_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.outfits
  where id in (select outfit_id from public.outfit_items where wardrobe_item_id = old.id);
  return old;
end;
$$;

create trigger wardrobe_items_delete_outfits
  before delete on public.wardrobe_items
  for each row execute function public.delete_outfits_of_item();

-- ── saved_outfits ────────────────────────────────────────────────
create table public.saved_outfits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  outfit_id  uuid not null,
  saved_at   timestamptz not null default now(),
  unique (user_id, outfit_id),                      -- no duplicate saves
  foreign key (outfit_id, user_id) references public.outfits (id, user_id) on delete cascade
);

create index saved_outfits_user_idx on public.saved_outfits (user_id, saved_at desc);

-- ── outfit_feedback ──────────────────────────────────────────────
create table public.outfit_feedback (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  outfit_id     uuid not null,
  feedback_type text not null check (feedback_type in ('NOT_FOR_ME')),
  created_at    timestamptz not null default now(),
  unique (user_id, outfit_id, feedback_type),
  foreign key (outfit_id, user_id) references public.outfits (id, user_id) on delete cascade
);

create index outfit_feedback_user_idx on public.outfit_feedback (user_id, feedback_type);

-- ── outfit_wear_history ──────────────────────────────────────────
-- worn_on (user-local calendar date, supplied by the backend) + unique key stops
-- duplicate entries from double clicks / retried requests.
create table public.outfit_wear_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  outfit_id  uuid not null,
  worn_at    timestamptz not null default now(),
  worn_on    date not null default current_date,
  occasion   text check (occasion is null or occasion in ('College','Casual','Dinner','Party')),
  unique (user_id, outfit_id, worn_on),
  foreign key (outfit_id, user_id) references public.outfits (id, user_id) on delete cascade
);

create index wear_history_user_worn_idx on public.outfit_wear_history (user_id, worn_at desc);
create index wear_history_outfit_idx on public.outfit_wear_history (outfit_id);

-- ===== migrations/002_rls.sql =====
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

-- ===== migrations/003_storage.sql =====
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
