export const dailyKinds = [
  { value: 'lessons_completed', label: 'Пройти нові уроки', unit: 'уроків', max: 10 },
  { value: 'cards_reviewed', label: 'Повторити різні слова', unit: 'слів', max: 100 },
  { value: 'weak_words', label: 'Повернутися до складних слів', unit: 'слів', max: 50 },
] as const;
export type DailyKind = typeof dailyKinds[number]['value'];
export type DailyDraft = { title: string; description: string; kind: DailyKind; target: string; reward_points: string; course_id: string; is_active: boolean };
export const emptyDaily = (): DailyDraft => ({ title: '', description: '', kind: 'lessons_completed', target: '2', reward_points: '20', course_id: '', is_active: false });
export function dailyPayload(draft: DailyDraft) {
  const kind = dailyKinds.find(k => k.value === draft.kind);
  const target = Number(draft.target), reward = Number(draft.reward_points);
  if (!draft.title.trim() || draft.title.trim().length > 80) throw Error('Назва має містити від 1 до 80 символів.');
  if (draft.description.trim().length > 240) throw Error('Опис — до 240 символів.');
  if (!kind || !Number.isInteger(target) || target < 1 || target > kind.max) throw Error(`Вкажи цілу ціль від 1 до ${kind?.max ?? 1}.`);
  if (!Number.isInteger(reward) || reward < 0 || reward > 60) throw Error('Винагорода — від 0 до 60 балів.');
  if (draft.course_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draft.course_id)) throw Error('Обери курс зі списку.');
  return { title: draft.title.trim(), description: draft.description.trim(), kind: draft.kind, target, reward_points: reward, course_id: draft.course_id || null, is_active: draft.is_active };
}
