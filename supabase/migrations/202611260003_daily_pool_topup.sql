begin;
create or replace function anglica_private.daily_today_version(p_version integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  p_expanded boolean := p_version>=2;
  learner uuid := (select auth.uid());
  today date := (now() at time zone 'Europe/Kyiv')::date;
  day_start timestamptz := today::timestamp at time zone 'Europe/Kyiv';
  day_end timestamptz := (today+1)::timestamp at time zone 'Europe/Kyiv';
  legacy_kinds text[] := array['lessons_completed','cards_reviewed','weak_words'];
  allowed_kinds text[]:=case when p_version=1 then legacy_kinds else array['lessons_completed','cards_reviewed','weak_words',
    'courses_practiced','course_finished','quiz_lessons_checked','cards_known','weak_words_known','personal_cards_reviewed','personal_words_added']
    ||case when p_version>=3 then array['active_minutes','quiz_questions_answered','perfect_quizzes','audio_listened','ai_tasks_completed','correct_answers_streak']
      else '{}'::text[] end end;
  starts timestamptz; ends timestamptz; q record; total integer; next_slot integer; scope uuid;
  issued_expanded boolean;
  assigned_kinds text[];
begin
  if learner is null or not exists(select 1 from auth.users where id=learner and email_confirmed_at is not null)
    then raise exception 'authentication_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('daily/'||learner::text||'/'||today::text,0));
  select coalesce(max(slot),0),coalesce(bool_or(case when p_version>=3 then activity_issued else expanded_issued end),false),coalesce(array_agg(kind),'{}'::text[])
    into next_slot,issued_expanded,assigned_kinds
    from anglica_private.daily_assignments where user_id=learner and quest_day=today;
  -- Keep issued slots across clients. The first expanded fetch may fill space
  -- left by the legacy client, but never replaces an already issued quest.
  if next_slot<3 then
    for q in select * from public.daily_quest_templates where is_active
      and kind=any(allowed_kinds) and not exists (select 1 from anglica_private.daily_assignments assigned where assigned.user_id=learner and assigned.quest_day=today and assigned.template_id=daily_quest_templates.id)
      order by case when p_expanded then row_number() over (partition by kind
        order by md5(learner::text||today::text||id::text)) else 1 end,
        md5(learner::text||today::text||id::text) limit 200 loop
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
    update anglica_private.daily_assignments set expanded_issued=true,activity_issued=activity_issued or p_version>=3 where user_id=learner and quest_day=today;
  end if;

  for q in select * from anglica_private.daily_assignments where user_id=learner
    and quest_day between today-7 and today and awarded_at is null
    and kind=any(allowed_kinds) loop
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
        when a.kind='active_minutes' then 'home'
        when a.kind in ('lessons_completed','courses_practiced','course_finished','quiz_lessons_checked',
          'quiz_questions_answered','perfect_quizzes','audio_listened','ai_tasks_completed','correct_answers_streak') then 'lessons'
        when a.kind in ('personal_cards_reviewed','personal_words_added') then 'personal_words'
        else 'words' end) else '{}'::jsonb end order by slot)
      from anglica_private.daily_assignments a where user_id=learner and quest_day=today
        and kind=any(allowed_kinds)),'[]'::jsonb));
end;
$$;
revoke all on function anglica_private.daily_today_version(integer) from public,anon,authenticated;


commit;
