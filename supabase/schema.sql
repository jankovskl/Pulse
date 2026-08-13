-- Pulse · Supabase schema for cross-device sync + live leaderboard
-- Apply via the Supabase SQL editor (or `supabase db push`).

-- 1. User data (private to each account) -------------------------------------
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "own row only" on public.user_data;
create policy "own row only" on public.user_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Lifts (public best-per-exercise, feeds the leaderboard) ------------------
create table if not exists public.lifts (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise text not null,
  weight numeric not null check (weight >= 0),
  at timestamptz not null default now(),
  primary key (user_id, exercise)
);

alter table public.lifts enable row level security;

drop policy if exists "lifts readable by all" on public.lifts;
create policy "lifts readable by all" on public.lifts
  for select using (true);

drop policy if exists "lifts writable by owner" on public.lifts;
create policy "lifts writable by owner" on public.lifts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Realtime (so a logged-in device's leaderboard entry updates live) -------
do $$
begin
  alter publication supabase_realtime add table public.lifts;
exception
  when duplicate_object then null;
end $$;

-- 4. Profiles (public display name + avatar, shown on the leaderboard) --------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  pfp text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles readable by all" on public.profiles;
create policy "profiles readable by all" on public.profiles
  for select using (true);

drop policy if exists "profiles writable by owner" on public.profiles;
create policy "profiles writable by owner" on public.profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. Avatar storage (public read; owner may write their own file) -------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars owner write" on storage.objects;
create policy "avatars owner write" on storage.objects
  for all
  using (bucket_id = 'avatars' and owner = auth.uid())
  with check (bucket_id = 'avatars' and owner = auth.uid());
