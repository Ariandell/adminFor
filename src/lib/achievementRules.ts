export type AchievementScope =
  | 'app'
  | 'courses'
  | 'lessons'
  | 'cards'
  | 'exercises'
  | 'audio'
  | 'streak'
  | 'referrals';

export type AchievementAction = {
  value: string;
  label: string;
  unit: string;
  summary: (target: number) => string;
};

export const achievementScopes: { value: AchievementScope; label: string }[] = [
  { value: 'app', label: 'Увесь додаток' },
  { value: 'courses', label: 'Курси' },
  { value: 'lessons', label: 'Уроки' },
  { value: 'cards', label: 'Картки' },
  { value: 'exercises', label: 'Вправи' },
  { value: 'audio', label: 'Аудіо' },
  { value: 'streak', label: 'Серія днів' },
  { value: 'referrals', label: 'Реферали' },
];

export const achievementActions: Record<AchievementScope, AchievementAction[]> = {
  app: [
    { value: 'minutes_spent', label: 'Провести N хвилин у додатку', unit: 'хвилин', summary: n => `Проведе в додатку ${n} хв.` },
    { value: 'active_days', label: 'Бути активним N днів', unit: 'днів', summary: n => `Буде активним у додатку ${n} дн.` },
    { value: 'ai_questions_asked', label: 'Поставити N запитань AI', unit: 'запитань', summary: n => `Поставить AI ${n} запитань` },
    { value: 'achievements_unlocked', label: 'Отримати N досягнень', unit: 'досягнень', summary: n => `Отримає ${n} інших досягнень` },
  ],
  courses: [
    { value: 'courses_completed', label: 'Завершити N курсів', unit: 'курсів', summary: n => `Завершить ${n} курсів` },
    { value: 'course_lessons_completed', label: 'Пройти N уроків у курсах', unit: 'уроків', summary: n => `Пройде ${n} уроків у курсах` },
    { value: 'course_minutes_spent', label: 'Навчатися на курсах N хвилин', unit: 'хвилин', summary: n => `Навчатиметься на курсах ${n} хв.` },
  ],
  lessons: [
    { value: 'lessons_completed', label: 'Пройти N уроків', unit: 'уроків', summary: n => `Пройде ${n} уроків` },
    { value: 'lessons_perfect', label: 'Пройти N уроків без помилок', unit: 'уроків', summary: n => `Пройде без помилок ${n} уроків` },
    { value: 'homework_completed', label: 'Виконати N домашніх завдань', unit: 'завдань', summary: n => `Виконає ${n} домашніх завдань` },
  ],
  cards: [
    { value: 'cards_viewed', label: 'Прогорнути N карток', unit: 'карток', summary: n => `Прогорне ${n} карток` },
    { value: 'cards_learned', label: 'Вивчити N карток', unit: 'карток', summary: n => `Вивчить ${n} карток` },
    { value: 'card_answers_correct', label: 'Дати N правильних відповідей', unit: 'відповідей', summary: n => `Правильно відповість на ${n} карток` },
    { value: 'card_sessions_completed', label: 'Завершити N сесій карток', unit: 'сесій', summary: n => `Завершить ${n} сесій карток` },
    { value: 'card_correct_streak', label: 'Відповісти правильно N разів поспіль', unit: 'відповідей', summary: n => `Правильно відповість ${n} разів поспіль` },
  ],
  exercises: [
    { value: 'exercises_completed', label: 'Виконати N вправ', unit: 'вправ', summary: n => `Виконає ${n} вправ` },
    { value: 'exercise_answers_correct', label: 'Дати N правильних відповідей', unit: 'відповідей', summary: n => `Дасть у вправах ${n} правильних відповідей` },
    { value: 'tests_perfect', label: 'Завершити N тестів без помилок', unit: 'тестів', summary: n => `Завершить без помилок ${n} тестів` },
    { value: 'puzzles_completed', label: 'Скласти N пазлів', unit: 'пазлів', summary: n => `Складе ${n} навчальних пазлів` },
    { value: 'speaking_tasks_completed', label: 'Виконати N голосових завдань', unit: 'завдань', summary: n => `Виконає ${n} голосових завдань` },
    { value: 'ai_answers_approved', label: 'Отримати N схвалених AI-відповідей', unit: 'відповідей', summary: n => `Отримає від AI ${n} схвалених відповідей` },
  ],
  audio: [
    { value: 'audio_minutes', label: 'Прослухати аудіо протягом N хвилин', unit: 'хвилин', summary: n => `Прослухає аудіо загалом ${n} хв.` },
    { value: 'audio_completed', label: 'Прослухати N аудіо до кінця', unit: 'аудіо', summary: n => `Прослухає до кінця ${n} аудіо` },
  ],
  streak: [
    { value: 'streak_days', label: 'Навчатися N днів поспіль', unit: 'днів', summary: n => `Навчатиметься ${n} дн. поспіль` },
    { value: 'longest_streak', label: 'Досягти серії у N днів', unit: 'днів', summary: n => `Досягне серії у ${n} дн.` },
  ],
  referrals: [
    { value: 'referrals_completed', label: 'Запросити N користувачів', unit: 'користувачів', summary: n => `Запросить ${n} користувачів` },
    { value: 'referrals_subscribed', label: 'Запросити N користувачів із підпискою', unit: 'користувачів', summary: n => `Запросить ${n} користувачів, які оформлять підписку` },
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

export function formatAchievementRule(scope: string, action: string, target: number): string {
  return getAchievementAction(scope, action)?.summary(target) || `Досягне значення ${target}`;
}
