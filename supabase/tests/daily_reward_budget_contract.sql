begin;
update public.daily_quest_templates set is_active=false;
update anglica_private.daily_reward_policies set starts_on=(now() at time zone 'Europe/Kyiv')::date
 where id='equal_daily_budget_v1';
insert into auth.users(id,email_confirmed_at)
 select ('ea000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,now() from generate_series(1,22) n;
insert into public.daily_quest_templates(id,title,kind,target,reward_points,is_active)
 select ('ea100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'Random '||n,'personal_words_added',n,n*7,true from generate_series(1,6) n;
do $$ declare learner uuid; data jsonb; begin
 for learner in select id from auth.users where id::text like 'ea000000-%' and id::text<'ea000000-0000-0000-0000-000000000021' loop
  perform set_config('request.jwt.claim.sub',learner::text,true);
  data:=public.daily_today_v3();
  if jsonb_array_length(data->'quests')<>3 or (select sum((q->>'reward')::integer) from jsonb_array_elements(data->'quests') q)<>60 then raise exception 'Unequal daily budget: %',data; end if;
  if data->'quests' is distinct from public.daily_today_v3()->'quests' then raise exception 'Daily rerolled or reward drifted'; end if;
 end loop;
 if (select count(distinct choice) from (select string_agg(template_id::text,',' order by template_id) choice from anglica_private.daily_assignments where user_id::text like 'ea000000-%' group by user_id) choices)<2 then raise exception 'Every learner received the same random set'; end if;
end $$;
-- Exact apportionment, including the integer remainder.
update public.daily_quest_templates set is_active=false;
insert into public.daily_quest_templates(title,kind,target,reward_points,is_active)
 values('Heavy','personal_words_added',1,40,true),('Medium','personal_words_added',2,10,true),('Light','personal_words_added',3,5,true);
select set_config('request.jwt.claim.sub','ea000000-0000-0000-0000-000000000021',true);
select public.daily_today_v3();
do $$ begin
 if (select reward_points from anglica_private.daily_assignments where user_id=auth.uid() and title='Heavy')<>44
 or (select reward_points from anglica_private.daily_assignments where user_id=auth.uid() and title='Medium')<>11
 or (select reward_points from anglica_private.daily_assignments where user_id=auth.uid() and title='Light')<>5 then raise exception 'Wrong weighted XP apportionment'; end if;
end $$;
-- A scarce pool reserves two slots, then tops up without taking back earned XP.
update public.daily_quest_templates set is_active=false;
insert into public.daily_quest_templates(title,kind,target,reward_points,is_active)
 values('First reserved','personal_words_added',1,5,true);
select set_config('request.jwt.claim.sub','ea000000-0000-0000-0000-000000000022',true);
select public.daily_today_v3();
update anglica_private.daily_assignments set progress=target,awarded_at=now() where user_id=auth.uid();
insert into public.daily_quest_templates(title,kind,target,reward_points,is_active)
 values('Added later A','personal_words_added',2,40,true),('Added later B','personal_words_added',3,5,true);
select public.daily_today_v3();
do $$ begin
 if (select count(*) from anglica_private.daily_assignments where user_id=auth.uid())<>3
 or (select sum(reward_points) from anglica_private.daily_assignments where user_id=auth.uid())<>60
 or not exists(select 1 from anglica_private.daily_assignments where user_id=auth.uid() and title='First reserved' and reward_points=20 and awarded_at is not null) then raise exception 'Top-up altered an earned reward or exceeded fund'; end if;
 if has_table_privilege('authenticated','anglica_private.daily_reward_policies','UPDATE') then raise exception 'Client can change daily fund'; end if;
end $$;
-- Existing issued sets are never repriced when a policy starts.
update anglica_private.daily_assignments set reward_points=3 where user_id='ea000000-0000-0000-0000-000000000021';
select set_config('request.jwt.claim.sub','ea000000-0000-0000-0000-000000000021',true);
select public.daily_today_v3();
do $$ begin
 if (select sum(reward_points) from anglica_private.daily_assignments where user_id=auth.uid())<>9 then raise exception 'Existing rewards were repriced'; end if;
end $$;
rollback;
