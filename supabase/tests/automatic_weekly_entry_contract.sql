begin;
insert into auth.users(id,email_confirmed_at) values
 ('ee000000-0000-0000-0000-000000000001',now()),('ee000000-0000-0000-0000-000000000002',now()),('ee000000-0000-0000-0000-000000000003',now());
insert into public.user_profile_details(user_id,avatar,avatar_photo,avatar_photo_revision)
 values('ee000000-0000-0000-0000-000000000001','iris','iVBORw0KGgoAAAANSUhEUgAAAQAAAAEA','ee100000-0000-0000-0000-000000000001');
update anglica_private.community_cards set alias='ExistingNick',bio='My bio',published=false where user_id='ee000000-0000-0000-0000-000000000001';
update anglica_private.community_cards set published=false where user_id in('ee000000-0000-0000-0000-000000000002','ee000000-0000-0000-0000-000000000003');
insert into public.daily_quest_templates(id,title,kind,target,reward_points,is_active)
 select ('ee300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'Auto entry daily '||n,'personal_words_added',1,20,true from generate_series(1,3) n;
insert into anglica_private.daily_assignments(user_id,quest_day,slot,template_id,title,description,kind,target,reward_points,progress)
 select 'ee000000-0000-0000-0000-000000000001',(now() at time zone 'Europe/Kyiv')::date,n,
 ('ee300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'Auto entry daily','','personal_words_added',1,
 case n when 1 then 40 when 2 then 20 else 10 end,0 from generate_series(1,3) n;
update anglica_private.daily_assignments set progress=target,awarded_at=now() where user_id='ee000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','ee000000-0000-0000-0000-000000000001',true);
do $$ declare page jsonb; begin
 page:=public.community_leaderboard();
 if page->>'participation'<>'active' or (page->'me'->>'score')::int<>70 then raise exception 'Completed green dailies did not auto-enter rating: %',page; end if;
 if not exists(select 1 from anglica_private.community_cards where user_id=auth.uid() and published and alias='ExistingNick' and bio='My bio' and photo is not null) then raise exception 'Existing card lost name/photo/bio during entry'; end if;
 perform anglica_private.auto_enter_weekly_ranking(auth.uid());
 perform anglica_private.auto_enter_weekly_ranking(auth.uid());
 if (select sum(reward_points) from anglica_private.daily_assignments where user_id=auth.uid())<>70 then raise exception 'Recovery minted or changed XP'; end if;
end $$;
set local role authenticated;
select public.community_save_card_v3('ExistingNick','My bio','iris','line',false,false,true,'iris','lagoon','{}'::uuid[],'{}'::uuid[],'badges');
do $$ begin
 if public.community_leaderboard()->>'participation'<>'active' then raise exception 'Legacy manual switch hid a qualified learner'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','ee000000-0000-0000-0000-000000000002',true);
do $$ begin
 if public.community_leaderboard()->>'participation'<>'daily_required' then raise exception 'An unfinished learner is told to enable a manual switch'; end if;
end $$;
insert into anglica_private.daily_assignments(user_id,quest_day,slot,template_id,title,description,kind,target,reward_points,progress,awarded_at)
 values('ee000000-0000-0000-0000-000000000002',(now() at time zone 'Europe/Kyiv')::date,1,'ee300000-0000-0000-0000-000000000001','Zero XP daily','','personal_words_added',1,0,1,now()),
 ('ee000000-0000-0000-0000-000000000003',date_trunc('week',now() at time zone 'Europe/Kyiv')::date-1,1,'ee300000-0000-0000-0000-000000000001','Old daily','','personal_words_added',1,20,1,
 (date_trunc('week',now() at time zone 'Europe/Kyiv') at time zone 'Europe/Kyiv')-interval '1 microsecond');
do $$ begin
 if public.community_leaderboard()->>'participation'<>'active' then raise exception 'Zero-XP first daily did not enter automatically'; end if;
 if exists(select 1 from anglica_private.community_ranking() where user_id='ee000000-0000-0000-0000-000000000003') then raise exception 'Last week daily entered new weekly rating'; end if;
 if has_function_privilege('authenticated','anglica_private.auto_enter_weekly_ranking(uuid)','EXECUTE') then raise exception 'Client can force server qualification'; end if;
end $$;
rollback;
