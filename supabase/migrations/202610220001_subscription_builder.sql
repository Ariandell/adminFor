-- Subscription authoring only. This does not grant a user access, process a
-- purchase, seed paid plans, change RLS policies, or change existing prices.
-- Requires 202608160001_content_admin.sql. Safe to reapply.
begin;

alter table public.subscription_plans
  add column if not exists description text not null default '',
  add column if not exists image_url text,
  add column if not exists entitlements jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- NULL intentionally means "legacy plan, not configured". Never infer a reset
-- period from ai_requests_limit or convert marketing features into permissions.
comment on column public.subscription_plans.entitlements is
  'Versioned subscription configuration, not a user entitlement. NULL = unconfigured legacy plan. Store verification and runtime enforcement are separate.';

create or replace function public.subscription_entitlements_valid(config jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog, public
as $$
declare
  feature_key text;
  rule jsonb;
  expected_period text;
  course_config jsonb;
  course_id jsonb;
  course_ids text[] := array[]::text[];
  normalized_id text;
begin
  if jsonb_typeof(config) is distinct from 'object' then
    return false;
  end if;
  if config - array['version', 'features', 'courses'] <> '{}'::jsonb
     or config -> 'version' is distinct from '1'::jsonb
     or jsonb_typeof(config -> 'features') is distinct from 'object'
     or jsonb_typeof(config -> 'courses') is distinct from 'object' then
    return false;
  end if;

  -- Missing known keys are disabled by consumers. Unknown keys/versions are
  -- rejected so an old editor cannot silently discard a new permission.
  for feature_key, rule in select key, value from jsonb_each(config -> 'features')
  loop
    if feature_key not in (
      'translation', 'speaking_review', 'pronunciation_review', 'personal_cards',
      'flashcards', 'course_dictionary', 'irregular_verbs', 'word_statistics',
      'ai_assistant', 'ai_text_review', 'advanced_statistics', 'premium_cosmetics'
    ) then
      return false;
    end if;
    if jsonb_typeof(rule) is distinct from 'object' then
      return false;
    end if;
    if rule - array['enabled', 'limit', 'period'] <> '{}'::jsonb
       or not (rule ?& array['enabled', 'limit', 'period'])
       or jsonb_typeof(rule -> 'enabled') is distinct from 'boolean' then
      return false;
    end if;

    if rule -> 'enabled' = 'false'::jsonb or rule -> 'limit' = 'null'::jsonb then
      if rule -> 'limit' is distinct from 'null'::jsonb
         or rule -> 'period' is distinct from 'null'::jsonb then
        return false;
      end if;
      continue;
    end if;

    expected_period := case
      when feature_key = 'personal_cards' then 'total'
      when feature_key in ('translation', 'speaking_review', 'pronunciation_review',
                           'flashcards', 'ai_assistant', 'ai_text_review') then 'day'
      else null
    end;
    if expected_period is null
       or jsonb_typeof(rule -> 'limit') is distinct from 'number'
       or (rule ->> 'limit') !~ '^[0-9]{1,7}$'
       or (rule ->> 'limit')::numeric not between 1 and 1000000
       or rule ->> 'period' is distinct from expected_period then
      return false;
    end if;
  end loop;

  course_config := config -> 'courses';
  if course_config - array['mode', 'ids'] <> '{}'::jsonb
     or not (course_config ?& array['mode', 'ids'])
     or jsonb_typeof(course_config -> 'mode') is distinct from 'string'
     or course_config ->> 'mode' not in ('none', 'all', 'selected')
     or jsonb_typeof(course_config -> 'ids') is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(course_config -> 'ids') > 1000 then
    return false;
  end if;
  if course_config ->> 'mode' = 'selected' then
    if jsonb_array_length(course_config -> 'ids') = 0 then
      return false;
    end if;
  elsif jsonb_array_length(course_config -> 'ids') <> 0 then
    return false;
  end if;
  for course_id in select value from jsonb_array_elements(course_config -> 'ids')
  loop
    if jsonb_typeof(course_id) is distinct from 'string'
       or (course_id #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return false;
    end if;
    normalized_id := lower(course_id #>> '{}');
    if normalized_id = any(course_ids) then
      return false;
    end if;
    course_ids := array_append(course_ids, normalized_id);
  end loop;
  return true;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

-- Replace the original four-value code restriction, retaining the unique index
-- and all existing codes. Do not remove any access/security constraints.
alter table public.subscription_plans
  drop constraint if exists subscription_plans_code_check;
alter table public.subscription_plans
  add constraint subscription_plans_code_check
    check (code ~ '^[a-z0-9][a-z0-9_-]{1,63}$');

-- NOT VALID preserves any legacy row that needs manual cleanup, while still
-- checking every new/updated row. No legacy content is rewritten or deleted.
alter table public.subscription_plans
  drop constraint if exists subscription_plans_builder_fields_check,
  drop constraint if exists subscription_plans_entitlements_check;
alter table public.subscription_plans
  add constraint subscription_plans_builder_fields_check check (
    length(btrim(title)) between 1 and 120
    and length(description) <= 2000
    and price >= 0 and price <= 99999999.99
    and reward_currency between 0 and 1000000
    and currency ~ '^[A-Z]{3}$'
    and (image_url is null or (
      length(image_url) <= 2048
      and image_url ~ '^https://[^/?#@[:space:]]+([/?#][^[:space:]]*)?$'
    ))
  ) not valid,
  add constraint subscription_plans_entitlements_check check (
    entitlements is null or public.subscription_entitlements_valid(entitlements)
  ) not valid;

create or replace function public.set_subscription_plan_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists subscription_plans_set_updated_at on public.subscription_plans;
create trigger subscription_plans_set_updated_at
before update on public.subscription_plans
for each row execute function public.set_subscription_plan_updated_at();

notify pgrst, 'reload schema';
commit;
