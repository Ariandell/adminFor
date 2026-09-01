-- Flexible achievement definitions: scope + tracked action + admin-defined target.
alter table public.achievements
  add column if not exists condition_scope text not null default 'app';

-- Preserve the meaning of achievements created with the previous admin form.
update public.achievements
set condition_scope = case
  when condition_type in ('lessons_completed') then 'lessons'
  when condition_type in ('cards_learned') then 'cards'
  when condition_type in ('streak_days') then 'streak'
  else 'app'
end
where condition_scope = 'app';

alter table public.achievements
  drop constraint if exists achievements_condition_scope_check;

alter table public.achievements
  add constraint achievements_condition_scope_check
  check (condition_scope in ('app','courses','lessons','cards','exercises','audio','streak','referrals'));

create index if not exists achievements_rule_lookup
  on public.achievements (condition_scope, condition_type, is_active);
