begin;
-- Rank only learners with a server-awarded completed daily in this Kyiv week.
create or replace function anglica_private.community_ranking()
returns table(user_id uuid,card jsonb,score bigint,lessons bigint,place bigint,ordinal bigint)
language sql stable security definer set search_path='' as $$
  with boundary as (
    select date_trunc('week',now() at time zone 'Europe/Kyiv') at time zone 'Europe/Kyiv' as starts,
      (date_trunc('week',now() at time zone 'Europe/Kyiv')+interval '7 days') at time zone 'Europe/Kyiv' as ends
  ), published as materialized (
    select c.* from anglica_private.community_cards c join auth.users u on u.id=c.user_id
    where c.published and u.email_confirmed_at is not null and exists (
      select 1 from anglica_private.daily_assignments a cross join boundary b
      where a.user_id=c.user_id and a.awarded_at>=b.starts and a.awarded_at<b.ends
        and a.quest_day>=(b.starts at time zone 'Europe/Kyiv')::date
        and a.quest_day<(b.ends at time zone 'Europe/Kyiv')::date
        and a.target>0 and a.progress>=a.target
    )
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
  select user_id,card,score,lessons,dense_rank() over(order by score desc),
    row_number() over(order by score desc,lower(alias),public_id) from totals;
$$;
revoke all on function anglica_private.community_ranking() from public,anon,authenticated;

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
      when exists(select 1 from anglica_private.community_cards where user_id=learner and published) then 'daily_required'
      else 'hidden' end,'total',(select count(*) from ranked),'offset',p_offset,
    'entries',coalesce((select jsonb_agg(entry order by ordinal) from rows),'[]'),
    'me',(select card||jsonb_build_object('score',score,'lessons',lessons,'place',place,'isMe',true) from ranked where user_id=learner)) into result;
  return result;
end;
$$;


-- Public profile visibility is independent of weekly qualification.
create or replace function public.community_public_card(p_public_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; starts timestamptz; ends timestamptz; learner uuid:=(select auth.uid());
begin
  if learner is null then raise exception 'authentication_required' using errcode='42501'; end if;
  starts:=date_trunc('week',now() at time zone 'Europe/Kyiv') at time zone 'Europe/Kyiv';
  ends:=(date_trunc('week',now() at time zone 'Europe/Kyiv')+interval '7 days') at time zone 'Europe/Kyiv';
  select anglica_private.community_card_json(c)||jsonb_build_object(
    'score',(select count(*)*10 from public.user_lesson_completions x where x.user_id=c.user_id and x.first_completed_at>=starts and x.first_completed_at<ends)
      +coalesce((select sum(a.reward_points) from anglica_private.daily_assignments a where a.user_id=c.user_id and a.awarded_at>=starts and a.awarded_at<ends),0),
    'lessons',case when c.show_lessons then (select count(*) from public.user_lesson_completions x where x.user_id=c.user_id) end,
    'place',(select r.place from anglica_private.community_ranking() r where r.user_id=c.user_id),
    'isMe',c.user_id=learner) into result
  from anglica_private.community_cards c join auth.users u on u.id=c.user_id
  where c.public_id=p_public_id and c.published and u.email_confirmed_at is not null;
  if result is null then raise exception 'card_unavailable' using errcode='42501'; end if;
  return result;
end;
$$;

-- A zero-XP daily also qualifies. Inserts, corrections and deletions must all
-- invalidate the cheap shared version, without issuing tasks on ranking reads.
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
  if changed and exists(select 1 from auth.users where id=learner) and
    exists(select 1 from anglica_private.community_cards where user_id=learner and published) then
    perform anglica_private.bump_community_ranking(learner);
  end if;
  return null;
end;
$$;
revoke all on function anglica_private.ranking_award_changed() from public,anon,authenticated;
drop trigger if exists ranking_award_changed on anglica_private.daily_assignments;
create trigger ranking_award_changed after insert or update or delete on anglica_private.daily_assignments
  for each row execute function anglica_private.ranking_award_changed();

do $$ declare learner uuid; begin
  for learner in select user_id from anglica_private.community_cards where published loop
    perform anglica_private.bump_community_ranking(learner);
  end loop;
end $$;
commit;
