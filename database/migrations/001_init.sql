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
