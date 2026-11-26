begin;
insert into auth.users(id,email_confirmed_at,raw_user_meta_data) values
 ('ec000000-0000-0000-0000-000000000001',now(),'{"full_name":"ExistingPlayer"}'),
 ('ec000000-0000-0000-0000-000000000002',now(),'{"full_name":"HiddenPlayer"}'),
 ('ec000000-0000-0000-0000-000000000003',now(),'{"full_name":"private@example.invalid"}');
insert into public.user_profile_details(user_id,avatar,avatar_photo,avatar_photo_revision)
 values('ec000000-0000-0000-0000-000000000001','mint','iVBORw0KGgoAAAANSUhEUgAAAQAAAAEA','ec100000-0000-0000-0000-000000000001');
do $$ begin
 if not exists(select 1 from anglica_private.community_cards where user_id='ec000000-0000-0000-0000-000000000001'
   and alias='ExistingPlayer' and avatar='mint' and photo='iVBORw0KGgoAAAANSUhEUgAAAQAAAAEA' and follows_profile)
 then raise exception 'Profile nickname and uploaded photo not retained'; end if;
 if not exists(select 1 from anglica_private.community_cards where user_id='ec000000-0000-0000-0000-000000000003'
   and alias ~ '^Мандрівник [A-F0-9]{6}$') then raise exception 'Email used as a public nickname'; end if;
end $$;
update auth.users set raw_user_meta_data='{"full_name":"RenamedPlayer"}' where id='ec000000-0000-0000-0000-000000000001';
do $$ begin
 if not exists(select 1 from anglica_private.community_cards where user_id='ec000000-0000-0000-0000-000000000001' and alias='RenamedPlayer' and follows_profile)
 then raise exception 'Following profile nickname stopped'; end if;
end $$;
update anglica_private.community_cards set alias='CustomPublicAlias' where user_id='ec000000-0000-0000-0000-000000000001';
update auth.users set raw_user_meta_data='{"full_name":"AnotherProfileName"}' where id='ec000000-0000-0000-0000-000000000001';
update public.user_profile_details set avatar='violet',avatar_photo=null,avatar_photo_revision=null where user_id='ec000000-0000-0000-0000-000000000001';
do $$ begin
 if not exists(select 1 from anglica_private.community_cards where user_id='ec000000-0000-0000-0000-000000000001'
   and alias='CustomPublicAlias' and avatar='mint' and photo is not null and not follows_profile)
 then raise exception 'Custom public identity overwritten'; end if;
end $$;
update anglica_private.community_cards set published=false where user_id='ec000000-0000-0000-0000-000000000002';
update auth.users set raw_user_meta_data='{"full_name":"StillHidden"}' where id='ec000000-0000-0000-0000-000000000002';
do $$ begin
 if exists(select 1 from anglica_private.community_ranking() where user_id='ec000000-0000-0000-0000-000000000002')
 then raise exception 'Nickname synchronization re-enabled participation'; end if;
 if has_function_privilege('authenticated','anglica_private.sync_game_identity(uuid)','EXECUTE')
 then raise exception 'A client can synchronize someone else'; end if;
end $$;
rollback;
