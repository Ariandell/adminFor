begin;
update public.daily_quest_templates set is_active=false where is_active;
insert into auth.users(id,email_confirmed_at) values('e7000000-0000-0000-0000-000000000001',now());
insert into public.courses(id,title,level,is_published,access_tier)
  values('e7100000-0000-0000-0000-000000000001','Daily activity contract','A1',true,'free');
insert into public.lessons(id,course_id,title,order_index,is_published,is_unlocked,access_tier,content)
  select 'e7200000-0000-0000-0000-000000000001','e7100000-0000-0000-0000-000000000001','Activity lesson',0,true,true,'free',
  jsonb_build_object('blocks',jsonb_build_array(
    jsonb_build_object('id','quiz','type','quiz','data',jsonb_build_object('questions',(
      select jsonb_agg(jsonb_build_object('id','q'||i,'type','single_choice','answers',jsonb_build_array(
        jsonb_build_object('text','yes'),jsonb_build_object('text','no')),'correctAnswerIndex',0)) from generate_series(1,20)i))),
    jsonb_build_object('id','short-quiz','type','quiz','data',jsonb_build_object('questions',jsonb_build_array(
      jsonb_build_object('id','text','type','text_input','correctAnswers',jsonb_build_array(jsonb_build_object('value','It’s raining'))),
      jsonb_build_object('id','multi','type','multiple_choice','answers',jsonb_build_array(jsonb_build_object('text','a'),jsonb_build_object('text','b'),jsonb_build_object('text','c')),'correctAnswers','[0,2]'::jsonb),
      jsonb_build_object('id','order','type','ordering','items','[{"text":"second","order":2},{"text":"first","order":1}]'::jsonb),
      jsonb_build_object('id','match','type','matching','pairs','[{"left":"one","right":"один"},{"left":"two","right":"два"}]'::jsonb)))),
    '{"id":"sound","type":"audio","data":{"url":"https://example.com/sound.mp3","durationMs":10000}}'::jsonb,
    '{"id":"writing","type":"aiBlock","data":{"question":"Describe your day","evaluationPrompt":"Check English"}}'::jsonb));
select set_config('test.daily_revision',(select md5(jsonb_build_object('blocks',content->'blocks','introduction',content->'introduction')::text)
  from public.lessons where id='e7200000-0000-0000-0000-000000000001'),true);
insert into public.daily_quest_templates(title,kind,target,reward_points,is_active) values
  ('Active','active_minutes',1,10,true),('Questions','quiz_questions_answered',20,10,true),
  ('Perfect','perfect_quizzes',1,15,true);

select set_config('request.jwt.claim.sub','e7000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ declare result jsonb; begin
  result:=public.daily_today_v3();
  if jsonb_array_length(result->'quests')<>3 then raise exception 'v3 assignments missing: %',result; end if;
  if public.daily_today_v2()->'quests'<>'[]'::jsonb or public.daily_today()->'quests'<>'[]'::jsonb then
    raise exception 'Old API leaked new kinds'; end if;
  result:=public.daily_activity_sync('[{"id":"e7300000-0000-0000-0000-000000000001","kind":"active","activeMs":30000}]');
  if jsonb_array_length(result->'accepted')<>1 then raise exception 'active anchor rejected: %',result; end if;
  result:=public.daily_activity_sync('[{"id":"e7300000-0000-0000-0000-000000000099","kind":"ai","lessonId":"e7200000-0000-0000-0000-000000000001","blockId":"writing"}]');
  if jsonb_array_length(result->'rejected')<>1 then raise exception 'Client forged AI completion'; end if;
  begin
    perform public.record_daily_ai_success('e7000000-0000-0000-0000-000000000001','e7200000-0000-0000-0000-000000000001','writing','test');
    raise exception 'Learner can invoke AI success';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- A new clock receives zero credit. Two tabs share the same bounded interval.
do $$ begin if (select active_ms from anglica_private.daily_active_time where user_id='e7000000-0000-0000-0000-000000000001')<>0 then
  raise exception 'First heartbeat invented activity'; end if; end $$;
update anglica_private.daily_activity_clock set active_at=statement_timestamp()-interval '15 seconds';
set local role authenticated;
select public.daily_activity_sync('[{"id":"e7300000-0000-0000-0000-000000000002","kind":"active","activeMs":30000},{"id":"e7300000-0000-0000-0000-000000000003","kind":"active","activeMs":30000}]');
select public.daily_activity_sync('[{"id":"e7300000-0000-0000-0000-000000000002","kind":"active","activeMs":30000}]');
reset role;
do $$ declare total bigint; begin
  select active_ms into total from anglica_private.daily_active_time where user_id='e7000000-0000-0000-0000-000000000001';
  if total not between 15000 and 15999 then raise exception 'Duplicate tabs/retry multiplied time: %',total; end if;
end $$;

-- Old paused sessions cannot claim the gap as foreground time.
update anglica_private.daily_activity_clock set active_at=statement_timestamp()-interval '5 minutes';
set local role authenticated;
select public.daily_activity_sync('[{"id":"e7300000-0000-0000-0000-000000000004","kind":"active","activeMs":30000}]');
reset role;

-- Submit twenty distinct authored questions, with q2 wrong. The retry cannot
-- erase that error or convert the test into a perfect first attempt.
set local role authenticated;
do $$ declare payload jsonb; revision text; result jsonb; begin
  revision:=current_setting('test.daily_revision');
  select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'kind','quiz_answer','lessonId','e7200000-0000-0000-0000-000000000001',
    'blockId','quiz','questionKey','quiz/q'||i,'contentRevision',revision,'answer',case when i=2 then 1 else 0 end) order by i) into payload from generate_series(1,20)i;
  result:=public.daily_activity_sync(payload);
  if jsonb_array_length(result->'accepted')<>20 or jsonb_array_length(result->'rejected')<>0 then raise exception 'Quiz batch rejected: %',result; end if;
  result:=public.daily_activity_sync(jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'kind','quiz_answer','lessonId','e7200000-0000-0000-0000-000000000001',
    'blockId','quiz','questionKey','quiz/q2','contentRevision',revision,'answer',0)));
  result:=public.daily_activity_sync(jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'kind','quiz_answer','lessonId','e7200000-0000-0000-0000-000000000001',
    'blockId','quiz','questionKey','quiz/q1','contentRevision','stale','answer',0)));
  if jsonb_array_length(result->'rejected')<>1 then raise exception 'Stale authored revision accepted'; end if;
  select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'kind','quiz_answer','lessonId','e7200000-0000-0000-0000-000000000001',
    'blockId','short-quiz','questionKey','short-quiz/'||key,'contentRevision',revision,'answer',answer)) into payload
    from (values('text',to_jsonb('it''s   raining'::text)),('multi','[2,0]'::jsonb),('order','[1,0]'::jsonb),('match','[0,1]'::jsonb)) answers(key,answer);
  result:=public.daily_activity_sync(payload);
  if jsonb_array_length(result->'accepted')<>4 then raise exception 'Typed quiz answers rejected: %',result; end if;
end $$;
reset role;

set local role authenticated;
select public.daily_activity_sync('[{"id":"e7400000-0000-0000-0000-000000000001","kind":"audio","lessonId":"e7200000-0000-0000-0000-000000000001","blockId":"sound","playedMs":10000,"durationMs":10000}]');
reset role;
do $$ begin if exists(select 1 from anglica_private.daily_audio_progress where completed_at is not null) then raise exception 'Instant audio completion'; end if; end $$;
update anglica_private.daily_activity_clock set audio_at=statement_timestamp()-interval '10 seconds';
update anglica_private.daily_audio_progress set last_received_at=statement_timestamp()-interval '10 seconds';
set local role authenticated;
select public.daily_activity_sync('[{"id":"e7400000-0000-0000-0000-000000000002","kind":"audio","lessonId":"e7200000-0000-0000-0000-000000000001","blockId":"sound","playedMs":10000,"durationMs":1000}]');
reset role;

-- Trusted AI completion is called only after a successful provider result.
set local role service_role;
select public.record_daily_ai_success('e7000000-0000-0000-0000-000000000001','e7200000-0000-0000-0000-000000000001','writing','request-1');
select public.record_daily_ai_success('e7000000-0000-0000-0000-000000000001','e7200000-0000-0000-0000-000000000001','writing','request-2');
reset role;

do $$ declare
  learner uuid:='e7000000-0000-0000-0000-000000000001'; starts timestamptz;
  fixture record; actual integer;
begin
  starts:=((statement_timestamp() at time zone 'Europe/Kyiv')::date)::timestamp at time zone 'Europe/Kyiv';
  for fixture in select * from (values('quiz_questions_answered',24),('perfect_quizzes',1),('audio_listened',1),
    ('ai_tasks_completed',1),('correct_answers_streak',22)) expected(kind,value) loop
    actual:=anglica_private.daily_quest_progress(learner,fixture.kind,null,starts,starts+interval '1 day');
    if actual is distinct from fixture.value then raise exception 'Wrong % progress: expected %, got %',fixture.kind,fixture.value,actual; end if;
  end loop;
  if (select active_ms from anglica_private.daily_active_time where user_id=learner) not between 15000 and 15999 then raise exception 'Paused gap counted'; end if;
  if exists(select 1 from anglica_private.daily_audio_progress where duration_ms<>10000) then raise exception 'Client shrank authored audio duration'; end if;
end $$;
set local role authenticated;
select public.daily_today_v3();
select public.daily_today_v3();
reset role;
do $$ begin
  if (select sum(reward_points) from anglica_private.daily_assignments where user_id='e7000000-0000-0000-0000-000000000001' and awarded_at is not null)<>25 then
    raise exception 'Quest reward duplication or missing completion'; end if;
end $$;
rollback;
