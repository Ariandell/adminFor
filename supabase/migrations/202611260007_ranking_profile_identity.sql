begin;
alter table anglica_private.community_cards add column if not exists follows_profile boolean not null default false;

-- Only the untouched game identities from the preceding migration follow the
-- profile. Custom public names, avatars and previously disabled cards stay owned
-- by their existing settings.
update anglica_private.community_cards set follows_profile=true
  where alias ~ '^Мандрівник [A-F0-9]{6}$' and bio='' and photo is null and not show_lessons;

create or replace function anglica_private.profile_game_alias(metadata jsonb,fallback text)
returns text language sql immutable set search_path='' as $$
  with name as (select trim(regexp_replace(coalesce(nullif(trim(metadata->>'full_name'),''),metadata->>'name',''),'[[:cntrl:]]',' ','g')) value)
  select case when length(value)>=2 and position('@' in value)=0 then left(value,32) else fallback end from name;
$$;
revoke all on function anglica_private.profile_game_alias(jsonb,text) from public,anon,authenticated;

create or replace function anglica_private.sync_game_identity(learner uuid)
returns void language sql security definer set search_path='' as $$
  with desired as (
    select c.user_id,anglica_private.profile_game_alias(u.raw_user_meta_data,
      case when c.alias ~ '^Мандрівник [A-F0-9]{6}$' then c.alias
        else 'Мандрівник '||upper(substr(replace(c.public_id::text,'-',''),1,6)) end) as alias,
      coalesce(p.avatar,c.avatar) as avatar,p.avatar_photo as photo,p.avatar_photo_revision as photo_revision
    from anglica_private.community_cards c join auth.users u on u.id=c.user_id
    left join public.user_profile_details p on p.user_id=u.id
    where c.user_id=learner and u.email_confirmed_at is not null and c.follows_profile
  )
  update anglica_private.community_cards c set alias=d.alias,avatar=d.avatar,photo=d.photo,photo_revision=d.photo_revision
  from desired d where c.user_id=d.user_id and (c.alias,c.avatar,c.photo,c.photo_revision)
    is distinct from (d.alias,d.avatar,d.photo,d.photo_revision);
$$;
revoke all on function anglica_private.sync_game_identity(uuid) from public,anon,authenticated;

do $$ declare learner uuid; begin
  for learner in select user_id from anglica_private.community_cards where follows_profile loop
    perform anglica_private.sync_game_identity(learner);
  end loop;
end $$;

create or replace function anglica_private.provision_game_card()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.email_confirmed_at is not null then
    insert into anglica_private.community_cards(user_id,alias,avatar,frame,published,show_lessons,follows_profile)
      values(new.id,'Мандрівник '||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
        (array['iris','mint','violet','sunrise'])[1+floor(random()*4)::integer],'line',true,false,true)
      on conflict(user_id) do nothing;
    perform anglica_private.sync_game_identity(new.id);
  end if;
  return new;
end;
$$;
revoke all on function anglica_private.provision_game_card() from public,anon,authenticated;

create or replace function anglica_private.profile_identity_changed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_schema='auth' then perform anglica_private.sync_game_identity(new.id);
  else perform anglica_private.sync_game_identity(new.user_id); end if;
  return new;
end;
$$;
revoke all on function anglica_private.profile_identity_changed() from public,anon,authenticated;
drop trigger if exists sync_game_profile_name on auth.users;
create trigger sync_game_profile_name after update of raw_user_meta_data on auth.users
  for each row execute function anglica_private.profile_identity_changed();
drop trigger if exists sync_game_profile_avatar on public.user_profile_details;
create trigger sync_game_profile_avatar after insert or update of avatar,avatar_photo,avatar_photo_revision on public.user_profile_details
  for each row execute function anglica_private.profile_identity_changed();

create or replace function anglica_private.game_identity_customized()
returns trigger language plpgsql set search_path='' as $$
begin
  -- Profile triggers are nested. An ordinary card edit is a top-level update.
  if pg_trigger_depth()=1 and (new.alias,new.avatar,new.photo,new.photo_revision)
    is distinct from (old.alias,old.avatar,old.photo,old.photo_revision) then
    new.follows_profile:=false;
  end if;
  return new;
end;
$$;
revoke all on function anglica_private.game_identity_customized() from public,anon,authenticated;
drop trigger if exists keep_custom_game_identity on anglica_private.community_cards;
create trigger keep_custom_game_identity before update on anglica_private.community_cards
  for each row execute function anglica_private.game_identity_customized();
commit;
