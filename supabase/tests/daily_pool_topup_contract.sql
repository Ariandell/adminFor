begin;
update public.daily_quest_templates set is_active=false where is_active;
insert into auth.users(id,email_confirmed_at) values('e8000000-0000-0000-0000-000000000001',now());
insert into public.daily_quest_templates(title,kind,target,reward_points,is_active)
values('First','personal_words_added',1,10,true);
select set_config('request.jwt.claim.sub','e8000000-0000-0000-0000-000000000001',true);
select public.daily_today_v3();
insert into public.daily_quest_templates(title,kind,target,reward_points,is_active)
values('Second','personal_words_added',2,10,true),('Third','personal_words_added',3,10,true);
do $$ declare result jsonb; begin
  result:=public.daily_today_v3();
  if jsonb_array_length(result->'quests')<>3 then raise exception 'Daily pool was not filled to three: %',result; end if;
  if (select count(distinct q->>'id') from jsonb_array_elements(result->'quests') q)<>3 then raise exception 'Duplicate daily templates'; end if;
  if not exists(select 1 from jsonb_array_elements(result->'quests') q where q->>'title'='First') then raise exception 'Existing assignment replaced'; end if;
  if result->'quests' is distinct from public.daily_today_v3()->'quests' then raise exception 'Daily rerolled on refresh'; end if;
end $$;
rollback;
