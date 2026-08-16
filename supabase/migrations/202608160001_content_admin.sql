-- EnglishApp content and product schema.
-- Safe to run against the existing project: existing tables are extended,
-- new product/content tables are created idempotently.

create extension if not exists pgcrypto;

alter table public.courses
  add column if not exists course_type text not null default 'main'
    check (course_type in ('main', 'additional')),
  add column if not exists access_tier text not null default 'free'
    check (access_tier in ('free', 'basic', 'premium', 'purchase')),
  add column if not exists price numeric(10,2),
  add column if not exists description text,
  add column if not exists is_published boolean not null default false,
  add column if not exists sort_order integer not null default 0;

alter table public.lessons
  add column if not exists access_tier text not null default 'free'
    check (access_tier in ('free', 'basic', 'premium', 'purchase')),
  add column if not exists is_published boolean not null default false;

alter table public.cards
  add column if not exists level text not null default 'A1',
  add column if not exists card_type text not null default 'standard'
    check (card_type in ('standard', 'irregular_verb')),
  add column if not exists infinitive text,
  add column if not exists past_simple text,
  add column if not exists past_participle text,
  add column if not exists transcription text,
  add column if not exists example text,
  add column if not exists audio_url text;

-- The same word may intentionally appear in multiple lessons. Duplicates are
-- surfaced in the admin UI, so do not enforce uniqueness at database level.
drop index if exists public.cards_unique_standard_word;
drop index if exists public.cards_unique_irregular_verb;
create index if not exists cards_word_level_lookup
  on public.cards (lower(trim(original_word)), level);
create index if not exists cards_infinitive_level_lookup
  on public.cards (lower(trim(coalesce(infinitive, original_word))), level);

create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null,
  instructions text,
  task_type text not null default 'text'
    check (task_type in ('text','quiz','matching','ordering','speech','free_answer')),
  content jsonb not null default '{}'::jsonb,
  ai_review boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  icon_url text,
  condition_type text not null default 'lessons_completed',
  condition_value integer not null default 1,
  reward_currency integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cosmetics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  cosmetic_type text not null check (cosmetic_type in ('avatar','frame')),
  image_url text not null,
  price_currency integer not null default 0,
  access_tier text not null default 'free'
    check (access_tier in ('free','basic','premium')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('basic_monthly','basic_yearly','premium_monthly','premium_yearly')),
  title text not null,
  tier text not null check (tier in ('basic','premium')),
  billing_period text not null check (billing_period in ('month','year')),
  price numeric(10,2) not null,
  currency text not null default 'UAH',
  ai_requests_limit integer,
  reward_currency integer not null default 0,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent','fixed','trial_days','currency')),
  discount_value numeric(10,2) not null,
  plan_tier text check (plan_tier in ('basic','premium')),
  usage_limit integer,
  used_count integer not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  channel text,
  campaign text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Runtime tables used by the mobile application.
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null,
  referred_id uuid not null unique,
  source_id uuid references public.marketing_sources(id) on delete set null,
  reward_status text not null default 'pending',
  created_at timestamptz not null default now()
);
create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  plan_id uuid references public.subscription_plans(id), status text not null,
  starts_at timestamptz not null, ends_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.user_achievements (
  user_id uuid not null, achievement_id uuid references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(), primary key (user_id, achievement_id)
);
create table if not exists public.user_inventory (
  user_id uuid not null, cosmetic_id uuid references public.cosmetics(id) on delete cascade,
  equipped boolean not null default false, acquired_at timestamptz not null default now(),
  primary key (user_id, cosmetic_id)
);
create table if not exists public.user_learning_stats (
  user_id uuid primary key, lessons_completed integer not null default 0,
  cards_learned integer not null default 0, total_minutes integer not null default 0,
  current_streak integer not null default 0, longest_streak integer not null default 0,
  currency_balance integer not null default 0, last_activity_date date
);
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  feature text not null, requests_used integer not null default 1,
  created_at timestamptz not null default now()
);
create table if not exists public.attribution_events (
  id uuid primary key default gen_random_uuid(), user_id uuid,
  source_id uuid references public.marketing_sources(id) on delete set null,
  event_name text not null default 'install', metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_course_purchases (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  amount numeric(10,2), purchased_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create table if not exists public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references public.homework(id) on delete cascade,
  user_id uuid not null, answer jsonb not null default '{}'::jsonb,
  audio_url text, recognized_text text, ai_score numeric(5,2), ai_feedback text,
  status text not null default 'submitted', submitted_at timestamptz not null default now()
);
create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(), promo_code_id uuid not null references public.promo_codes(id),
  user_id uuid not null, redeemed_at timestamptz not null default now(), unique (promo_code_id, user_id)
);
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  amount integer not null, reason text not null, reference_id uuid,
  created_at timestamptz not null default now()
);

alter table public.homework enable row level security;
alter table public.achievements enable row level security;
alter table public.cosmetics enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.promo_codes enable row level security;
alter table public.marketing_sources enable row level security;

-- Existing admin uses the anon key. These policies preserve that workflow.
-- Replace with authenticated-admin policies before production launch.
do $$
declare t text;
begin
  foreach t in array array['homework','achievements','cosmetics','subscription_plans','promo_codes','marketing_sources']
  loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all using (true) with check (true)', t);
  end loop;
end $$;
