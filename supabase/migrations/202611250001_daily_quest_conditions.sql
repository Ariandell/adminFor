begin;

alter table public.daily_quest_templates
  drop constraint if exists daily_quest_templates_kind_check,
  drop constraint if exists daily_quest_templates_check,
  drop constraint if exists daily_quest_templates_condition,
  drop constraint if exists daily_quest_templates_course_scope;

alter table public.daily_quest_templates
  add constraint daily_quest_templates_condition check (target between 1 and case kind
    when 'lessons_completed' then 10
    when 'courses_practiced' then 3
    when 'course_finished' then 1
    when 'quiz_lessons_checked' then 10
    when 'cards_reviewed' then 100
    when 'cards_known' then 100
    when 'weak_words' then 50
    when 'weak_words_known' then 50
    when 'personal_cards_reviewed' then 100
    when 'personal_words_added' then 30
    else 0 end),
  add constraint daily_quest_templates_course_scope check (
    course_id is null or kind not in ('courses_practiced','personal_cards_reviewed','personal_words_added'));

alter table anglica_private.daily_assignments
  add column if not exists expanded_issued boolean not null default false;

-- The date of a personal word's first insert is server-owned. Existing words,
-- retries, edits and reactivating tombstones never acquire a new date.
create table if not exists anglica_private.personal_word_additions (
  user_id uuid not null,
  word_key text not null,
  added_at timestamptz not null default statement_timestamp(),
  primary key (user_id,word_key),
  foreign key (user_id,word_key) references public.user_word_cards(user_id,word_key) on delete cascade
);
alter table anglica_private.personal_word_additions enable row level security;
revoke all on anglica_private.personal_word_additions from public,anon,authenticated;
create index if not exists personal_word_additions_daily on anglica_private.personal_word_additions(user_id,added_at);

create or replace function anglica_private.capture_personal_word_addition()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not new.is_deleted then
    insert into anglica_private.personal_word_additions(user_id,word_key)
      values (new.user_id,new.word_key) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function anglica_private.capture_personal_word_addition() from public,anon,authenticated;
drop trigger if exists capture_personal_word_addition on public.user_word_cards;
create trigger capture_personal_word_addition after insert on public.user_word_cards
  for each row execute function anglica_private.capture_personal_word_addition();

-- Reproduce the reader's stable block/question keys, including older content
-- without IDs. Positions are among JSON objects, as in the Flutter reader.
create or replace function anglica_private.daily_quiz_questions(p_content jsonb)
returns table(answer_key text,question jsonb) language sql immutable set search_path='' as $$
  with blocks as (
    select b.value, (row_number() over (order by b.ordinality) - 1)::text as position
    from jsonb_array_elements(case when jsonb_typeof(p_content->'blocks')='array'
      then p_content->'blocks' else '[]'::jsonb end) with ordinality b
    where jsonb_typeof(b.value)='object'
  )
  select (case when jsonb_typeof(b.value->'id')='string' and b.value->>'id'<>''
    then b.value->>'id' else 'block-'||b.position end)||'/'||
    (case when jsonb_typeof(q.value->'id')='string' and q.value->>'id'<>''
    then q.value->>'id' else q.position end), q.value
  from blocks b
  cross join lateral (
    select x.value, (row_number() over (order by x.ordinality) - 1)::text as position
    from jsonb_array_elements(case when jsonb_typeof(b.value->'data'->'questions')='array'
      then b.value->'data'->'questions' else '[]'::jsonb end) with ordinality x
    where jsonb_typeof(x.value)='object'
  ) q
  where b.value->>'type'='quiz';
$$;
revoke all on function anglica_private.daily_quiz_questions(jsonb) from public,anon,authenticated;

-- Validate answer shape against authored options, without treating a checked
-- answer as a correct answer. Non-empty quizzes with supported questions count.
create or replace function anglica_private.daily_quiz_answered(p_question jsonb,p_answer jsonb)
returns boolean language sql immutable set search_path='' as $$
  select coalesce(case p_question->>'type'
    when 'text_input' then jsonb_typeof(p_answer)='string' and (p_answer #>> '{}') ~ '[^[:space:]]'
    when 'single_choice' then case when jsonb_typeof(p_answer)='number' then
        (p_answer #>> '{}') ~ '^[0-9]+$' and (p_answer #>> '{}')::numeric < option_count
      else false end
    when 'multiple_choice' then jsonb_array_length(selected)>0 and not exists (
      select 1 from jsonb_array_elements(selected) a(value)
      where case when jsonb_typeof(a.value)='number' and (a.value #>> '{}') ~ '^[0-9]+$'
        then (a.value #>> '{}')::numeric >= option_count else true end)
    when 'matching' then option_count>0 and jsonb_array_length(selected)=option_count and not exists (
      select 1 from jsonb_array_elements(selected) a(value)
      where case when jsonb_typeof(a.value)='number' and (a.value #>> '{}') ~ '^[0-9]+$'
        then (a.value #>> '{}')::numeric >= option_count else true end)
    when 'ordering' then option_count>0 and jsonb_array_length(selected)=option_count
      and (select count(distinct a.value) from jsonb_array_elements(selected) a(value)
        where case when jsonb_typeof(a.value)='number' and (a.value #>> '{}') ~ '^[0-9]+$'
          then (a.value #>> '{}')::numeric < option_count else false end)=option_count
    else false end,false)
  from (select
    case when jsonb_typeof(p_answer)='array' then p_answer else '[]'::jsonb end as selected,
    (select count(*) from jsonb_array_elements(case when jsonb_typeof(options)='array'
      then options else '[]'::jsonb end) item where jsonb_typeof(item)='object') as option_count
    from (select case p_question->>'type' when 'matching' then p_question->'pairs'
      when 'ordering' then p_question->'items' else p_question->'answers' end as options) shape
  ) parsed;
$$;
revoke all on function anglica_private.daily_quiz_answered(jsonb,jsonb) from public,anon,authenticated;

-- Capture the exact draft at the first confirmed completion. Restarting a
-- lesson, editing the draft later or changing the author's quiz cannot backfill it.
create table if not exists anglica_private.daily_quiz_completions (
  user_id uuid not null,
  lesson_id uuid not null,
  primary key (user_id,lesson_id),
  foreign key (user_id,lesson_id) references public.user_lesson_completions(user_id,lesson_id) on delete cascade
);
alter table anglica_private.daily_quiz_completions enable row level security;
revoke all on anglica_private.daily_quiz_completions from public,anon,authenticated;

create or replace function anglica_private.capture_daily_quiz_completion()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into anglica_private.daily_quiz_completions(user_id,lesson_id)
    select new.user_id,new.lesson_id from public.lessons l
    join public.user_lesson_drafts d on d.user_id=new.user_id and d.lesson_id=l.id
    cross join lateral anglica_private.daily_quiz_questions(l.content) q
    where l.id=new.lesson_id
      and l.is_published and l.is_unlocked
      and d.content_revision=md5(jsonb_build_object('blocks',l.content->'blocks','introduction',l.content->'introduction')::text)
      and jsonb_typeof(d.answers->'/anglica/checked-v1')='array'
    group by d.answers
    having count(*)=count(distinct q.answer_key)
      and bool_and((d.answers->'/anglica/checked-v1') ? q.answer_key
        and anglica_private.daily_quiz_answered(q.question,d.answers->q.answer_key))
    on conflict do nothing;
  return new;
end;
$$;
revoke all on function anglica_private.capture_daily_quiz_completion() from public,anon,authenticated;
drop trigger if exists capture_daily_quiz_completion on public.user_lesson_completions;
create trigger capture_daily_quiz_completion after insert on public.user_lesson_completions
  for each row execute function anglica_private.capture_daily_quiz_completion();

create or replace function anglica_private.daily_course_lessons(p_user uuid,p_course uuid)
returns table(lesson_id uuid,course_id uuid,first_completed_at timestamptz)
language sql stable set search_path='' as $$
  select l.id,l.course_id,x.first_completed_at from public.lessons l
  join public.courses c on c.id=l.course_id
  left join public.user_lesson_completions x on x.lesson_id=l.id and x.user_id=p_user
  where c.is_published and l.is_published and l.is_unlocked
    and (p_course is null or l.course_id=p_course)
    and ((c.access_tier='free' and l.access_tier='free')
      or public.learning_has_course_preview(c.id) or public.is_anglica_admin());
$$;
revoke all on function anglica_private.daily_course_lessons(uuid,uuid) from public,anon,authenticated;

create or replace function anglica_private.daily_personal_word_keys(p_user uuid)
returns table(word_key text) language sql stable set search_path='' as $$
  select w.word_key from public.user_word_cards w
  where w.user_id=p_user and not w.is_deleted;
$$;
revoke all on function anglica_private.daily_personal_word_keys(uuid) from public,anon,authenticated;

create or replace function anglica_private.daily_recent_card_answers(p_user uuid,p_starts timestamptz,p_ends timestamptz)
returns table(word_key text,known boolean,authored boolean) language sql stable set search_path='' as $$
  select a.word_key,a.kind='correct',case when a.authored=s.authored then a.authored end
  from public.user_word_practice_events a
  join public.user_word_practice_events s on s.user_id=a.user_id and s.encounter_id=a.encounter_id
    and s.word_key=a.word_key and s.kind='shown'
  where a.user_id=p_user and a.kind in ('correct','incorrect')
    and a.received_at>=p_starts and a.received_at<p_ends
    and s.received_at>=p_starts and s.received_at<=a.received_at;
$$;
revoke all on function anglica_private.daily_recent_card_answers(uuid,timestamptz,timestamptz) from public,anon,authenticated;

create or replace function anglica_private.daily_quest_progress(
  p_user uuid,p_kind text,p_course uuid,p_starts timestamptz,p_ends timestamptz
) returns integer language plpgsql stable set search_path='' as $$
declare
  total integer;
begin
  case p_kind
    when 'lessons_completed' then
      select count(*) into total from public.user_lesson_completions x join public.lessons l on l.id=x.lesson_id
      where x.user_id=p_user and x.first_completed_at>=p_starts and x.first_completed_at<p_ends
        and (p_course is null or l.course_id=p_course);
    when 'courses_practiced' then
      select count(distinct l.course_id) into total from anglica_private.daily_course_lessons(p_user,null) l
      where l.first_completed_at>=p_starts and l.first_completed_at<p_ends and public.learning_can_open(l.lesson_id);
    when 'course_finished' then
      select case when count(*)=count(l.first_completed_at)
        and max(l.first_completed_at)>=p_starts and max(l.first_completed_at)<p_ends then 1 else 0 end
      into total from anglica_private.daily_course_lessons(p_user,p_course) l where p_course is not null;
    when 'quiz_lessons_checked' then
      select count(*) into total from anglica_private.daily_quiz_completions q
      join anglica_private.daily_course_lessons(p_user,p_course) l on l.lesson_id=q.lesson_id
      where q.user_id=p_user and l.first_completed_at>=p_starts and l.first_completed_at<p_ends;
    when 'personal_words_added' then
      select count(*) into total from anglica_private.personal_word_additions a
      join public.user_word_cards w using (user_id,word_key)
      where a.user_id=p_user and a.added_at>=p_starts and a.added_at<p_ends and not w.is_deleted;
    when 'personal_cards_reviewed' then
      select count(distinct a.word_key) into total
      from anglica_private.daily_recent_card_answers(p_user,p_starts,p_ends) a
      join anglica_private.daily_personal_word_keys(p_user) k using (word_key)
      where not a.authored;
    else
      select count(distinct a.word_key) into total
      from anglica_private.daily_recent_card_answers(p_user,p_starts,p_ends) a
      join anglica_private.daily_word_keys(p_user,p_course) k using (word_key)
      where (p_kind not in ('cards_known','weak_words_known') or (a.known and a.authored))
        and (p_kind not in ('weak_words','weak_words_known') or exists (
          select 1 from public.user_word_practice_events old
          where old.user_id=p_user and old.word_key=a.word_key and old.kind='incorrect' and old.received_at<p_starts));
  end case;
  return total;
end;
$$;
revoke all on function anglica_private.daily_quest_progress(uuid,text,uuid,timestamptz,timestamptz) from public,anon,authenticated;

create or replace function anglica_private.daily_quest_capacity(
  p_user uuid,p_kind text,p_course uuid,p_starts timestamptz,p_ends timestamptz
) returns integer language plpgsql stable set search_path='' as $$
declare
  total integer;
begin
  case p_kind
    when 'lessons_completed' then
      select count(*) into total from public.lessons l join public.courses c on c.id=l.course_id
      where l.is_published and l.is_unlocked and c.is_published
        and (p_course is null or l.course_id=p_course)
        and not exists (select 1 from public.user_lesson_completions x
          where x.user_id=p_user and x.lesson_id=l.id and x.first_completed_at<p_starts)
        and exists (select 1 from public.lessons access_lesson
          where access_lesson.course_id=l.course_id and public.learning_can_open(access_lesson.id));
    when 'courses_practiced' then
      select count(distinct l.course_id) into total from anglica_private.daily_course_lessons(p_user,null) l
      where (l.first_completed_at is null or l.first_completed_at>=p_starts)
        and public.learning_can_open(l.lesson_id);
    when 'quiz_lessons_checked' then
      select count(*) into total from anglica_private.daily_course_lessons(p_user,p_course) l
      where (l.first_completed_at>=p_starts and l.first_completed_at<p_ends and exists (
        select 1 from anglica_private.daily_quiz_completions q where q.user_id=p_user and q.lesson_id=l.lesson_id))
        or (l.first_completed_at is null and public.learning_can_open(l.lesson_id) and exists (
          select 1 from public.lessons lesson
          cross join lateral anglica_private.daily_quiz_questions(lesson.content) q
          where lesson.id=l.lesson_id
          group by lesson.id having count(*)=count(distinct q.answer_key)
            and bool_and(coalesce(q.question->>'type','') in ('single_choice','multiple_choice','text_input','matching','ordering'))));
    when 'personal_words_added' then
      total:=30;
    when 'personal_cards_reviewed' then
      select count(*) into total from anglica_private.daily_personal_word_keys(p_user);
    else
      select count(*) into total from anglica_private.daily_word_keys(p_user,p_course) k
      where p_kind not in ('weak_words','weak_words_known') or exists (
        select 1 from public.user_word_practice_events old
        where old.user_id=p_user and old.word_key=k.word_key and old.kind='incorrect' and old.received_at<p_starts);
  end case;
  return total;
end;
$$;
revoke all on function anglica_private.daily_quest_capacity(uuid,text,uuid,timestamptz,timestamptz) from public,anon,authenticated;

create or replace function anglica_private.daily_today(p_expanded boolean)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  learner uuid := (select auth.uid());
  today date := (now() at time zone 'Europe/Kyiv')::date;
  day_start timestamptz := today::timestamp at time zone 'Europe/Kyiv';
  day_end timestamptz := (today+1)::timestamp at time zone 'Europe/Kyiv';
  legacy_kinds text[] := array['lessons_completed','cards_reviewed','weak_words'];
  starts timestamptz; ends timestamptz; q record; total integer; next_slot integer; scope uuid;
  issued_expanded boolean;
  assigned_kinds text[];
begin
  if learner is null or not exists(select 1 from auth.users where id=learner and email_confirmed_at is not null)
    then raise exception 'authentication_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('daily/'||learner::text||'/'||today::text,0));
  select coalesce(max(slot),0),coalesce(bool_or(expanded_issued),false),coalesce(array_agg(kind),'{}'::text[])
    into next_slot,issued_expanded,assigned_kinds
    from anglica_private.daily_assignments where user_id=learner and quest_day=today;
  -- Keep issued slots across clients. The first expanded fetch may fill space
  -- left by the legacy client, but never replaces an already issued quest.
  if next_slot<3 and (next_slot=0 or (p_expanded and not issued_expanded)) then
    for q in select * from public.daily_quest_templates where is_active
      and (p_expanded or kind=any(legacy_kinds)) and (not p_expanded or not kind=any(assigned_kinds))
      order by case when p_expanded then row_number() over (partition by kind
        order by md5(learner::text||today::text||id::text)) else 1 end,
        md5(learner::text||today::text||id::text) limit 200 loop
      if p_expanded and q.kind=any(assigned_kinds) then continue; end if;
      scope:=q.course_id;
      if q.kind='course_finished' then
        -- The last lesson must be possible today. Pin the chosen course in the
        -- assignment even when the template allows any eligible course.
        select l.course_id into scope from anglica_private.daily_course_lessons(learner,scope) l
        group by l.course_id
        having (count(*) filter (where l.first_completed_at is null)=1
          and bool_or(l.first_completed_at is null and public.learning_can_open(l.lesson_id)))
          or (count(*)=count(l.first_completed_at)
            and max(l.first_completed_at)>=day_start and max(l.first_completed_at)<day_end)
        order by md5(today::text||l.course_id::text) limit 1;
        if scope is null then continue; end if;
      elsif anglica_private.daily_quest_capacity(learner,q.kind,scope,day_start,day_end)<q.target then
        continue;
      end if;
      next_slot:=next_slot+1;
      insert into anglica_private.daily_assignments(user_id,quest_day,slot,template_id,title,description,kind,target,reward_points,course_id)
        values(learner,today,next_slot,q.id,q.title,q.description,q.kind,q.target,q.reward_points,scope);
      assigned_kinds:=array_append(assigned_kinds,q.kind);
      exit when next_slot=3;
    end loop;
  end if;
  if p_expanded and not issued_expanded and next_slot>0 then
    update anglica_private.daily_assignments set expanded_issued=true where user_id=learner and quest_day=today;
  end if;

  for q in select * from anglica_private.daily_assignments where user_id=learner
    and quest_day between today-7 and today and awarded_at is null
    and (p_expanded or kind=any(legacy_kinds)) loop
    starts:=q.quest_day::timestamp at time zone 'Europe/Kyiv';
    ends:=(q.quest_day+1)::timestamp at time zone 'Europe/Kyiv';
    total:=anglica_private.daily_quest_progress(learner,q.kind,q.course_id,starts,ends);
    update anglica_private.daily_assignments set progress=greatest(progress,least(q.target,total)),
      awarded_at=case when total>=q.target then least(now(),ends-interval '1 microsecond') end
      where user_id=learner and quest_day=q.quest_day and slot=q.slot;
  end loop;

  return jsonb_build_object('day',today,'resetsAt',day_end,'serverNow',now(),
    'quests',coalesce((select jsonb_agg(jsonb_build_object('id',template_id,'title',title,'description',description,
      'kind',kind,'target',target,'reward',reward_points,'courseId',course_id,'progress',progress,'completed',awarded_at is not null,
      'wordKeys',case when a.kind in ('weak_words','weak_words_known') then coalesce((select jsonb_agg(k.word_key) from (
        select wk.word_key from anglica_private.daily_word_keys(learner,a.course_id) wk
        where exists(select 1 from public.user_word_practice_events old where old.user_id=learner
          and old.word_key=wk.word_key and old.kind='incorrect' and old.received_at<day_start)
        order by md5(today::text||wk.word_key) limit 100
      ) k),'[]'::jsonb) else '[]'::jsonb end) ||
      case when p_expanded then jsonb_build_object('destination',case
        when a.kind in ('lessons_completed','courses_practiced','course_finished','quiz_lessons_checked') then 'lessons'
        when a.kind in ('personal_cards_reviewed','personal_words_added') then 'personal_words'
        else 'words' end) else '{}'::jsonb end order by slot)
      from anglica_private.daily_assignments a where user_id=learner and quest_day=today
        and (p_expanded or kind=any(legacy_kinds))),'[]'::jsonb));
end;
$$;
revoke all on function anglica_private.daily_today(boolean) from public,anon,authenticated;

create or replace function public.daily_today()
returns jsonb language sql volatile security definer set search_path='' as $$
  select anglica_private.daily_today(false);
$$;
revoke all on function public.daily_today() from public,anon;
grant execute on function public.daily_today() to authenticated;

create or replace function public.daily_today_v2()
returns jsonb language sql volatile security definer set search_path='' as $$
  select anglica_private.daily_today(true);
$$;
revoke all on function public.daily_today_v2() from public,anon;
grant execute on function public.daily_today_v2() to authenticated;

commit;
