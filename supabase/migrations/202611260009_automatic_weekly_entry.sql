begin;
create or replace function anglica_private.weekly_daily_complete(learner uuid)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from anglica_private.daily_assignments a join auth.users u on u.id=a.user_id
    where a.user_id=learner and u.email_confirmed_at is not null and a.target>0 and a.progress>=a.target
      and a.awarded_at>=(date_trunc('week',now() at time zone 'Europe/Kyiv') at time zone 'Europe/Kyiv')
      and a.awarded_at<((date_trunc('week',now() at time zone 'Europe/Kyiv')+interval '7 days') at time zone 'Europe/Kyiv')
      and a.quest_day>=date_trunc('week',now() at time zone 'Europe/Kyiv')::date
      and a.quest_day<(date_trunc('week',now() at time zone 'Europe/Kyiv')+interval '7 days')::date);
$$;
revoke all on function anglica_private.weekly_daily_complete(uuid) from public,anon,authenticated;

create or replace function anglica_private.auto_enter_weekly_ranking(learner uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not anglica_private.weekly_daily_complete(learner) then return; end if;
  insert into anglica_private.community_cards(user_id,alias,published,show_lessons,follows_profile)
    values(learner,'Мандрівник '||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),true,false,true)
    on conflict(user_id) do update set published=true where not community_cards.published;
  perform anglica_private.sync_game_identity(learner);
end;
$$;
revoke all on function anglica_private.auto_enter_weekly_ranking(uuid) from public,anon,authenticated;

-- Legacy clients may still submit the old manual participation switch. Once a
-- learner qualifies, that obsolete field must never hide their earned score.
create or replace function anglica_private.ensure_weekly_ranking_visibility()
returns trigger language plpgsql set search_path='' as $$
begin
  if not new.published and anglica_private.weekly_daily_complete(new.user_id) then new.published:=true; end if;
  return new;
end;
$$;
revoke all on function anglica_private.ensure_weekly_ranking_visibility() from public,anon,authenticated;
drop trigger if exists ensure_weekly_ranking_visibility on anglica_private.community_cards;
create trigger ensure_weekly_ranking_visibility before insert or update on anglica_private.community_cards
  for each row execute function anglica_private.ensure_weekly_ranking_visibility();

create or replace function anglica_private.ranking_award_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare learner uuid; changed boolean:=false;
begin
  if tg_op='INSERT' then
    learner:=new.user_id;
    changed:=new.awarded_at is not null and new.target>0 and new.progress>=new.target;
  elsif tg_op='DELETE' then
    learner:=old.user_id;
    changed:=old.awarded_at is not null and old.target>0 and old.progress>=old.target;
  else
    learner:=new.user_id;
    changed:=(new.awarded_at is not null or old.awarded_at is not null) and
      (new.awarded_at,new.progress,new.target,new.reward_points) is distinct from
      (old.awarded_at,old.progress,old.target,old.reward_points);
  end if;
  if changed and exists(select 1 from auth.users where id=learner) then
    perform anglica_private.auto_enter_weekly_ranking(learner);
    if exists(select 1 from anglica_private.community_cards where user_id=learner and published) then
      perform anglica_private.bump_community_ranking(learner);
    end if;
  end if;
  return null;
end;
$$;
revoke all on function anglica_private.ranking_award_changed() from public,anon,authenticated;

create or replace function public.community_leaderboard(p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare learner uuid := (select auth.uid()); starts timestamptz; result jsonb;
begin
  if learner is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'invalid_page' using errcode='22023'; end if;
  starts := date_trunc('week',now() at time zone 'Europe/Kyiv') at time zone 'Europe/Kyiv';
  with ranked as materialized (select * from anglica_private.community_ranking()),
  rows as (select card||jsonb_build_object('score',score,'lessons',lessons,'place',place,'isMe',user_id=learner) as entry,ordinal
    from ranked order by ordinal offset p_offset limit 30)
  select jsonb_build_object('weekStart',starts,'weekEnd',
      (date_trunc('week',now() at time zone 'Europe/Kyiv')+interval '7 days') at time zone 'Europe/Kyiv',
    'serverNow',now(),'participation',case
      when exists(select 1 from ranked where user_id=learner) then 'active'
      else 'daily_required' end,'total',(select count(*) from ranked),'offset',p_offset,
    'entries',coalesce((select jsonb_agg(entry order by ordinal) from rows),'[]'),
    'me',(select card||jsonb_build_object('score',score,'lessons',lessons,'place',place,'isMe',true) from ranked where user_id=learner)) into result;
  return result;
end;
$$;



-- Recover already completed dailies without minting or changing any XP.
do $$ declare learner uuid; begin
  for learner in select distinct user_id from anglica_private.daily_assignments
    where anglica_private.weekly_daily_complete(user_id) loop
    perform anglica_private.auto_enter_weekly_ranking(learner);
  end loop;
end $$;
commit;
