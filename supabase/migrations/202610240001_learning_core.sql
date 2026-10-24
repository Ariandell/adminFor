-- Server-owned learning state. Install before restricting lesson reads.
-- No existing local completions are promoted into trusted completions.
begin;

create schema if not exists anglica_private;
revoke all on schema anglica_private from public, anon, authenticated;

create table if not exists public.anglica_admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  created_at timestamptz not null default now()
);
alter table public.anglica_admin_members enable row level security;
revoke all on public.anglica_admin_members from public, anon, authenticated;

create or replace function public.is_anglica_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.anglica_admin_members m
    where m.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_anglica_admin() from public;
grant execute on function public.is_anglica_admin() to anon, authenticated;

create table if not exists public.user_learning_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_course_id uuid references public.courses(id) on delete set null,
  state_version bigint not null default 0 check (state_version >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.user_lesson_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  content_revision text not null,
  draft_version bigint not null default 0 check (draft_version >= 0),
  anchor_id text not null default '',
  alignment double precision not null default 0,
  reading_progress double precision not null default 0,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id),
  check (length(anchor_id) <= 240),
  check (alignment between -100 and 1),
  check (reading_progress between 0 and 1),
  check (jsonb_typeof(answers) = 'object')
);
create table if not exists public.user_lesson_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  first_completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create table if not exists public.user_learning_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  learning_day date not null,
  primary key (user_id, learning_day)
);
create table if not exists public.learning_sync_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  payload_hash text not null,
  result jsonb not null,
  received_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
create index if not exists user_lesson_completions_course_lookup
  on public.user_lesson_completions (user_id, lesson_id);
create index if not exists learning_sync_operations_age
  on public.learning_sync_operations (received_at);

do $policy$ declare t text; begin
  foreach t in array array[
    'user_learning_state', 'user_lesson_drafts', 'user_lesson_completions',
    'user_learning_days', 'learning_sync_operations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists learner_read_own on public.%I', t);
    execute format(
      'create policy learner_read_own on public.%I for select to authenticated using (user_id = (select auth.uid()))', t
    );
  end loop;
end $policy$;

-- A published free lesson opens after its published predecessor is complete
-- and the server's eight-hour delay has passed. Admin preview is server-side.
create or replace function public.learning_can_open(p_lesson_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  target record;
  predecessor uuid;
  completed_at timestamptz;
  learner uuid := (select auth.uid());
begin
  if learner is null then return false; end if;
  select l.id, l.course_id, l.order_index, l.is_published,
         l.is_unlocked, l.access_tier, c.is_published as course_published,
         c.access_tier as course_tier
    into target
    from public.lessons l join public.courses c on c.id = l.course_id
    where l.id = p_lesson_id;
  if not found then return false; end if;
  if public.is_anglica_admin() then return true; end if;
  if not target.is_published or not target.is_unlocked
     or not target.course_published or target.access_tier <> 'free'
     or target.course_tier <> 'free' then
    return false;
  end if;
  if exists (select 1 from public.user_lesson_completions x
             where x.user_id = learner and x.lesson_id = p_lesson_id) then
    return true;
  end if;
  select l.id into predecessor from public.lessons l
    where l.course_id = target.course_id and l.is_published and l.is_unlocked
      and (l.order_index, l.id) < (target.order_index, target.id)
    order by l.order_index desc, l.id desc limit 1;
  if predecessor is null then return true; end if;
  select x.first_completed_at into completed_at
    from public.user_lesson_completions x
    where x.user_id = learner and x.lesson_id = predecessor;
  return completed_at is not null and completed_at + interval '8 hours' <= now();
end;
$$;
revoke all on function public.learning_can_open(uuid) from public, anon;
grant execute on function public.learning_can_open(uuid) to authenticated;

create or replace function public.learning_state_snapshot(
  p_expected_account_id uuid, p_course_id uuid, p_known_version bigint default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  learner uuid := (select auth.uid());
  version_now bigint;
  body jsonb;
  study_day date := (now() at time zone 'Europe/Kyiv')::date;
  streak integer := 0;
begin
  if learner is null or learner is distinct from p_expected_account_id then
    raise exception 'account_mismatch' using errcode = '42501';
  end if;
  select coalesce(s.state_version, 0) into version_now
    from public.user_learning_state s where s.user_id = learner;
  version_now := coalesce(version_now, 0);
  if p_known_version = version_now then
    return jsonb_build_object('stateVersion', version_now, 'serverNow', now(),
      'unchanged', true);
  end if;
  if not exists (select 1 from public.user_learning_days d
                 where d.user_id = learner and d.learning_day = study_day) then
    study_day := study_day - 1;
  end if;
  while exists (select 1 from public.user_learning_days d
                where d.user_id = learner and d.learning_day = study_day) loop
    streak := streak + 1;
    study_day := study_day - 1;
  end loop;
  select jsonb_build_object(
    'stateVersion', version_now, 'serverNow', now(), 'unchanged', false,
    'streakDays', streak,
    'activeCourseId', (select active_course_id from public.user_learning_state where user_id = learner),
    'access', coalesce((select jsonb_object_agg(l.id::text, public.learning_can_open(l.id))
      from public.lessons l join public.courses c on c.id = l.course_id
      where l.course_id = p_course_id
        and ((l.is_published and c.is_published) or public.is_anglica_admin())), '{}'::jsonb),
    'completions', coalesce((select jsonb_object_agg(x.lesson_id::text, x.first_completed_at)
      from public.user_lesson_completions x join public.lessons l on l.id = x.lesson_id
      where x.user_id = learner and l.course_id = p_course_id), '{}'::jsonb),
    'drafts', coalesce((select jsonb_object_agg(d.lesson_id::text,
      jsonb_build_object('anchorId', d.anchor_id, 'alignment', d.alignment,
      'contentRevision', d.content_revision, 'draftVersion', d.draft_version,
      'readingProgress', d.reading_progress, 'updatedAt', d.updated_at))
      from public.user_lesson_drafts d join public.lessons l on l.id = d.lesson_id
      where d.user_id = learner and l.course_id = p_course_id), '{}'::jsonb)
  ) into body;
  return body;
end;
$$;
revoke all on function public.learning_state_snapshot(uuid,uuid,bigint) from public, anon;
grant execute on function public.learning_state_snapshot(uuid,uuid,bigint) to authenticated;

create or replace function public.learning_open_lesson(
  p_expected_account_id uuid, p_lesson_id uuid
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  learner uuid := (select auth.uid());
  result jsonb;
begin
  if learner is null or learner is distinct from p_expected_account_id then
    raise exception 'account_mismatch' using errcode = '42501';
  end if;
  if not public.learning_can_open(p_lesson_id) then
    raise exception 'lesson_unavailable' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'id', l.id, 'course_id', l.course_id, 'title', l.title,
    'content', l.content,
    'content_revision', md5(jsonb_build_object(
      'blocks', l.content -> 'blocks',
      'introduction', l.content -> 'introduction')::text),
    'draft', (select to_jsonb(d) - 'user_id' from public.user_lesson_drafts d
      where d.user_id = learner and d.lesson_id = l.id),
    'firstCompletedAt', (select x.first_completed_at from public.user_lesson_completions x
      where x.user_id = learner and x.lesson_id = l.id)
  ) into result from public.lessons l where l.id = p_lesson_id;
  return result;
end;
$$;
revoke all on function public.learning_open_lesson(uuid,uuid) from public, anon;
grant execute on function public.learning_open_lesson(uuid,uuid) to authenticated;

create or replace function anglica_private.apply_learning_operation(
  p_user_id uuid, p_operation jsonb, p_kind text
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_operation_id uuid;
  v_lesson_id uuid;
  lesson_content jsonb;
  revision_now text;
  old_version bigint := 0;
  account_version bigint;
  fingerprint text;
  prior record;
  answers_value jsonb;
  answer_key text;
  answer_value jsonb;
  result jsonb;
  first_date timestamptz;
begin
  if (select auth.uid()) is distinct from p_user_id then
    raise exception 'account_mismatch' using errcode = '42501';
  end if;
  if p_kind not in ('draft', 'complete') or jsonb_typeof(p_operation) <> 'object'
     or octet_length(p_operation::text) > 65536
     or p_operation - array['operationId','lessonId','contentRevision','baseVersion',
       'anchorId','alignment','readingProgress','answers'] <> '{}'::jsonb then
    return jsonb_build_object('status', 'invalid');
  end if;
  begin
    v_operation_id := (p_operation ->> 'operationId')::uuid;
    v_lesson_id := (p_operation ->> 'lessonId')::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object('status', 'invalid');
  end;
  if v_operation_id is null or v_lesson_id is null then
    return jsonb_build_object('status', 'invalid');
  end if;
  fingerprint := md5(jsonb_build_object('kind', p_kind, 'operation', p_operation)::text);
  insert into public.user_learning_state(user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  select state_version into account_version from public.user_learning_state
    where user_id = p_user_id for update;
  select o.payload_hash, o.result into prior
    from public.learning_sync_operations o
    where o.user_id = p_user_id and o.operation_id = v_operation_id;
  if found then
    if prior.payload_hash = fingerprint then return prior.result; end if;
    return jsonb_build_object('status', 'conflict', 'reason', 'operation_reused');
  end if;
  if not public.learning_can_open(v_lesson_id) then
    return jsonb_build_object('status', 'unavailable');
  end if;
  select l.content into lesson_content from public.lessons l where l.id = v_lesson_id;
  revision_now := md5(jsonb_build_object(
    'blocks', lesson_content -> 'blocks',
    'introduction', lesson_content -> 'introduction')::text);
  if p_operation ->> 'contentRevision' is distinct from revision_now then
    return jsonb_build_object('status', 'content_changed', 'contentRevision', revision_now);
  end if;
  if jsonb_typeof(p_operation -> 'baseVersion') <> 'number'
     or jsonb_typeof(p_operation -> 'alignment') <> 'number'
     or jsonb_typeof(p_operation -> 'readingProgress') <> 'number'
     or jsonb_typeof(p_operation -> 'anchorId') <> 'string'
     or length(p_operation ->> 'anchorId') > 240
     or jsonb_typeof(p_operation -> 'answers') <> 'object'
     or octet_length((p_operation -> 'answers')::text) > 32768 then
    return jsonb_build_object('status', 'invalid');
  end if;
  begin
    if (p_operation ->> 'baseVersion')::bigint < 0
       or (p_operation ->> 'alignment')::double precision not between -100 and 1
       or (p_operation ->> 'readingProgress')::double precision not between 0 and 1 then
      return jsonb_build_object('status', 'invalid');
    end if;
  exception when invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('status', 'invalid');
  end;
  answers_value := p_operation -> 'answers';
  for answer_key, answer_value in select key, value from jsonb_each(answers_value) loop
    if length(answer_key) > 240 or octet_length(answer_value::text) > 8192
       or jsonb_typeof(answer_value) not in ('string','number','array','null') then
      return jsonb_build_object('status', 'invalid');
    end if;
  end loop;
  select d.draft_version into old_version from public.user_lesson_drafts d
    where d.user_id = p_user_id and d.lesson_id = v_lesson_id for update;
  old_version := coalesce(old_version, 0);
  if old_version <> (p_operation ->> 'baseVersion')::bigint then
    return jsonb_build_object('status', 'conflict', 'draftVersion', old_version);
  end if;
  insert into public.user_lesson_drafts(
    user_id, lesson_id, content_revision, draft_version, anchor_id,
    alignment, reading_progress, answers, updated_at
  ) values (
    p_user_id, v_lesson_id, revision_now, old_version + 1,
    p_operation ->> 'anchorId', (p_operation ->> 'alignment')::double precision,
    (p_operation ->> 'readingProgress')::double precision, answers_value, now()
  ) on conflict (user_id, lesson_id) do update set
    content_revision = excluded.content_revision,
    draft_version = excluded.draft_version,
    anchor_id = excluded.anchor_id,
    alignment = excluded.alignment,
    reading_progress = excluded.reading_progress,
    answers = excluded.answers,
    updated_at = excluded.updated_at;
  if p_kind = 'complete' then
    insert into public.user_lesson_completions(user_id, lesson_id)
      values (p_user_id, v_lesson_id) on conflict do nothing;
    select x.first_completed_at into first_date from public.user_lesson_completions x
      where x.user_id = p_user_id and x.lesson_id = v_lesson_id;
  end if;
  if p_kind = 'complete' or answers_value <> '{}'::jsonb then
    insert into public.user_learning_days(user_id, learning_day)
      values (p_user_id, (now() at time zone 'Europe/Kyiv')::date)
      on conflict do nothing;
  end if;
  update public.user_learning_state set
    state_version = state_version + 1, updated_at = now()
    where user_id = p_user_id returning state_version into account_version;
  result := jsonb_build_object(
    'status', 'applied', 'operationId', v_operation_id,
    'draftVersion', old_version + 1, 'writeVersion', account_version,
    'firstCompletedAt', first_date, 'serverNow', now()
  );
  insert into public.learning_sync_operations(user_id, operation_id, payload_hash, result)
    values (p_user_id, v_operation_id, fingerprint, result);
  return result;
end;
$$;
revoke all on function anglica_private.apply_learning_operation(uuid,jsonb,text) from public, anon, authenticated;

create or replace function public.learning_sync(
  p_expected_account_id uuid, p_operations jsonb
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  learner uuid := (select auth.uid());
  entry jsonb;
  results jsonb := '[]'::jsonb;
begin
  if learner is null or learner is distinct from p_expected_account_id then
    raise exception 'account_mismatch' using errcode = '42501';
  end if;
  if jsonb_typeof(p_operations) <> 'array'
     or jsonb_array_length(p_operations) > 20
     or octet_length(p_operations::text) > 65536 then
    raise exception 'invalid_sync_batch' using errcode = '22023';
  end if;
  for entry in select value from jsonb_array_elements(p_operations) loop
    results := results || jsonb_build_array(
      anglica_private.apply_learning_operation(learner, entry, 'draft')
    );
  end loop;
  return jsonb_build_object('operations', results, 'serverNow', now());
end;
$$;
revoke all on function public.learning_sync(uuid,jsonb) from public, anon;
grant execute on function public.learning_sync(uuid,jsonb) to authenticated;

create or replace function public.learning_finish(
  p_expected_account_id uuid, p_operation jsonb
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or (select auth.uid()) is distinct from p_expected_account_id then
    raise exception 'account_mismatch' using errcode = '42501';
  end if;
  return anglica_private.apply_learning_operation(p_expected_account_id, p_operation, 'complete');
end;
$$;
revoke all on function public.learning_finish(uuid,jsonb) from public, anon;
grant execute on function public.learning_finish(uuid,jsonb) to authenticated;

commit;
