-- Restrict authoring and payments to an authenticated admin or trusted server.
-- Apply after 202610240001_learning_core.sql and an owner membership grant.
begin;

do $secure$ declare t text; p record; begin
  foreach t in array array[
    'courses', 'lessons', 'cards', 'tags', 'card_tags',
    'homework', 'achievements', 'cosmetics', 'subscription_plans',
    'promo_codes', 'marketing_sources'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies
      where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy anglica_admin_all on public.%I for all to authenticated using ((select public.is_anglica_admin())) with check ((select public.is_anglica_admin()))', t
    );
  end loop;
end $secure$;

-- Anonymous visitors can see published course names, but never edit them.
grant select on public.courses to anon;
create policy anglica_published_courses on public.courses
  for select to anon, authenticated using (is_published = true);

-- The app reads metadata from this view. Lesson content stays in the protected
-- base table, accessed through learning_open_lesson after a server access check.
create or replace view public.lesson_catalog as
  select l.id, l.course_id, l.title, l.description, l.order_index,
         l.is_unlocked, l.access_tier, l.is_published
  from public.lessons l join public.courses c on c.id = l.course_id
  where (l.is_published and c.is_published) or public.is_anglica_admin();
revoke all on public.lesson_catalog from public;
grant select on public.lesson_catalog to anon, authenticated;

-- The existing speaking and pronunciation workers read a lesson with the
-- caller's JWT. Their direct read is limited by the same server access rule.
create policy anglica_open_lesson_content on public.lessons
  for select to authenticated using (public.learning_can_open(id));

-- Word data is available only for published free material. The authoring
-- tables remain admin-only; these explicit read policies have no write grant.
create or replace function public.learning_card_visible(p_card_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cards k
    join public.lessons l on l.id = k.lesson_id
    join public.courses c on c.id = l.course_id
    where k.id = p_card_id and l.is_published and l.is_unlocked
      and c.is_published and l.access_tier = 'free' and c.access_tier = 'free'
  );
$$;
revoke all on function public.learning_card_visible(uuid) from public;
grant execute on function public.learning_card_visible(uuid) to anon, authenticated;
grant select on public.cards, public.tags, public.card_tags to anon;
create policy anglica_published_cards on public.cards for select to anon, authenticated
  using (public.learning_card_visible(id));
create policy anglica_public_tags on public.tags for select to anon, authenticated
  using (true);
create policy anglica_public_card_tags on public.card_tags for select to anon, authenticated
  using (public.learning_card_visible(card_id));

-- Active plan descriptions are public; mutations still need admin membership.
grant select on public.subscription_plans to anon;
create policy anglica_active_plans on public.subscription_plans
  for select to anon, authenticated using (is_active = true);

-- A client must never mint a paid subscription or a course purchase.
do $payments$ declare t text; p record; begin
  foreach t in array array['user_subscriptions', 'user_course_purchases'] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies
      where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format(
      'create policy anglica_owned_purchase on public.%I for select to authenticated using (user_id = (select auth.uid()) or (select public.is_anglica_admin()))', t
    );
  end loop;
end $payments$;

-- Legacy learning statistics are client-facing only as read-only own records.
alter table public.user_learning_stats enable row level security;
revoke all on public.user_learning_stats from public, anon, authenticated;
grant select on public.user_learning_stats to authenticated;
drop policy if exists anglica_own_legacy_stats on public.user_learning_stats;
create policy anglica_own_legacy_stats on public.user_learning_stats
  for select to authenticated using (user_id = (select auth.uid()));

-- Images stay publicly readable for the published app, while only an
-- authenticated admin can upload, replace, or remove them.
drop policy if exists "Enable all access for course images" on storage.objects;
drop policy if exists anglica_course_images_read on storage.objects;
drop policy if exists anglica_course_images_insert on storage.objects;
drop policy if exists anglica_course_images_update on storage.objects;
drop policy if exists anglica_course_images_delete on storage.objects;
create policy anglica_course_images_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'course-images');
create policy anglica_course_images_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'course-images' and (select public.is_anglica_admin())
  );
create policy anglica_course_images_update on storage.objects
  for update to authenticated using (
    bucket_id = 'course-images' and (select public.is_anglica_admin())
  ) with check (
    bucket_id = 'course-images' and (select public.is_anglica_admin())
  );
create policy anglica_course_images_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'course-images' and (select public.is_anglica_admin())
  );

commit;
