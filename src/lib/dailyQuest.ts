export const dailyKindGroups = {
  lessons: 'Уроки й курси',
  cards: 'Картки з уроків',
  personal: 'Власний словник',
} as const;

export const dailyKinds = [
  {
    value: 'lessons_completed', group: 'lessons', label: 'Пройти нові уроки', unit: 'уроків', max: 10, allowsCourse: true,
    description: 'Зараховується перше завершення кожного уроку сьогодні.',
  },
  {
    value: 'courses_practiced', group: 'lessons', label: 'Позайматися в різних курсах', unit: 'курсів', max: 3, allowsCourse: false,
    description: 'Щоб курс зарахувався, сьогодні потрібно вперше завершити в ньому хоча б один урок.',
  },
  {
    value: 'course_finished', group: 'lessons', label: 'Завершити курс', unit: 'курсів', max: 1, allowsCourse: true,
    description: 'Зараховується курс, у якому учень сьогодні завершив усі доступні уроки, що залишалися непройденими.',
  },
  {
    value: 'quiz_lessons_checked', group: 'lessons', label: 'Пройти уроки з перевіреним тестом', unit: 'уроків', max: 10, allowsCourse: true,
    description: 'Зараховується новий завершений урок, якщо в ньому є тест і перевірено всі його запитання.',
  },
  {
    value: 'cards_reviewed', group: 'cards', label: 'Повторити різні слова', unit: 'слів', max: 100, allowsCourse: true,
    description: 'Кожне слово з пройдених уроків зараховується раз на день після відповіді на картку.',
  },
  {
    value: 'cards_known', group: 'cards', label: 'Позначити слова як «Знаю»', unit: 'слів', max: 100, allowsCourse: true,
    description: 'Зараховуються різні слова з пройдених уроків, які учень сьогодні позначив як «Знаю».',
  },
  {
    value: 'weak_words', group: 'cards', label: 'Повернутися до складних слів', unit: 'слів', max: 50, allowsCourse: true,
    description: 'Зараховуються слова з пройдених уроків, які учень до сьогодні позначав як «Не знаю» і сьогодні повторив.',
  },
  {
    value: 'weak_words_known', group: 'cards', label: 'Пригадати складні слова', unit: 'слів', max: 50, allowsCourse: true,
    description: 'Зараховуються слова з пройдених уроків, які учень до сьогодні позначав як «Не знаю», а сьогодні позначив як «Знаю».',
  },
  {
    value: 'personal_cards_reviewed', group: 'personal', label: 'Повторити власні картки', unit: 'карток', max: 100, allowsCourse: false,
    description: 'Кожна картка з власного словника зараховується раз на день після відповіді.',
  },
  {
    value: 'personal_words_added', group: 'personal', label: 'Додати слова до власного словника', unit: 'слів', max: 30, allowsCourse: false,
    description: 'Зараховуються різні нові слова, які учень сьогодні зберіг у власний словник.',
  },
] as const;

export type DailyKind = typeof dailyKinds[number]['value'];
export type DailyDraft = { title: string; description: string; kind: DailyKind; target: string; reward_points: string; course_id: string; is_active: boolean };
export const emptyDaily = (): DailyDraft => ({ title: '', description: '', kind: 'lessons_completed', target: '2', reward_points: '20', course_id: '', is_active: false });

export function changeDailyKind(draft: DailyDraft, kind: DailyKind): DailyDraft {
  const definition = dailyKinds.find(entry => entry.value === kind)!;
  return { ...draft, kind, target: '1', course_id: definition.allowsCourse ? draft.course_id : '' };
}

export function dailyPayload(draft: DailyDraft) {
  const kind = dailyKinds.find(k => k.value === draft.kind);
  const target = Number(draft.target), reward = Number(draft.reward_points);
  if (!draft.title.trim() || draft.title.trim().length > 80) throw Error('Назва має містити від 1 до 80 символів.');
  if (draft.description.trim().length > 240) throw Error('Опис — до 240 символів.');
  if (!kind || !Number.isInteger(target) || target < 1 || target > kind.max) throw Error(`Вкажи цілу ціль від 1 до ${kind?.max ?? 1}.`);
  if (!Number.isInteger(reward) || reward < 0 || reward > 60) throw Error('Винагорода — від 0 до 60 балів.');
  if (draft.course_id && !kind.allowsCourse) throw Error('Для цієї умови прибери обмеження за курсом.');
  if (draft.course_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draft.course_id)) throw Error('Обери курс зі списку.');
  return { title: draft.title.trim(), description: draft.description.trim(), kind: draft.kind, target, reward_points: reward, course_id: draft.course_id || null, is_active: draft.is_active };
}
