export type AchievementScope = 'app' | 'courses' | 'lessons' | 'cards';

export type AchievementAction = {
  value: string;
  label: string;
  unit: string;
  requiresCourse?: boolean;
  summary: (target: number) => string;
};

export const achievementScopes: { value: AchievementScope; label: string }[] = [
  { value: 'app', label: 'Увесь додаток' },
  { value: 'courses', label: 'Курси' },
  { value: 'lessons', label: 'Уроки' },
  { value: 'cards', label: 'Картки' },
];

function plural(value: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(value) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export const achievementActions: Record<AchievementScope, AchievementAction[]> = {
  app: [
    { value: 'minutes_spent', label: 'Провести N хвилин у додатку', unit: 'хвилин', summary: n => `Проведе в додатку ${n} ${plural(n, 'хвилину', 'хвилини', 'хвилин')}` },
    { value: 'active_days', label: 'Бути активним N днів', unit: 'днів', summary: n => `Буде активним у додатку ${n} ${plural(n, 'день', 'дні', 'днів')}` },
    { value: 'streak_days', label: 'Навчатися N днів поспіль', unit: 'днів', summary: n => `Навчатиметься ${n} ${plural(n, 'день', 'дні', 'днів')} поспіль` },
    { value: 'ai_questions_asked', label: 'Поставити N запитань AI', unit: 'запитань', summary: n => `Поставить AI ${n} ${plural(n, 'запитання', 'запитання', 'запитань')}` },
    { value: 'achievements_unlocked', label: 'Отримати N досягнень', unit: 'досягнень', summary: n => `Отримає ${n} інших ${plural(n, 'досягнення', 'досягнення', 'досягнень')}` },
    { value: 'referrals_completed', label: 'Запросити N користувачів', unit: 'користувачів', summary: n => `Запросить ${n} ${plural(n, 'користувача', 'користувачів', 'користувачів')}` },
    { value: 'referrals_subscribed', label: 'Запросити N користувачів із підпискою', unit: 'користувачів', summary: n => `Запросить ${n} ${plural(n, 'користувача', 'користувачів', 'користувачів')}, які оформлять підписку` },
  ],
  courses: [
    { value: 'courses_completed', label: 'Завершити N курсів', unit: 'курсів', summary: n => `Завершить ${n} ${plural(n, 'курс', 'курси', 'курсів')}` },
    { value: 'course_lessons_completed', label: 'Пройти N уроків вибраного курсу', unit: 'уроків', requiresCourse: true, summary: n => `Пройде ${n} ${plural(n, 'урок', 'уроки', 'уроків')}` },
    { value: 'course_minutes_spent', label: 'Навчатися у вибраному курсі N хвилин', unit: 'хвилин', requiresCourse: true, summary: n => `Навчатиметься ${n} ${plural(n, 'хвилину', 'хвилини', 'хвилин')}` },
    { value: 'course_progress_percent', label: 'Досягти N% прогресу у вибраному курсі', unit: '%', requiresCourse: true, summary: n => `Досягне ${n}% прогресу` },
  ],
  lessons: [
    { value: 'lessons_completed', label: 'Пройти N уроків', unit: 'уроків', summary: n => `Пройде ${n} ${plural(n, 'урок', 'уроки', 'уроків')}` },
    { value: 'lessons_perfect', label: 'Пройти N уроків без помилок', unit: 'уроків', summary: n => `Пройде без помилок ${n} ${plural(n, 'урок', 'уроки', 'уроків')}` },
    { value: 'tests_completed', label: 'Завершити N тестів', unit: 'тестів', summary: n => `Завершить ${n} ${plural(n, 'тест', 'тести', 'тестів')} в уроках` },
    { value: 'lesson_answers_correct', label: 'Дати N правильних відповідей у вправах', unit: 'відповідей', summary: n => `Дасть у вправах ${n} ${plural(n, 'правильну відповідь', 'правильні відповіді', 'правильних відповідей')}` },
    { value: 'single_choice_correct', label: 'Правильно відповісти на N питань з одним варіантом', unit: 'відповідей', summary: n => `Правильно відповість на ${n} питань з одним варіантом` },
    { value: 'multiple_choice_correct', label: 'Правильно відповісти на N питань із кількома варіантами', unit: 'відповідей', summary: n => `Правильно відповість на ${n} питань із кількома варіантами` },
    { value: 'text_answers_submitted', label: 'Виконати N завдань із текстовою відповіддю', unit: 'відповідей', summary: n => `Виконає ${n} завдань із текстовою відповіддю` },
    { value: 'ordering_completed', label: 'Виконати N завдань на впорядкування', unit: 'завдань', summary: n => `Виконає ${n} завдань на впорядкування` },
    { value: 'matching_completed', label: 'Виконати N завдань на зіставлення', unit: 'завдань', summary: n => `Виконає ${n} завдань на зіставлення` },
    { value: 'audio_minutes', label: 'Прослухати аудіо протягом N хвилин', unit: 'хвилин', summary: n => `Прослухає аудіо в уроках загалом ${n} ${plural(n, 'хвилину', 'хвилини', 'хвилин')}` },
    { value: 'audio_completed', label: 'Прослухати N аудіо до кінця', unit: 'аудіо', summary: n => `Прослухає до кінця ${n} аудіо в уроках` },
    { value: 'ai_answers_approved', label: 'Отримати N схвалених AI-відповідей', unit: 'відповідей', summary: n => `Отримає від AI ${n} схвалених відповідей` },
    { value: 'homework_completed', label: 'Виконати N домашніх завдань', unit: 'завдань', summary: n => `Виконає ${n} домашніх завдань після уроків` },
    { value: 'speaking_tasks_completed', label: 'Виконати N голосових завдань', unit: 'завдань', summary: n => `Виконає ${n} голосових завдань після уроків` },
  ],
  cards: [
    { value: 'cards_viewed', label: 'Прогорнути N карток', unit: 'карток', summary: n => `Прогорне ${n} ${plural(n, 'картку', 'картки', 'карток')}` },
    { value: 'cards_learned', label: 'Вивчити N карток', unit: 'карток', summary: n => `Вивчить ${n} ${plural(n, 'картку', 'картки', 'карток')}` },
    { value: 'card_answers_correct', label: 'Дати N правильних відповідей', unit: 'відповідей', summary: n => `Правильно відповість на ${n} карток` },
    { value: 'card_sessions_completed', label: 'Завершити N сесій карток', unit: 'сесій', summary: n => `Завершить ${n} сесій карток` },
    { value: 'card_correct_streak', label: 'Відповісти правильно N разів поспіль', unit: 'відповідей', summary: n => `Правильно відповість на ${n} карток поспіль` },
    { value: 'irregular_verbs_learned', label: 'Вивчити N неправильних дієслів', unit: 'дієслів', summary: n => `Вивчить ${n} неправильних дієслів` },
  ],
};

export function getAchievementScopeLabel(scope: string): string {
  return achievementScopes.find(option => option.value === scope)?.label || 'Увесь додаток';
}

export function getAchievementAction(scope: string, action: string): AchievementAction | undefined {
  const safeScope = scope in achievementActions ? scope as AchievementScope : 'app';
  return achievementActions[safeScope].find(option => option.value === action)
    || Object.values(achievementActions).flat().find(option => option.value === action);
}

export function formatAchievementRule(scope: string, action: string, target: number, courseTitle?: string): string {
  const summary = getAchievementAction(scope, action)?.summary(target) || `Досягне значення ${target}`;
  return courseTitle ? `${summary} у курсі «${courseTitle}»` : summary;
}
