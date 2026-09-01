-- Align achievement scopes with real product domains and allow course-specific rules.
alter table public.achievements
  add column if not exists condition_scope text not null default 'app',
  add column if not exists condition_course_id uuid references public.courses(id) on delete set null;

-- Fold lesson content (audio/exercises) into lessons and global systems into the app scope.
update public.achievements
set condition_scope = case
  when condition_scope in ('audio', 'exercises') then 'lessons'
  when condition_scope in ('streak', 'referrals') then 'app'
  when condition_scope in ('app', 'courses', 'lessons', 'cards') then condition_scope
  else 'app'
end;

-- A previously proposed puzzle metric corresponds to the real ordering exercise.
update public.achievements
set condition_type = 'ordering_completed'
where condition_type = 'puzzles_completed';

alter table public.achievements
  drop constraint if exists achievements_condition_scope_check;

alter table public.achievements
  add constraint achievements_condition_scope_check
  check (condition_scope in ('app','courses','lessons','cards'));

create index if not exists achievements_course_rule_lookup
  on public.achievements (condition_course_id, condition_type)
  where condition_course_id is not null;
