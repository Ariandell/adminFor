-- Settle issued dailies when accepted learning data arrives. A leaderboard
-- version check reads compact generations instead of learning histories.
begin;

create sequence if not exists anglica_private.community_ranking_generation;
revoke all on sequence anglica_private.community_ranking_generation from public,anon,authenticated;
create table if not exists anglica_private.community_ranking_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null default nextval('anglica_private.community_ranking_generation') check(version>0)
);
alter table anglica_private.community_ranking_state enable row level security;
revoke all on anglica_private.community_ranking_state from public,anon,authenticated;
insert into anglica_private.community_ranking_state(user_id)
  select user_id from anglica_private.community_cards where published on conflict do nothing;

create index if not exists daily_pending_lookup
  on anglica_private.daily_assignments(user_id,quest_day,kind) where awarded_at is null;

create or replace function anglica_private.bump_community_ranking(p_user uuid)
returns void language sql volatile security definer set search_path='' as $$
  insert into anglica_private.community_ranking_state(user_id) values(p_user)
    on conflict(user_id) do update set version=nextval('anglica_private.community_ranking_generation');
$$;
revoke all on function anglica_private.bump_community_ranking(uuid) from public,anon,authenticated;

create or replace function public.community_ranking_version()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  return jsonb_build_object('version',
    (select coalesce(sum(version),0)::text||'/'||count(*)::text from anglica_private.community_ranking_state),
    'weekStart',date_trunc('week',now() at time zone 'Europe/Kyiv') at time zone 'Europe/Kyiv');
end;
$$;
revoke all on function public.community_ranking_version() from public,anon;
grant execute on function public.community_ranking_version() to authenticated;

create or replace function anglica_private.daily_settle_user(p_user uuid,p_kinds text[] default null)
returns void language plpgsql volatile security definer set search_path='' as $$
declare
  today date:=(now() at time zone 'Europe/Kyiv')::date;
  previous_sub text:=current_setting('request.jwt.claim.sub',true);
  day date; q record; total integer; starts timestamptz; ends timestamptz;
begin
  if p_user is null or not exists(select 1 from auth.users
    where id=p_user and email_confirmed_at is not null) then return; end if;
  -- Access checks inside the established progress functions use the owner of
  -- these receipts, including server callbacks which have no learner JWT.
  perform set_config('request.jwt.claim.sub',p_user::text,true);
  for day in select distinct quest_day from anglica_private.daily_assignments
    where user_id=p_user and awarded_at is null and quest_day between today-7 and today
      and (p_kinds is null or kind=any(p_kinds)) order by quest_day desc loop
    perform pg_advisory_xact_lock(hashtextextended('daily/'||p_user::text||'/'||day::text,0));
    starts:=day::timestamp at time zone 'Europe/Kyiv';
    ends:=(day+1)::timestamp at time zone 'Europe/Kyiv';
    for q in select * from anglica_private.daily_assignments where user_id=p_user
      and quest_day=day and awarded_at is null and (p_kinds is null or kind=any(p_kinds)) order by slot loop
      total:=anglica_private.daily_quest_progress(p_user,q.kind,q.course_id,starts,ends);
      update anglica_private.daily_assignments
        set progress=greatest(q.progress,least(q.target,total)),
          awarded_at=case when total>=q.target then least(now(),ends-interval '1 microsecond') end
        where user_id=p_user and quest_day=day and slot=q.slot and awarded_at is null
          and (total>q.progress or total>=q.target);
    end loop;
  end loop;
  perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
exception when others then
  perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
  raise;
end;
$$;
revoke all on function anglica_private.daily_settle_user(uuid,text[]) from public,anon,authenticated;

-- Transition tables deduplicate a multi-row write to one settlement per owner.
create or replace function anglica_private.settle_daily_progress_statement()
returns trigger language plpgsql security definer set search_path='' as $$
declare learner uuid; kinds text[]:=string_to_array(TG_ARGV[0],',');
begin
  for learner in select distinct user_id from daily_new_rows order by user_id loop
    if TG_TABLE_SCHEMA='anglica_private' and TG_TABLE_NAME in
      ('daily_active_time','daily_question_attempts','daily_audio_progress') and
      current_setting('anglica.daily_defer_user',true)=learner::text then continue; end if;
    perform anglica_private.daily_settle_user(learner,kinds);
  end loop;
  return null;
end;
$$;
revoke all on function anglica_private.settle_daily_progress_statement() from public,anon,authenticated;

drop trigger if exists settle_daily_words on public.user_word_practice_events;
create trigger settle_daily_words after insert on public.user_word_practice_events
  referencing new table as daily_new_rows for each statement execute function
  anglica_private.settle_daily_progress_statement('cards_reviewed,cards_known,weak_words,weak_words_known,personal_cards_reviewed');
drop trigger if exists settle_daily_lessons on public.user_lesson_completions;
create trigger settle_daily_lessons after insert on public.user_lesson_completions
  referencing new table as daily_new_rows for each statement execute function
  anglica_private.settle_daily_progress_statement('lessons_completed,courses_practiced,course_finished,quiz_lessons_checked,cards_reviewed,cards_known,weak_words,weak_words_known');
drop trigger if exists settle_daily_personal_add on anglica_private.personal_word_additions;
create trigger settle_daily_personal_add after insert on anglica_private.personal_word_additions
  referencing new table as daily_new_rows for each statement execute function
  anglica_private.settle_daily_progress_statement('personal_words_added');
drop trigger if exists settle_daily_quiz_capture on anglica_private.daily_quiz_completions;
create trigger settle_daily_quiz_capture after insert on anglica_private.daily_quiz_completions
  referencing new table as daily_new_rows for each statement execute function
  anglica_private.settle_daily_progress_statement('quiz_lessons_checked');
drop trigger if exists settle_daily_questions on anglica_private.daily_question_attempts;
create trigger settle_daily_questions after insert on anglica_private.daily_question_attempts
  referencing new table as daily_new_rows for each statement execute function
  anglica_private.settle_daily_progress_statement('quiz_questions_answered,perfect_quizzes,correct_answers_streak');
drop trigger if exists settle_daily_active_insert on anglica_private.daily_active_time;
create trigger settle_daily_active_insert after insert on anglica_private.daily_active_time
  referencing new table as daily_new_rows for each statement execute function
  anglica_private.settle_daily_progress_statement('active_minutes');
drop trigger if exists settle_daily_active_update on anglica_private.daily_active_time;
create trigger settle_daily_active_update after update on anglica_private.daily_active_time
  referencing new table as daily_new_rows for each statement execute function
  anglica_private.settle_daily_progress_statement('active_minutes');
drop trigger if exists settle_daily_audio_insert on anglica_private.daily_audio_progress;
create trigger settle_daily_audio_insert after insert on anglica_private.daily_audio_progress
  referencing new table as daily_new_rows for each statement execute function
  anglica_private.settle_daily_progress_statement('audio_listened');
drop trigger if exists settle_daily_audio_update on anglica_private.daily_audio_progress;
create trigger settle_daily_audio_update after update on anglica_private.daily_audio_progress
  referencing new table as daily_new_rows for each statement execute function
  anglica_private.settle_daily_progress_statement('audio_listened');
drop trigger if exists settle_daily_ai on anglica_private.daily_ai_successes;
create trigger settle_daily_ai after insert on anglica_private.daily_ai_successes
  referencing new table as daily_new_rows for each statement execute function
  anglica_private.settle_daily_progress_statement('ai_tasks_completed');

-- One activity upload can contain many questions. Defer its internal trigger
-- work and settle the accepted batch once before returning to the client.
do $version$ begin
  if to_regprocedure('anglica_private.daily_activity_sync_v1_core(jsonb)') is null then
    alter function public.daily_activity_sync(jsonb) set schema anglica_private;
    alter function anglica_private.daily_activity_sync(jsonb) rename to daily_activity_sync_v1_core;
  end if;
end $version$;
revoke all on function anglica_private.daily_activity_sync_v1_core(jsonb) from public,anon,authenticated;
create or replace function public.daily_activity_sync(p_events jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  learner uuid:=(select auth.uid());
  previous_defer text:=current_setting('anglica.daily_defer_user',true);
  result jsonb;
begin
  perform set_config('anglica.daily_defer_user',coalesce(learner::text,''),true);
  result:=anglica_private.daily_activity_sync_v1_core(p_events);
  perform set_config('anglica.daily_defer_user',coalesce(previous_defer,''),true);
  perform anglica_private.daily_settle_user(learner,array[
    'active_minutes','quiz_questions_answered','perfect_quizzes','correct_answers_streak','audio_listened']);
  return result;
exception when others then
  perform set_config('anglica.daily_defer_user',coalesce(previous_defer,''),true);
  raise;
end;
$$;
revoke all on function public.daily_activity_sync(jsonb) from public,anon;
grant execute on function public.daily_activity_sync(jsonb) to authenticated;

create or replace function anglica_private.ranking_card_changed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if TG_OP='INSERT' then
    if new.published then perform anglica_private.bump_community_ranking(new.user_id); end if;
  elsif TG_OP='DELETE' then
    if old.published then perform anglica_private.bump_community_ranking(old.user_id); end if;
  elsif (old.published or new.published) and
    (to_jsonb(new)-'updated_at') is distinct from (to_jsonb(old)-'updated_at') then
    perform anglica_private.bump_community_ranking(new.user_id);
  end if;
  return null;
end;
$$;
revoke all on function anglica_private.ranking_card_changed() from public,anon,authenticated;
drop trigger if exists ranking_card_changed on anglica_private.community_cards;
create trigger ranking_card_changed after insert or update or delete on anglica_private.community_cards
  for each row execute function anglica_private.ranking_card_changed();

create or replace function anglica_private.ranking_lesson_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare learner uuid;
begin
  if TG_OP='DELETE' then
    for learner in select distinct x.user_id from ranking_old_rows x
      join anglica_private.community_cards c using(user_id) where c.published order by x.user_id loop
      perform anglica_private.bump_community_ranking(learner);
    end loop;
  else
    for learner in select distinct x.user_id from ranking_new_rows x
      join anglica_private.community_cards c using(user_id) where c.published order by x.user_id loop
      perform anglica_private.bump_community_ranking(learner);
    end loop;
  end if;
  return null;
end;
$$;
revoke all on function anglica_private.ranking_lesson_changed() from public,anon,authenticated;
drop trigger if exists ranking_lesson_insert on public.user_lesson_completions;
create trigger ranking_lesson_insert after insert on public.user_lesson_completions
  referencing new table as ranking_new_rows for each statement execute function anglica_private.ranking_lesson_changed();
drop trigger if exists ranking_lesson_update on public.user_lesson_completions;
create trigger ranking_lesson_update after update on public.user_lesson_completions
  referencing new table as ranking_new_rows for each statement execute function anglica_private.ranking_lesson_changed();
drop trigger if exists ranking_lesson_delete on public.user_lesson_completions;
create trigger ranking_lesson_delete after delete on public.user_lesson_completions
  referencing old table as ranking_old_rows for each statement execute function anglica_private.ranking_lesson_changed();

create or replace function anglica_private.ranking_award_changed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.awarded_at is not null and new.reward_points>0 and
    (old.awarded_at is null or old.awarded_at is distinct from new.awarded_at or old.reward_points is distinct from new.reward_points) and
    exists(select 1 from anglica_private.community_cards c where c.user_id=new.user_id and c.published) then
    perform anglica_private.bump_community_ranking(new.user_id);
  end if;
  return null;
end;
$$;
revoke all on function anglica_private.ranking_award_changed() from public,anon,authenticated;
drop trigger if exists ranking_award_changed on anglica_private.daily_assignments;
create trigger ranking_award_changed after update on anglica_private.daily_assignments
  for each row execute function anglica_private.ranking_award_changed();

-- Read each participant's history once for a ranking refresh.
create or replace function anglica_private.community_ranking()
returns table(user_id uuid,card jsonb,score bigint,lessons bigint,place bigint,ordinal bigint)
language sql stable security definer set search_path='' as $$
  with boundary as (
    select date_trunc('week',now() at time zone 'Europe/Kyiv') at time zone 'Europe/Kyiv' as starts,
      (date_trunc('week',now() at time zone 'Europe/Kyiv')+interval '7 days') at time zone 'Europe/Kyiv' as ends
  ), published as materialized (
    select c.* from anglica_private.community_cards c join auth.users u on u.id=c.user_id
    where c.published and u.email_confirmed_at is not null
  ), completion_totals as (
    select x.user_id,count(*) as lessons,
      count(*) filter(where x.first_completed_at>=b.starts and x.first_completed_at<b.ends)*10 as points
    from public.user_lesson_completions x join published c using(user_id) cross join boundary b group by x.user_id
  ), reward_totals as (
    select a.user_id,sum(a.reward_points) as points from anglica_private.daily_assignments a
    join published c using(user_id) cross join boundary b
    where a.awarded_at>=b.starts and a.awarded_at<b.ends group by a.user_id
  ), totals as (
    select c.user_id,anglica_private.community_card_json(c::anglica_private.community_cards) as card,c.public_id,c.alias,
      coalesce(x.points,0)+coalesce(a.points,0) as score,
      case when c.show_lessons then coalesce(x.lessons,0) end as lessons
    from published c left join completion_totals x using(user_id) left join reward_totals a using(user_id)
  )
  select user_id,card,score,lessons,case when score>0 then dense_rank() over(order by score desc) end,
    row_number() over(order by score desc,lower(alias),public_id) from totals;
$$;
revoke all on function anglica_private.community_ranking() from public,anon,authenticated;

-- Recover already earned pending rewards from the same seven-day window used
-- by the existing daily endpoint, without issuing any new tasks.
do $recover$ declare learner uuid; begin
  for learner in select distinct user_id from anglica_private.daily_assignments
    where awarded_at is null and quest_day between (now() at time zone 'Europe/Kyiv')::date-7
      and (now() at time zone 'Europe/Kyiv')::date order by user_id loop
    perform anglica_private.daily_settle_user(learner);
  end loop;
end $recover$;

commit;
