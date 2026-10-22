export type FeaturePeriod = 'day' | 'month' | 'total';
export type FeatureKey = 'translation' | 'speaking_review' | 'pronunciation_review' | 'personal_cards' | 'flashcards' | 'course_dictionary' | 'irregular_verbs' | 'word_statistics' | 'ai_assistant' | 'ai_text_review' | 'advanced_statistics' | 'premium_cosmetics';
export type FeatureDefinition = {
  key: FeatureKey;
  label: string;
  description: string;
  group: 'learning' | 'words' | 'ai' | 'extras';
  status: 'ready' | 'planned';
  period: FeaturePeriod | null;
  unit: string | null;
};

export const FEATURE_CATALOG: readonly FeatureDefinition[] = [
  { key: 'translation', label: 'Переклад за натисканням', description: 'Автоматичний переклад слова в контексті уроку. Рахуються запити на переклад.', group: 'learning', status: 'ready', period: 'day', unit: 'перекладів' },
  { key: 'speaking_review', label: 'Перевірка усної відповіді', description: 'Перевірка змісту й граматики записаної відповіді.', group: 'learning', status: 'ready', period: 'day', unit: 'перевірок' },
  { key: 'pronunciation_review', label: 'Перевірка вимови', description: 'Оцінювання вимови й плавності. Зараз доступне в дорослому тестовому пілоті.', group: 'learning', status: 'ready', period: 'day', unit: 'перевірок' },
  { key: 'course_dictionary', label: 'Словник курсів', description: 'Авторські слова з доступних за підпискою курсів.', group: 'words', status: 'ready', period: null, unit: null },
  { key: 'flashcards', label: 'Повторення карток', description: 'Ліміт рахує відповіді на картки, зокрема повторні покази того самого слова.', group: 'words', status: 'ready', period: 'day', unit: 'відповідей' },
  { key: 'personal_cards', label: 'Власні картки', description: 'Кількість збережених власних карток одночасно. Видалені картки не враховуються.', group: 'words', status: 'ready', period: 'total', unit: 'карток' },
  { key: 'irregular_verbs', label: 'Неправильні дієслова', description: 'Словник і повторення неправильних дієслів.', group: 'words', status: 'ready', period: null, unit: null },
  { key: 'word_statistics', label: 'Статистика слів', description: 'Покази, правильні й неправильні відповіді для кожного слова.', group: 'words', status: 'ready', period: null, unit: null },
  { key: 'ai_assistant', label: 'ШІ-помічник', description: 'Майбутній чат-помічник. Ліміт повідомлень користувача.', group: 'ai', status: 'planned', period: 'day', unit: 'повідомлень' },
  { key: 'ai_text_review', label: 'Перевірка письмових відповідей', description: 'Майбутня ШІ-перевірка відкритих текстових відповідей в уроках.', group: 'ai', status: 'planned', period: 'day', unit: 'перевірок' },
  { key: 'advanced_statistics', label: 'Розширена статистика', description: 'Майбутні загальні звіти про навчання й прогрес.', group: 'extras', status: 'planned', period: null, unit: null },
  { key: 'premium_cosmetics', label: 'Додаткові аватари й рамки', description: 'Майбутній доступ до косметичних елементів профілю.', group: 'extras', status: 'planned', period: null, unit: null },
];

export const FEATURE_GROUPS = [
  { key: 'learning', label: 'Навчання' },
  { key: 'words', label: 'Слова й картки' },
  { key: 'ai', label: 'ШІ-помічник' },
  { key: 'extras', label: 'Додаткові можливості' },
] as const;

export type FeatureRule = { enabled: boolean; limit: number | null; period: FeaturePeriod | null };
export type FeatureDraft = { enabled: boolean; unlimited: boolean; limit: string };
export type CourseAccess = { mode: 'none' | 'all' | 'selected'; ids: string[] };
export type PlanEntitlements = { version: 1; features: Record<FeatureKey, FeatureRule>; courses: CourseAccess };
export type PlanDraft = {
  code: string;
  title: string;
  description: string;
  image_url: string;
  tier: 'basic' | 'premium';
  billing_period: 'month' | 'year';
  price: string;
  currency: string;
  is_active: boolean;
  reward_currency: string;
  features: Record<FeatureKey, FeatureDraft>;
  courses: CourseAccess;
  configIssue: string | null;
  needsConfiguration: boolean;
  legacy: { features: unknown; ai_requests_limit: unknown };
};
export type PlanPayload = {
  code: string; title: string; description: string; image_url: string | null;
  tier: 'basic' | 'premium'; billing_period: 'month' | 'year'; price: number; currency: string;
  is_active: boolean; reward_currency: number; entitlements: PlanEntitlements;
  features: unknown; ai_requests_limit: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LIMIT = 1_000_000;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
const hasOnly = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).every(key => keys.includes(key));
const priceText = (value: string): string => value.trim().replace(',', '.');

function emptyFeatures(): Record<FeatureKey, FeatureDraft> {
  return Object.fromEntries(FEATURE_CATALOG.map(feature => [feature.key, { enabled: false, unlimited: feature.period === null, limit: '' }])) as Record<FeatureKey, FeatureDraft>;
}

export function createPlanDraft(): PlanDraft {
  return {
    code: '', title: '', description: '', image_url: '', tier: 'basic', billing_period: 'month',
    price: '', currency: 'UAH', is_active: false, reward_currency: '0', features: emptyFeatures(),
    courses: { mode: 'none', ids: [] }, configIssue: null, needsConfiguration: false,
    legacy: { features: [], ai_requests_limit: null },
  };
}

function parseEntitlements(value: unknown): { features: Record<FeatureKey, FeatureDraft>; courses: CourseAccess } | null {
  if (!record(value) || !hasOnly(value, ['version', 'features', 'courses']) || value.version !== 1 || !record(value.features) || !record(value.courses)) return null;
  const featureKeys = FEATURE_CATALOG.map(feature => feature.key);
  if (!hasOnly(value.features, featureKeys) || !hasOnly(value.courses, ['mode', 'ids'])) return null;
  const features = emptyFeatures();
  for (const definition of FEATURE_CATALOG) {
    const rule = value.features[definition.key];
    if (rule === undefined) continue;
    if (!record(rule) || !hasOnly(rule, ['enabled', 'limit', 'period']) || typeof rule.enabled !== 'boolean' || !('limit' in rule) || !('period' in rule)) return null;
    if (!rule.enabled || rule.limit === null) {
      if (rule.limit !== null || rule.period !== null) return null;
    } else if (!definition.period || !Number.isInteger(rule.limit) || (rule.limit as number) < 1 || (rule.limit as number) > MAX_LIMIT || rule.period !== definition.period) return null;
    features[definition.key] = { enabled: rule.enabled, unlimited: rule.enabled ? rule.limit === null : definition.period === null, limit: rule.limit === null ? '' : String(rule.limit) };
  }
  const courses = value.courses;
  if (!['none', 'all', 'selected'].includes(String(courses.mode)) || !Array.isArray(courses.ids) || courses.ids.length > 1000 || courses.ids.some(id => typeof id !== 'string' || !UUID.test(id))) return null;
  const ids = courses.ids.map(id => String(id).toLowerCase());
  if (new Set(ids).size !== ids.length || (courses.mode === 'selected' ? ids.length === 0 : ids.length !== 0)) return null;
  return { features, courses: { mode: courses.mode as CourseAccess['mode'], ids } };
}

export function planToDraft(row: Record<string, unknown>): PlanDraft {
  const draft = createPlanDraft();
  draft.code = text(row.code); draft.title = text(row.title); draft.description = text(row.description); draft.image_url = text(row.image_url);
  draft.tier = row.tier as PlanDraft['tier']; draft.billing_period = row.billing_period as PlanDraft['billing_period'];
  draft.price = text(row.price); draft.currency = text(row.currency); draft.is_active = row.is_active === true;
  draft.reward_currency = text(row.reward_currency ?? 0);
  draft.legacy = { features: row.features ?? [], ai_requests_limit: row.ai_requests_limit ?? null };
  if (row.entitlements === null || row.entitlements === undefined) {
    draft.needsConfiguration = true;
    return draft;
  }
  const parsed = parseEntitlements(row.entitlements);
  if (!parsed) draft.configIssue = 'Налаштування цього тарифу мають невідомий формат. Оновіть адмінку перед редагуванням.';
  else { draft.features = parsed.features; draft.courses = parsed.courses; }
  return draft;
}

export function validatePlanDraft(draft: PlanDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (draft.needsConfiguration) errors.entitlements = 'Підтвердьте налаштування функцій цієї підписки.';
  if (draft.configIssue) errors.entitlements = draft.configIssue;
  if (typeof draft.title !== 'string' || !draft.title.trim() || draft.title.trim().length > 120) errors.title = 'Вкажіть назву до 120 символів.';
  if (typeof draft.code !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(draft.code.trim())) errors.code = 'Код: 2–64 малі латинські літери, цифри, дефіс або підкреслення.';
  if (typeof draft.description !== 'string' || draft.description.trim().length > 2000) errors.description = 'Опис має містити до 2000 символів.';
  if (typeof draft.image_url !== 'string') errors.image_url = 'Вкажіть HTTPS-посилання на зображення.';
  else if (draft.image_url.trim()) {
    try {
      const url = new URL(draft.image_url.trim());
      if (url.protocol !== 'https:' || url.username || url.password || draft.image_url.trim().length > 2048) throw new Error();
    } catch { errors.image_url = 'Вкажіть HTTPS-посилання на зображення без пароля.'; }
  }
  if (!['basic', 'premium'].includes(draft.tier)) errors.tier = 'Оберіть рівень Basic або Premium.';
  if (!['month', 'year'].includes(draft.billing_period)) errors.billing_period = 'Оберіть місяць або рік.';
  if (typeof draft.price !== 'string' || !/^\d{1,8}(?:\.\d{1,2})?$/.test(priceText(draft.price))) errors.price = 'Вкажіть ціну від 0 до 99 999 999,99, щонайбільше два знаки після коми.';
  if (typeof draft.currency !== 'string' || !['UAH', 'USD', 'EUR'].includes(draft.currency)) errors.currency = 'Оберіть UAH, USD або EUR.';
  if (typeof draft.is_active !== 'boolean') errors.is_active = 'Некоректний стан тарифу.';
  if (typeof draft.reward_currency !== 'string' || !/^\d{1,7}$/.test(draft.reward_currency.trim()) || Number(draft.reward_currency) > MAX_LIMIT) errors.reward_currency = 'Бонус має бути цілим числом від 0 до 1 000 000.';
  if (!record(draft.features) || !hasOnly(draft.features, FEATURE_CATALOG.map(feature => feature.key))) errors.entitlements = 'Невідомий формат функцій тарифу.';
  for (const feature of FEATURE_CATALOG) {
    const rule = draft.features?.[feature.key];
    if (!record(rule) || typeof rule.enabled !== 'boolean' || typeof rule.unlimited !== 'boolean' || typeof rule.limit !== 'string') {
      errors[`features.${feature.key}`] = `Перевірте налаштування «${feature.label}».`;
      continue;
    }
    if (rule.enabled && feature.period && !rule.unlimited && (!/^\d{1,7}$/.test(rule.limit.trim()) || Number(rule.limit) < 1 || Number(rule.limit) > MAX_LIMIT)) errors[`features.${feature.key}.limit`] = 'Ліміт має бути цілим числом від 1 до 1 000 000.';
  }
  if (!record(draft.courses) || !['none', 'all', 'selected'].includes(draft.courses.mode) || !Array.isArray(draft.courses.ids)) errors['courses.ids'] = 'Перевірте доступ до курсів.';
  else {
    const ids = draft.courses.ids;
    if (ids.length > 1000 || ids.some(id => typeof id !== 'string' || !UUID.test(id)) || new Set(ids.map(id => typeof id === 'string' ? id.toLowerCase() : id)).size !== ids.length || (draft.courses.mode === 'selected' ? ids.length === 0 : ids.length !== 0)) errors['courses.ids'] = draft.courses.mode === 'selected' ? 'Оберіть принаймні один курс без повторів.' : 'Для цього режиму список курсів має бути порожнім.';
  }
  return errors;
}

export function buildPlanPayload(draft: PlanDraft): PlanPayload {
  const errors = validatePlanDraft(draft);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const features = Object.fromEntries(FEATURE_CATALOG.map(feature => {
    const rule = draft.features[feature.key];
    const limited = rule.enabled && feature.period !== null && !rule.unlimited;
    return [feature.key, { enabled: rule.enabled, limit: limited ? Number(rule.limit) : null, period: limited ? feature.period : null }];
  })) as Record<FeatureKey, FeatureRule>;
  return {
    code: draft.code.trim(), title: draft.title.trim(), description: draft.description.trim(), image_url: draft.image_url.trim() || null,
    tier: draft.tier, billing_period: draft.billing_period, price: Number(priceText(draft.price)), currency: draft.currency,
    is_active: draft.is_active, reward_currency: Number(draft.reward_currency),
    features: draft.legacy.features, ai_requests_limit: draft.legacy.ai_requests_limit,
    entitlements: { version: 1, features, courses: { mode: draft.courses.mode, ids: draft.courses.ids.map(id => id.toLowerCase()) } },
  };
}

export function summarizePlan(draft: PlanDraft): string[] {
  if (draft.configIssue) return [draft.configIssue];
  if (draft.needsConfiguration) return ['Функції цього тарифу ще не налаштовані'];
  const items: string[] = [];
  if (draft.courses.mode === 'all') items.push('Усі курси');
  if (draft.courses.mode === 'selected') items.push(`Обрані курси: ${draft.courses.ids.length}`);
  for (const feature of FEATURE_CATALOG) {
    const rule = draft.features[feature.key];
    if (!rule.enabled) continue;
    const validLimit = /^\d{1,7}$/.test(rule.limit.trim()) && Number(rule.limit) >= 1 && Number(rule.limit) <= MAX_LIMIT;
    const quota = feature.period ? rule.unlimited ? 'без ліміту' : !validLimit ? 'вкажіть ліміт' : `${rule.limit.trim()} ${feature.unit}${feature.period === 'day' ? ' на день' : feature.period === 'month' ? ' на місяць' : ' одночасно'}` : '';
    items.push(`${feature.label}${quota ? ` · ${quota}` : ''}${feature.status === 'planned' ? ' · заплановано' : ''}`);
  }
  return items;
}
