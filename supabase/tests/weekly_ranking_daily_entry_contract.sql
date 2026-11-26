begin;
insert into auth.users(id,email_confirmed_at)
 select ('ed000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,case when n=8 then null else now() end from generate_series(1,11) n;
insert into anglica_private.community_cards(user_id,alias,published) values('ed000000-0000-0000-0000-000000000008','Unconfirmed',true);
update anglica_private.community_cards set published=false where user_id='ed000000-0000-0000-0000-000000000007';
insert into public.courses(id,title) values('ed100000-0000-0000-0000-000000000001','Entry test');
insert into public.lessons(id,course_id,title) values('ed200000-0000-0000-0000-000000000001','ed100000-0000-0000-0000-000000000001','Entry lesson');
insert into public.user_lesson_completions(user_id,lesson_id,first_completed_at)
 values('ed000000-0000-0000-0000-000000000001','ed200000-0000-0000-0000-000000000001',now());
insert into public.daily_quest_templates(id,title,kind,target,reward_points,is_active)
 values('ed300000-0000-0000-0000-000000000001','Entry daily','personal_words_added',1,10,true);
with boundary as(select date_trunc('week',now() at time zone 'Europe/Kyiv') as starts)
insert into anglica_private.daily_assignments(user_id,quest_day,slot,template_id,title,description,kind,target,reward_points,progress,awarded_at)
 select ('ed000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
   case when n in(2,11) then starts::date-1 when n in(9,10) then starts::date else (now() at time zone 'Europe/Kyiv')::date end,
   1,'ed300000-0000-0000-0000-000000000001','Entry daily','','personal_words_added',1,
   case when n=6 then 0 else 10 end,case when n=5 then 0 else 1 end,
   case when n=2 then (starts at time zone 'Europe/Kyiv')-interval '1 microsecond'
     when n=4 then null
     when n in(9,11) then starts at time zone 'Europe/Kyiv'
     when n=10 then (starts+interval '7 days') at time zone 'Europe/Kyiv'
     else now() end
 from generate_series(2,11) n cross join boundary;
select set_config('request.jwt.claim.sub','ed000000-0000-0000-0000-000000000001',true);
do $$ declare page jsonb; detail jsonb; begin
 page:=public.community_leaderboard();
 if (page->>'total')::int<>3 or page->>'participation'<>'daily_required' or page->'me'<>'null'::jsonb then raise exception 'Wrong weekly entry filter: %',page; end if;
 if exists(select 1 from anglica_private.community_ranking() where user_id not in
   ('ed000000-0000-0000-0000-000000000003','ed000000-0000-0000-0000-000000000006','ed000000-0000-0000-0000-000000000009')) then raise exception 'Inactive/partial/previous-week/hidden learner admitted'; end if;
 if (select count(*) from anglica_private.community_ranking() where place=1)<>2 then raise exception 'Tie positions changed'; end if;
 detail:=public.community_public_card((select public_id from anglica_private.community_cards where user_id=auth.uid()));
 if (detail->>'score')::int<>10 or detail->'place'<>'null'::jsonb then raise exception 'Public profile or pending lesson score lost'; end if;
end $$;
-- First completion enters immediately and preserves this week's lesson points.
insert into anglica_private.daily_assignments(user_id,quest_day,slot,template_id,title,description,kind,target,reward_points,progress,awarded_at)
 values('ed000000-0000-0000-0000-000000000001',(now() at time zone 'Europe/Kyiv')::date,1,
 'ed300000-0000-0000-0000-000000000001','Entry daily','','personal_words_added',1,10,1,now());
do $$ declare page jsonb; begin
 page:=public.community_leaderboard();
 if page->>'participation'<>'active' or (page->'me'->>'score')::int<>20 or (page->'me'->>'place')::int<>1 then raise exception 'First daily did not qualify learner: %',page; end if;
end $$;
-- Removing a completion invalidates the client version, including zero-XP tasks.
select set_config('request.jwt.claim.sub','ed000000-0000-0000-0000-000000000006',true);
do $$ declare before_version jsonb; begin
 before_version:=public.community_ranking_version();
 delete from anglica_private.daily_assignments where user_id=auth.uid();
 if public.community_ranking_version()=before_version then raise exception 'Zero-XP eligibility change did not refresh ranking'; end if;
 if public.community_leaderboard()->>'participation'<>'daily_required' then raise exception 'Removed daily still qualified'; end if;
end $$;
-- All previous-week completions cease to qualify, even while lesson XP exists.
update anglica_private.daily_assignments set
 awarded_at=(date_trunc('week',now() at time zone 'Europe/Kyiv') at time zone 'Europe/Kyiv')-interval '1 microsecond',
 quest_day=date_trunc('week',now() at time zone 'Europe/Kyiv')::date-1
 where user_id in('ed000000-0000-0000-0000-000000000001','ed000000-0000-0000-0000-000000000003','ed000000-0000-0000-0000-000000000009');
do $$ begin
 if exists(select 1 from anglica_private.community_ranking()) then raise exception 'Weekly qualification persisted after week end'; end if;
end $$;
select set_config('request.jwt.claim.sub','ed000000-0000-0000-0000-000000000007',true);
do $$ begin
 if public.community_leaderboard()->>'participation'<>'hidden' then raise exception 'Disabled participation confused with missing daily'; end if;
end $$;
rollback;
