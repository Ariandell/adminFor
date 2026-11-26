begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('eb000000-0000-0000-0000-000000000001','secret-email@example.invalid',null,'{"full_name":"Private account name"}');
do $$ begin
 if exists(select 1 from anglica_private.community_cards where user_id='eb000000-0000-0000-0000-000000000001') then raise exception 'Unconfirmed account enrolled'; end if;
end $$;
update auth.users set email_confirmed_at=now() where id='eb000000-0000-0000-0000-000000000001';
do $$ declare card anglica_private.community_cards; begin
 select * into card from anglica_private.community_cards where user_id='eb000000-0000-0000-0000-000000000001';
 if not card.published or card.alias not like 'Мандрівник %' or card.show_lessons or card.photo is not null or card.bio<>'' then raise exception 'Unsafe auto identity'; end if;
 if card.public_id=card.user_id or anglica_private.community_card_json(card)::text like '%Private account name%' or anglica_private.community_card_json(card)::text like '%secret-email%' then raise exception 'Account identity exposed'; end if;
 if not exists(select 1 from anglica_private.community_ranking() where user_id=card.user_id) then raise exception 'Auto participant missing from ranking'; end if;
end $$;
update anglica_private.community_cards set published=false,alias='My hidden card' where user_id='eb000000-0000-0000-0000-000000000001';
update auth.users set email_confirmed_at=now() where id='eb000000-0000-0000-0000-000000000001';
do $$ begin
 if exists(select 1 from anglica_private.community_ranking() where user_id='eb000000-0000-0000-0000-000000000001') then raise exception 'Opt-out ignored'; end if;
 if not exists(select 1 from anglica_private.community_cards where user_id='eb000000-0000-0000-0000-000000000001' and alias='My hidden card' and not published) then raise exception 'Opt-out replaced'; end if;
end $$;
insert into auth.users(id,email_confirmed_at) values('eb000000-0000-0000-0000-000000000002',now());
do $$ begin
 if not exists(select 1 from anglica_private.community_ranking() where user_id='eb000000-0000-0000-0000-000000000002') then raise exception 'Confirmed insert not enrolled'; end if;
end $$;
rollback;
