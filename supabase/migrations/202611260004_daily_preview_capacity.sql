begin;
-- Daily feasibility follows existing preview/admin visibility, without granting access.
create or replace function anglica_private.daily_course_lessons(p_user uuid,p_course uuid)
returns table(lesson_id uuid,course_id uuid,first_completed_at timestamptz)
language sql stable set search_path='' as $$
  select l.id,l.course_id,x.first_completed_at from public.lessons l
  join public.courses c on c.id=l.course_id
  left join public.user_lesson_completions x on x.lesson_id=l.id and x.user_id=p_user
  where (p_course is null or l.course_id=p_course)
    and ((c.is_published and l.is_published and l.is_unlocked
      and c.access_tier='free' and l.access_tier='free')
      or public.learning_has_course_preview(c.id) or public.is_anglica_admin());
$$;
revoke all on function anglica_private.daily_course_lessons(uuid,uuid) from public,anon,authenticated;

create or replace function anglica_private.daily_quest_capacity_v2_core(
  p_user uuid,p_kind text,p_course uuid,p_starts timestamptz,p_ends timestamptz
) returns integer language plpgsql stable set search_path='' as $$
declare
  total integer;
begin
  case p_kind
    when 'lessons_completed' then
      select count(*) into total from public.lessons l join public.courses c on c.id=l.course_id
      where ((l.is_published and l.is_unlocked and c.is_published)
          or public.learning_has_course_preview(c.id) or public.is_anglica_admin())
        and (p_course is null or l.course_id=p_course)
        and not exists (select 1 from public.user_lesson_completions x
          where x.user_id=p_user and x.lesson_id=l.id and x.first_completed_at<p_starts)
        and exists (select 1 from public.lessons access_lesson
          where access_lesson.course_id=l.course_id and public.learning_can_open(access_lesson.id));
    when 'courses_practiced' then
      select count(distinct l.course_id) into total from anglica_private.daily_course_lessons(p_user,null) l
      where (l.first_completed_at is null or l.first_completed_at>=p_starts)
        and public.learning_can_open(l.lesson_id);
    when 'quiz_lessons_checked' then
      select count(*) into total from anglica_private.daily_course_lessons(p_user,p_course) l
      where (l.first_completed_at>=p_starts and l.first_completed_at<p_ends and exists (
        select 1 from anglica_private.daily_quiz_completions q where q.user_id=p_user and q.lesson_id=l.lesson_id))
        or (l.first_completed_at is null and public.learning_can_open(l.lesson_id) and exists (
          select 1 from public.lessons lesson
          cross join lateral anglica_private.daily_quiz_questions(lesson.content) q
          where lesson.id=l.lesson_id
          group by lesson.id having count(*)=count(distinct q.answer_key)
            and bool_and(coalesce(q.question->>'type','') in ('single_choice','multiple_choice','text_input','matching','ordering'))));
    when 'personal_words_added' then
      total:=30;
    when 'personal_cards_reviewed' then
      select count(*) into total from anglica_private.daily_personal_word_keys(p_user);
    else
      select count(*) into total from anglica_private.daily_word_keys(p_user,p_course) k
      where p_kind not in ('weak_words','weak_words_known') or exists (
        select 1 from public.user_word_practice_events old
        where old.user_id=p_user and old.word_key=k.word_key and old.kind='incorrect' and old.received_at<p_starts);
  end case;
  return total;
end;
$$;
revoke all on function anglica_private.daily_quest_capacity_v2_core(uuid,text,uuid,timestamptz,timestamptz) from public,anon,authenticated;

commit;
