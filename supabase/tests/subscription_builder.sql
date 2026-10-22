-- Optional verification after 202610220001_subscription_builder.sql.
-- Uses temporary data only and always rolls back; no real plan is created.
begin;

do $$
declare
  base jsonb := '{"version":1,"features":{},"courses":{"mode":"none","ids":[]}}';
  invalid jsonb;
  limited jsonb := '{"enabled":true,"limit":50,"period":"day"}';
  course_id text := 'a1111111-1111-4111-8111-111111111111';
begin
  if public.subscription_entitlements_valid(base) is distinct from true then
    raise exception 'Empty permissions must be a valid, closed configuration';
  end if;
  if public.subscription_entitlements_valid(jsonb_set(base, '{features,translation}', limited)) is distinct from true
     or public.subscription_entitlements_valid(jsonb_set(base, '{features,translation}', '{"enabled":true,"limit":null,"period":null}')) is distinct from true
     or public.subscription_entitlements_valid(jsonb_set(base, '{features,personal_cards}', '{"enabled":true,"limit":100,"period":"total"}')) is distinct from true
     or public.subscription_entitlements_valid(jsonb_set(base, '{features,course_dictionary}', '{"enabled":true,"limit":null,"period":null}')) is distinct from true
     or public.subscription_entitlements_valid(jsonb_set(base, '{courses}', jsonb_build_object('mode', 'selected', 'ids', jsonb_build_array(course_id)))) is distinct from true then
    raise exception 'Valid limited/unlimited/course configurations were rejected';
  end if;

  foreach invalid in array array[
    'null'::jsonb,
    '[]'::jsonb,
    base - 'courses',
    base || '{"extra":true}'::jsonb,
    jsonb_set(base, '{version}', '2'),
    jsonb_set(base, '{features}', '[]'),
    jsonb_set(base, '{features,unknown}', limited),
    jsonb_set(base, '{features,translation}', limited - 'enabled'),
    jsonb_set(base, '{features,translation}', limited || '{"enabled":"true"}'::jsonb),
    jsonb_set(base, '{features,translation}', limited || '{"extra":1}'::jsonb),
    jsonb_set(base, '{features,translation}', limited || '{"enabled":false}'::jsonb),
    jsonb_set(base, '{features,translation}', limited || '{"limit":null}'::jsonb),
    jsonb_set(base, '{features,translation}', limited || '{"limit":"50"}'::jsonb),
    jsonb_set(base, '{features,translation}', limited || '{"limit":0}'::jsonb),
    jsonb_set(base, '{features,translation}', limited || '{"limit":-1}'::jsonb),
    jsonb_set(base, '{features,translation}', limited || '{"limit":0.5}'::jsonb),
    jsonb_set(base, '{features,translation}', limited || '{"limit":1000001}'::jsonb),
    jsonb_set(base, '{features,translation}', limited || '{"period":"month"}'::jsonb),
    jsonb_set(base, '{features,personal_cards}', limited),
    jsonb_set(base, '{features,course_dictionary}', limited),
    jsonb_set(base, '{courses}', '{"mode":"selected","ids":[]}'),
    jsonb_set(base, '{courses}', '{"mode":"none","ids":null}'),
    jsonb_set(base, '{courses}', '{"mode":"other","ids":[]}'),
    jsonb_set(base, '{courses}', '{"mode":"selected","ids":["not-a-uuid"]}'),
    jsonb_set(base, '{courses}', '{"mode":"selected","ids":[1]}'),
    jsonb_set(base, '{courses}', jsonb_build_object('mode', 'all', 'ids', jsonb_build_array(course_id))),
    jsonb_set(base, '{courses}', jsonb_build_object('mode', 'selected', 'ids', jsonb_build_array(course_id, upper(course_id))))
  ] loop
    if public.subscription_entitlements_valid(invalid) is distinct from false then
      raise exception 'Invalid subscription permissions accepted: %', invalid;
    end if;
  end loop;
end;
$$;

create temporary table subscription_builder_check
  (like public.subscription_plans including defaults including constraints)
  on commit drop;

alter table subscription_builder_check enable row level security;

-- Legacy plan remains explicitly unconfigured, arbitrary valid slugs work.
insert into subscription_builder_check (code, title, tier, billing_period, price)
values ('basic_monthly', 'Legacy', 'basic', 'month', 300),
       ('custom_300', 'Custom', 'basic', 'month', 300);

do $$
declare
  bad_price numeric;
  bad_reward integer;
begin
  if exists (select 1 from subscription_builder_check where entitlements is not null) then
    raise exception 'Legacy plans must not gain inferred entitlements';
  end if;
  foreach bad_price in array array[-1::numeric, 'NaN'::numeric] loop
    begin
      insert into subscription_builder_check (code, title, tier, billing_period, price)
      values ('invalid_price', 'Invalid', 'basic', 'month', bad_price);
      raise exception 'Invalid price accepted';
    exception when check_violation then null;
    end;
  end loop;
  insert into subscription_builder_check (code, title, tier, billing_period, price, reward_currency)
  values ('valid_reward', 'Valid bonus', 'basic', 'month', 300, 1000000);
  foreach bad_reward in array array[-1, 1000001] loop
    begin
      insert into subscription_builder_check (code, title, tier, billing_period, price, reward_currency)
      values ('invalid_reward', 'Invalid bonus', 'basic', 'month', 300, bad_reward);
      raise exception 'Invalid reward currency accepted';
    exception when check_violation then null;
    end;
  end loop;
  begin
    insert into subscription_builder_check (code, title, tier, billing_period, price, image_url)
    values ('invalid_image', 'Invalid', 'basic', 'month', 300, 'https://user:secret@example.com/image.png');
    raise exception 'Credential-bearing image URL accepted';
  exception when check_violation then null;
  end;
end;
$$;

select 'Subscription builder validation passed; temporary rows will be rolled back.' as result;
rollback;
