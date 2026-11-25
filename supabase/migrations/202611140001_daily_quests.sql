-- Daily templates are admin-authored; assignments and rewards are server-owned.
begin;
create table if not exists public.daily_quest_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(trim(title)) between 1 and 80),
  description text not null default '' check(length(description)<=240),
  kind text not null check(kind in ('lessons_completed','cards_reviewed','weak_words')),
  target integer not null check(target between 1 and 100),
  reward_points integer not null default 20 check(reward_points between 0 and 60),
  course_id uuid references public.courses(id) on delete restrict,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  check((kind<>'lessons_completed' or target<=10) and (kind<>'weak_words' or target<=50))
);
alter table public.daily_quest_templates enable row level security;
revoke all on public.daily_quest_templates from public,anon,authenticated;
grant select,insert,update on public.daily_quest_templates to authenticated;
drop policy if exists daily_admin on public.daily_quest_templates;
create policy daily_admin on public.daily_quest_templates to authenticated
  using((select public.is_anglica_admin())) with check((select public.is_anglica_admin()));

create table if not exists anglica_private.daily_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_day date not null,
  slot integer not null check(slot between 1 and 3),
  template_id uuid not null references public.daily_quest_templates(id) on delete restrict,
  title text not null, description text not null, kind text not null,
  target integer not null, reward_points integer not null,
  course_id uuid,
  progress integer not null default 0,
  awarded_at timestamptz,
  primary key(user_id,quest_day,slot),
  unique(user_id,quest_day,template_id)
);
alter table anglica_private.daily_assignments enable row level security;
revoke all on anglica_private.daily_assignments from public,anon,authenticated;
create index if not exists daily_reward_dates on anglica_private.daily_assignments(user_id,awarded_at) where awarded_at is not null;
create index if not exists word_practice_daily_lookup on public.user_word_practice_events(user_id,received_at);

-- Device clocks may describe practice history, but never choose reward dates.
create or replace function anglica_private.stamp_practice_receipt()
returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('authenticated','anon') then new.received_at:=statement_timestamp(); end if;
  return new;
end;
$$;
revoke all on function anglica_private.stamp_practice_receipt() from public,anon,authenticated;
drop trigger if exists stamp_practice_receipt on public.user_word_practice_events;
create trigger stamp_practice_receipt before insert on public.user_word_practice_events
  for each row execute function anglica_private.stamp_practice_receipt();

-- Only words actually available through a completed lesson are used for quests.
-- Self-rated answers count practice, never objective pronunciation/correctness.
create or replace function anglica_private.daily_word_keys(p_user uuid,p_course uuid)
returns table(word_key text) language sql stable security definer set search_path='' as $$
  select distinct lower(regexp_replace(trim(replace(regexp_replace(
    coalesce(nullif(trim(c.infinitive),''),c.original_word), '\s*\([^()]*\)\s*$', ''),'’',chr(39))), '\s+', ' ', 'g'))
  from public.cards c join public.lessons l on l.id=c.lesson_id
  join public.user_lesson_completions x on x.lesson_id=l.id and x.user_id=p_user
  where (p_course is null or l.course_id=p_course) and public.learning_can_open(l.id);
$$;
revoke all on function anglica_private.daily_word_keys(uuid,uuid) from public,anon,authenticated;

create or replace function public.daily_today()
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  learner uuid := (select auth.uid());
  today date := (now() at time zone 'Europe/Kyiv')::date;
  starts timestamptz; ends timestamptz; q record; total integer; next_slot integer;
begin
  if learner is null or not exists(select 1 from auth.users where id=learner and email_confirmed_at is not null)
    then raise exception 'authentication_required' using errcode='42501'; end if;
  starts:=today::timestamp at time zone 'Europe/Kyiv';
  ends:=(today+1)::timestamp at time zone 'Europe/Kyiv';
  perform pg_advisory_xact_lock(hashtextextended('daily/'||learner::text||'/'||today::text,0));
  -- The first fetch fixes the day's choices. No reroll by switching devices.
  if not exists(select 1 from anglica_private.daily_assignments where user_id=learner and quest_day=today) then
    next_slot:=0;
    for q in select * from public.daily_quest_templates where is_active
      order by md5(learner::text||today::text||id::text) limit 200 loop
      if q.kind='lessons_completed' then
        select count(*) into total from public.lessons l join public.courses c on c.id=l.course_id
        where l.is_published and l.is_unlocked and c.is_published
          and (q.course_id is null or l.course_id=q.course_id)
          and not exists(select 1 from public.user_lesson_completions x where x.user_id=learner and x.lesson_id=l.id and x.first_completed_at<starts)
          and exists(select 1 from public.lessons access_lesson where access_lesson.course_id=l.course_id and public.learning_can_open(access_lesson.id));
      else
        select count(*) into total from anglica_private.daily_word_keys(learner,q.course_id) k
          where q.kind<>'weak_words' or exists(select 1 from public.user_word_practice_events e
            where e.user_id=learner and e.word_key=k.word_key and e.kind='incorrect' and e.received_at<starts);
      end if;
      if total<q.target then continue; end if;
      next_slot:=next_slot+1;
      insert into anglica_private.daily_assignments(user_id,quest_day,slot,template_id,title,description,kind,target,reward_points,course_id)
        values(learner,today,next_slot,q.id,q.title,q.description,q.kind,q.target,q.reward_points,q.course_id);
      exit when next_slot=3;
    end loop;
  end if;
  -- Recover earned rewards even if the learner leaves the result screen open
  -- across midnight. Receipt timestamps still determine the original day/week.
  for q in select * from anglica_private.daily_assignments where user_id=learner
    and quest_day between today-7 and today and awarded_at is null loop
    starts:=q.quest_day::timestamp at time zone 'Europe/Kyiv';
    ends:=(q.quest_day+1)::timestamp at time zone 'Europe/Kyiv';
    if q.kind='lessons_completed' then
      select count(*) into total from public.user_lesson_completions x join public.lessons l on l.id=x.lesson_id
        where x.user_id=learner and x.first_completed_at>=starts and x.first_completed_at<ends
          and (q.course_id is null or l.course_id=q.course_id);
    else
      select count(distinct e.word_key) into total from public.user_word_practice_events e
        join anglica_private.daily_word_keys(learner,q.course_id) k on k.word_key=e.word_key
        where e.user_id=learner and e.kind in ('correct','incorrect') and e.received_at>=starts and e.received_at<ends
          and exists(select 1 from public.user_word_practice_events s where s.user_id=learner
            and s.encounter_id=e.encounter_id and s.word_key=e.word_key and s.kind='shown'
            and s.received_at>=starts and s.received_at<=e.received_at)
          and (q.kind<>'weak_words' or exists(select 1 from public.user_word_practice_events old
            where old.user_id=learner and old.word_key=e.word_key and old.kind='incorrect' and old.received_at<starts));
    end if;
    update anglica_private.daily_assignments set progress=greatest(progress,least(q.target,total)),
      awarded_at=case when total>=q.target then least(now(),ends-interval '1 microsecond') end
      where user_id=learner and quest_day=q.quest_day and slot=q.slot;
  end loop;
  ends:=(today+1)::timestamp at time zone 'Europe/Kyiv';
  return jsonb_build_object('day',today,'resetsAt',ends,'serverNow',now(),
    'quests',coalesce((select jsonb_agg(jsonb_build_object('id',template_id,'title',title,'description',description,
      'kind',kind,'target',target,'reward',reward_points,'courseId',course_id,'progress',progress,'completed',awarded_at is not null,
      'wordKeys',case when a.kind='weak_words' then coalesce((select jsonb_agg(k.word_key) from (
        select wk.word_key from anglica_private.daily_word_keys(learner,a.course_id) wk
        where exists(select 1 from public.user_word_practice_events old where old.user_id=learner
          and old.word_key=wk.word_key and old.kind='incorrect'
          and old.received_at<today::timestamp at time zone 'Europe/Kyiv')
        order by md5(today::text||wk.word_key) limit 100
      ) k),'[]'::jsonb) else '[]'::jsonb end) order by slot)
      from anglica_private.daily_assignments a where user_id=learner and quest_day=today),'[]'::jsonb));
end;
$$;
revoke all on function public.daily_today() from public,anon;
grant execute on function public.daily_today() to authenticated;

-- Add daily rewards to the same source used by both ranking and mini profiles.
create or replace function anglica_private.community_ranking()
returns table(user_id uuid,card jsonb,score bigint,lessons bigint,place bigint,ordinal bigint)
language sql stable security definer set search_path='' as $$
  with boundary as (select date_trunc('week',now() at time zone 'Europe/Kyiv') at time zone 'Europe/Kyiv' as starts,
    (date_trunc('week',now() at time zone 'Europe/Kyiv')+interval '7 days') at time zone 'Europe/Kyiv' as ends),
  totals as (
    select c.user_id,anglica_private.community_card_json(c) as card,c.public_id,c.alias,c.show_lessons,
      (select count(*)*10 from public.user_lesson_completions x,boundary b where x.user_id=c.user_id and x.first_completed_at>=b.starts and x.first_completed_at<b.ends)
      +coalesce((select sum(a.reward_points) from anglica_private.daily_assignments a,boundary b where a.user_id=c.user_id and a.awarded_at>=b.starts and a.awarded_at<b.ends),0) as score,
      case when c.show_lessons then (select count(*) from public.user_lesson_completions x where x.user_id=c.user_id) end as lessons
    from anglica_private.community_cards c join auth.users u on u.id=c.user_id where c.published and u.email_confirmed_at is not null)
  select user_id,card,score,lessons,case when score>0 then dense_rank() over(order by score desc) end,
    row_number() over(order by score desc,lower(alias),public_id) from totals;
$$;
commit;
