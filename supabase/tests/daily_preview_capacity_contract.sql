begin;
update public.daily_quest_templates set is_active=false;
insert into auth.users(id,email_confirmed_at) values
 ('e9000000-0000-0000-0000-000000000001',now()),('e9000000-0000-0000-0000-000000000002',now());
insert into public.courses(id,title,is_published,access_tier)
 values('e9100000-0000-0000-0000-000000000001','Preview course',false,'premium');
insert into public.lessons(id,course_id,title,is_published,is_unlocked,access_tier)
 values('e9200000-0000-0000-0000-000000000001','e9100000-0000-0000-0000-000000000001','Draft preview lesson',false,false,'premium');
-- Offline fixture models an existing preview grant. Rolled back with the fixture.
create or replace function public.learning_has_course_preview(uuid) returns boolean language sql stable as $$
 select auth.uid()='e9000000-0000-0000-0000-000000000001'::uuid and $1='e9100000-0000-0000-0000-000000000001'::uuid $$;
create or replace function public.learning_can_open(p_id uuid) returns boolean language sql stable as $$
 select exists(select 1 from public.lessons where id=p_id and (is_published or public.learning_has_course_preview(course_id))) $$;
insert into public.daily_quest_templates(title,kind,target,reward_points,is_active)
values('Preview lesson','lessons_completed',1,40,true),('Active time','active_minutes',10,10,true),('Own words','personal_words_added',1,10,true),('Inactive','personal_words_added',1,10,false);
select set_config('request.jwt.claim.sub','e9000000-0000-0000-0000-000000000001',true);
do $$ declare data jsonb; begin
 if (select count(*) from anglica_private.daily_course_lessons(auth.uid(),null))<>1 then raise exception 'Existing preview excluded from daily lesson pool'; end if;
 data:=public.daily_today_v3();
 if jsonb_array_length(data->'quests')<>3 or not exists(select 1 from jsonb_array_elements(data->'quests') q where q->>'title'='Preview lesson') then raise exception 'Preview daily not assigned: %',data; end if;
 if exists(select 1 from jsonb_array_elements(data->'quests') q where q->>'title'='Inactive') then raise exception 'Inactive daily issued'; end if;
end $$;
select set_config('request.jwt.claim.sub','e9000000-0000-0000-0000-000000000002',true);
do $$ begin
 if exists(select 1 from anglica_private.daily_course_lessons(auth.uid(),null)) then raise exception 'Preview exposed to another user'; end if;
 if exists(select 1 from jsonb_array_elements(public.daily_today_v3()->'quests') q where q->>'title'='Preview lesson') then raise exception 'Inaccessible daily issued'; end if;
end $$;
rollback;
