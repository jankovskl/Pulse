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

-- Profile system: bio, avatar decoration, pickable widgets and public stats.
-- `stats` is published by the owner's own device (sessions live in the private
-- user_data table, so other users cannot compute them).
-- `is_admin` is granted manually for now, e.g.:
--   update public.profiles set is_admin = true where user_id = '<uuid>';
-- (an app-level grant mechanism is planned later)
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists decoration text;
alter table public.profiles add column if not exists widgets jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists stats jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists is_admin boolean not null default false;

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

-- 6. Anti-exploit guard for public profiles -----------------------------------
-- RLS lets owners write their own profile row, so without this a user could
-- fake `stats` (instant achievements) or set `is_admin` on themselves.
-- The trigger sanitizes every write:
--   * sessions may grow by at most 1 per elapsed calendar day since the last
--     publish (1 workout day = 1 session, by definition), and at most 60 on
--     the very first publish (the size of the device session history);
--   * streak / bestStreak can never exceed sessions or 365;
--   * best lift capped at 700 kg, exercises at 500, and the published best
--     is cross-checked against the user's guarded lifts rows;
--   * the per-muscle-group bests (stats.groups) are each cross-checked
--     against the guarded lifts rows of that group;
--   * a decoration is rejected (reverted to the previous one) unless the
--     sanitized stats actually satisfy its unlock requirement;
--   * is_admin can only change via the service_role (manual admin SQL),
--     never via a normal client write;
--   * updated_at is always stamped server-side so it can't be backdated to
--     inflate the allowed session growth.
create or replace function public.stat_as_int(s jsonb, k text, fallback int)
returns int
language sql immutable as $$
  select case when s ->> k ~ '^\d{1,7}$' then (s ->> k)::int else fallback end;
$$;

create or replace function public.guard_profile_stats()
returns trigger
language plpgsql
as $$
declare
  s jsonb := coalesce(new.stats, '{}'::jsonb);
  o jsonb := case when tg_op = 'UPDATE' then coalesce(old.stats, '{}'::jsonb) else '{}'::jsonb end;
  f_sessions int := public.stat_as_int(s, 'sessions', public.stat_as_int(o, 'sessions', 0));
  f_streak int := public.stat_as_int(s, 'streak', public.stat_as_int(o, 'streak', 0));
  f_best_streak int := public.stat_as_int(s, 'bestStreak', public.stat_as_int(o, 'bestStreak', 0));
  f_best int := public.stat_as_int(s, 'best', public.stat_as_int(o, 'best', 0));
  f_exercises int := public.stat_as_int(s, 'exercises', public.stat_as_int(o, 'exercises', 0));
  elapsed_days int;
  lift_max numeric;
  g jsonb;
  gk text;
  gval int;
  grp_max numeric;
  g_chest int := 0;
  g_legs int := 0;
  g_back int := 0;
  g_shoulders int := 0;
  g_arms int := 0;
  req_role text := coalesce(current_setting('request.jwt.role', true), '');
begin
  -- Clamp stats -------------------------------------------------------------
  if tg_op = 'INSERT' then
    f_sessions := least(f_sessions, 60);
  else
    elapsed_days := greatest(0, floor(extract(epoch from (now() - old.updated_at)) / 86400.0)::int);
    if f_sessions > public.stat_as_int(o, 'sessions', 0) then
      f_sessions := least(f_sessions, public.stat_as_int(o, 'sessions', 0) + elapsed_days + 1);
    end if;
  end if;
  f_streak := least(f_streak, f_sessions, 365);
  f_best_streak := least(f_best_streak, f_sessions, 365);
  f_best := least(f_best, 700);
  -- Cross-check: the published best lift can never exceed the user's actual
  -- (already guarded) lifts rows; with no lifts at all, first-entry cap.
  select max(weight) into lift_max from public.lifts where user_id = new.user_id;
  f_best := least(f_best, coalesce(lift_max, 100)::int);
  f_exercises := least(f_exercises, 500);

  -- Per-muscle-group bests: each one is cross-checked against the user's
  -- guarded lifts rows of that group (with no lifts, the group's first-entry
  -- cap applies, same as a fresh first lift). Unknown keys are dropped.
  if s ? 'groups' then
    g := '{}'::jsonb;
    if jsonb_typeof(s -> 'groups') = 'object' then
      foreach gk in array array['chest', 'legs', 'back', 'shoulders', 'arms'] loop
        gval := case when (s -> 'groups') ->> gk ~ '^\d{1,7}$'
          then ((s -> 'groups') ->> gk)::int else 0 end;
        select coalesce(max(weight), 0) into grp_max
          from public.lifts
          where user_id = new.user_id and public.muscle_group(exercise) = gk;
        gval := least(gval, 700,
          case when grp_max > 0 then grp_max::int
               else (public.muscle_group_rules(gk)).first_cap::int end);
        g := jsonb_set(g, array[gk], to_jsonb(gval));
      end loop;
    end if;
    s := jsonb_set(s, '{groups}', g);
    g_chest := coalesce((s -> 'groups' ->> 'chest')::int, 0);
    g_legs := coalesce((s -> 'groups' ->> 'legs')::int, 0);
    g_back := coalesce((s -> 'groups' ->> 'back')::int, 0);
    g_shoulders := coalesce((s -> 'groups' ->> 'shoulders')::int, 0);
    g_arms := coalesce((s -> 'groups' ->> 'arms')::int, 0);
  end if;

  if s ? 'sessions' then s := jsonb_set(s, '{sessions}', to_jsonb(f_sessions)); end if;
  if s ? 'streak' then s := jsonb_set(s, '{streak}', to_jsonb(f_streak)); end if;
  if s ? 'bestStreak' then s := jsonb_set(s, '{bestStreak}', to_jsonb(f_best_streak)); end if;
  if s ? 'best' then s := jsonb_set(s, '{best}', to_jsonb(f_best)); end if;
  if s ? 'exercises' then s := jsonb_set(s, '{exercises}', to_jsonb(f_exercises)); end if;
  new.stats := s;

  -- Decoration must be unlocked by the sanitized stats -----------------------
  if new.decoration is not null and new.decoration not in ('none', 'accent') then
    if not (
      (new.decoration = 'glow' and f_sessions >= 25) or
      (new.decoration = 'flame' and f_best_streak >= 7) or
      (new.decoration = 'gold' and f_sessions >= 100) or
      (new.decoration = 'cat-ears' and f_exercises >= 10) or
      (new.decoration = 'crown' and f_best >= 150) or
      (new.decoration = 'halo' and f_best_streak >= 30) or
      (new.decoration = 'aurora' and f_sessions >= 50) or
      (new.decoration = 'neon' and f_best >= 100) or
      (new.decoration = 'starfall' and f_sessions >= 365) or
      (new.decoration = 'plate' and g_chest >= 100) or
      (new.decoration = 'wings' and g_back >= 120) or
      (new.decoration = 'forge' and g_chest >= 150) or
      (new.decoration = 'title-iron-arms' and g_arms >= 50) or
      (new.decoration = 'title-cannon' and g_shoulders >= 70) or
      (new.decoration = 'title-colossus' and g_legs >= 200) or
      (new.decoration = 'title-earthshaker' and g_legs >= 300)
    ) then
      new.decoration := case when tg_op = 'UPDATE' then old.decoration else null end;
    end if;
  end if;

  -- is_admin is only grantable with the service role (manual SQL) ------------
  if req_role <> 'service_role' then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    elsif new.is_admin is distinct from old.is_admin then
      new.is_admin := old.is_admin;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists "guard profile" on public.profiles;
create trigger "guard profile"
  before insert or update on public.profiles
  for each row execute function public.guard_profile_stats();

-- 7. Anti-cheat guard for lifts (feeds the leaderboard) ------------------------
-- Owners can write their own lifts rows, so this trigger applies the same
-- progression rules as the client (lib/integrity.js), per muscle group:
--   * muscle_group() classifies each exercise (legs/back/chest/shoulders/arms);
--   * first-ever lift is capped at the group's first-entry cap (legs 200 kg,
--     back 140, chest 110, shoulders 80, arms 60);
--   * same-day growth is capped at the group's flat step;
--   * growth after 20+ hours is capped at the bigger of step or factor %;
--   * every weight is capped at the group's world-record-style ceiling.
-- Typing a huge number out of nowhere still can't cheat, but honest lifters
-- are no longer punished on lifts where big plates are normal (legs, back).
create or replace function public.muscle_group(ex text)
returns text
language sql immutable as $$
  select case
    when lower(ex) like '%squat%' or lower(ex) like '%deadlift%' or lower(ex) like '%leg%'
      or lower(ex) like '%lunge%' or lower(ex) like '%calf%' or lower(ex) like '%glute%'
      or lower(ex) like '%hip thrust%' then 'legs'
    when lower(ex) like '%bench%' or lower(ex) like '%chest%' or lower(ex) like '%fly%'
      or lower(ex) like '%push-up%' or lower(ex) like '%push up%' then 'chest'
    when lower(ex) like '%row%' or lower(ex) like '%pull-up%' or lower(ex) like '%pull up%'
      or lower(ex) like '%pulldown%' or lower(ex) like '%pull down%' or lower(ex) like '%chin-up%'
      or lower(ex) like '%chin up%' or lower(ex) like '%lat%' then 'back'
    when lower(ex) like '%press%' or lower(ex) like '%shoulder%'
      or lower(ex) like '%raise%' or lower(ex) like '%shrug%' then 'shoulders'
    when lower(ex) like '%curl%' or lower(ex) like '%tricep%' or lower(ex) like '%bicep%'
      or lower(ex) like '%dip%' or lower(ex) like '%extension%' or lower(ex) like '%kickback%' then 'arms'
    else 'other'
  end;
$$;

-- Progression rules per group (mirrors MUSCLE_GROUPS in lib/integrity.js).
create or replace function public.muscle_group_rules(g text,
  out first_cap numeric, out step numeric, out factor numeric, out ceiling numeric)
language sql immutable as $$
  select
    case g when 'legs' then 200 when 'back' then 140 when 'chest' then 110
      when 'shoulders' then 80 when 'arms' then 60 else 100 end,
    case g when 'legs' then 25 when 'back' then 15 when 'chest' then 10
      when 'shoulders' then 8 when 'arms' then 6 else 10 end,
    case g when 'legs' then 1.2 when 'back' then 1.15 when 'chest' then 1.1
      when 'shoulders' then 1.12 when 'arms' then 1.12 else 1.1 end,
    case g when 'legs' then 620 when 'back' then 520 when 'chest' then 410
      when 'shoulders' then 380 when 'arms' then 160 else 500 end;
$$;

-- The old per-name ceiling function is replaced by muscle_group_rules().
drop function if exists public.lift_ceiling(text);

create or replace function public.guard_lifts()
returns trigger
language plpgsql
as $$
declare
  rules record := public.muscle_group_rules(public.muscle_group(new.exercise));
  growth_limit numeric;
  -- True only inside the SECURITY DEFINER seed_lifts() call; a client that
  -- sets the GUC itself still has current_user = session_user.
  seeding boolean := coalesce(current_setting('pulse.seeding', true), '') = 'on'
    and current_user <> session_user;
begin
  if tg_op = 'INSERT' then
    new.weight := least(greatest(new.weight, 0),
      case when seeding then rules.ceiling else least(rules.first_cap, rules.ceiling) end);
    new.at := now();
  elsif new.weight > old.weight then
    growth_limit := case
      when now() - old.at >= interval '20 hours'
        then greatest(old.weight + rules.step, old.weight * rules.factor)
      else old.weight + rules.step
    end;
    new.weight := least(new.weight, growth_limit, rules.ceiling);
    new.at := case when new.weight > old.weight then now() else old.at end;
  else
    new.weight := greatest(new.weight, 0);
    new.at := old.at;
  end if;
  return new;
end;
$$;

drop trigger if exists "guard lifts" on public.lifts;
create trigger "guard lifts"
  before insert or update on public.lifts
  for each row execute function public.guard_lifts();

-- One-shot seeding of lifts from the user's own stored session history.
-- Needed because the very first stats publish happens before any normal
-- recordLift ran. It never trusts client-supplied numbers: it re-reads the
-- private user_data blob and replays each exercise's sessions in date order
-- through the same progression rules the triggers enforce. Does nothing if
-- the user already has lifts rows.
create or replace function public.seed_lifts()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  ex text;
  r record;
  rules record;
  cur numeric;
  lim numeric;
  cnt int := 0;
begin
  if exists (select 1 from public.lifts where user_id = auth.uid()) then
    return 0;
  end if;

  -- Tell "guard lifts" these inserts are a validated replay of real history,
  -- not a fresh first entry (the flag is only honored inside a SECURITY
  -- DEFINER function, so clients can't flip it themselves).
  perform set_config('pulse.seeding', 'on', true);

  for ex in
    select distinct s ->> 'exercise'
    from jsonb_array_elements(coalesce(
      (select data -> 'sessions' from public.user_data where user_id = auth.uid()),
      '[]'::jsonb
    )) as s
    where s ->> 'exercise' is not null
  loop
    rules := public.muscle_group_rules(public.muscle_group(ex));
    cur := null;
    for r in
      select (case when s ->> 'weight' ~ '^\d{1,4}(\.\d+)?$' then (s ->> 'weight')::numeric else 0 end) as weight
      from jsonb_array_elements(coalesce(
        (select data -> 'sessions' from public.user_data where user_id = auth.uid()),
        '[]'::jsonb
      )) as s
      where s ->> 'exercise' = ex
      order by s ->> 'full'
    loop
      lim := case
        when cur is null then least(rules.first_cap, rules.ceiling)
        else least(greatest(cur + rules.step, cur * rules.factor), rules.ceiling)
      end;
      cur := case
        when cur is null or r.weight > cur then least(r.weight, lim)
        else cur
      end;
    end loop;

    if cur is not null and cur > 0 then
      insert into public.lifts (user_id, exercise, weight)
      values (auth.uid(), ex, cur)
      on conflict (user_id, exercise) do nothing;
      cnt := cnt + 1;
    end if;
  end loop;

  return cnt;
end;
$$;

revoke execute on function public.seed_lifts() from anon;

