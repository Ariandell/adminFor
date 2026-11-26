begin;
-- Public game identity contains no account name, email, uploaded photo or bio.
create or replace function anglica_private.provision_game_card()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.email_confirmed_at is not null then
    insert into anglica_private.community_cards(user_id,alias,avatar,frame,published,show_lessons)
    values(new.id,'Мандрівник '||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
      (array['iris','mint','violet','sunrise'])[1+floor(random()*4)::integer],'line',true,false)
    on conflict(user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function anglica_private.provision_game_card() from public,anon,authenticated;
drop trigger if exists provision_anglica_game_card on auth.users;
create trigger provision_anglica_game_card after insert or update of email_confirmed_at on auth.users
  for each row execute function anglica_private.provision_game_card();
-- Preserve all existing cards, including a previously disabled participation.
insert into anglica_private.community_cards(user_id,alias,avatar,frame,published,show_lessons)
  select u.id,'Мандрівник '||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    (array['iris','mint','violet','sunrise'])[1+floor(random()*4)::integer],'line',true,false
  from auth.users u where u.email_confirmed_at is not null
  on conflict(user_id) do nothing;
commit;
