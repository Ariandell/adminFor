export type PronunciationMode = 'scripted' | 'unscripted';
export type PronunciationLocale = 'en-US' | 'en-GB';

export interface PronunciationTaskData {
  version: 1;
  title: string;
  prompt: string;
  mode: PronunciationMode;
  locale: PronunciationLocale;
  referenceText: string;
  referenceAudioUrl: string;
  maxDurationSeconds: number;
}

export const pronunciationTaskLimits = {
  title: 120,
  prompt: 2000,
  referenceText: 2000,
  referenceAudioUrl: 2048,
  minDurationSeconds: 15,
  maxDurationSeconds: 120,
  defaultDurationSeconds: 60,
} as const;

function plainText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\r\n?/g, '\n')
    // Retain line breaks and tabs, but remove non-printing controls from imports.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
}

/** Drafts retain both texts so changing the exercise mode does not discard work. */
export function normalizePronunciationTask(value: unknown): PronunciationTaskData {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const duration = typeof source.maxDurationSeconds === 'number' && Number.isFinite(source.maxDurationSeconds)
    ? Math.round(source.maxDurationSeconds)
    : pronunciationTaskLimits.defaultDurationSeconds;
  return {
    version: 1,
    title: plainText(source.title, pronunciationTaskLimits.title) || 'Тренуємо вимову',
    prompt: plainText(source.prompt, pronunciationTaskLimits.prompt),
    mode: source.mode === 'unscripted' ? 'unscripted' : 'scripted',
    locale: source.locale === 'en-GB' ? 'en-GB' : 'en-US',
    referenceText: plainText(source.referenceText, pronunciationTaskLimits.referenceText),
    // Never truncate a URL into a different address. The save validator bounds it.
    referenceAudioUrl: typeof source.referenceAudioUrl === 'string' ? source.referenceAudioUrl.trim() : '',
    maxDurationSeconds: Math.max(pronunciationTaskLimits.minDurationSeconds, Math.min(pronunciationTaskLimits.maxDurationSeconds, duration)),
  };
}

export function isPronunciationAudioUrlValid(value: string): boolean {
  if (!value) return true;
  // URL parsing alone also accepts backslashes and strips some control characters.
  // eslint-disable-next-line no-control-regex
  if (value.length > pronunciationTaskLimits.referenceAudioUrl || !/^https:\/\//i.test(value) || /[\s\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Run before committing a lesson; incomplete blocks remain editable in the sheet. */
export function pronunciationTaskValidationError(value: unknown): string | null {
  const task = normalizePronunciationTask(value);
  if (task.mode === 'scripted' && !task.referenceText) return 'Додайте текст для читання в завданні з вимови.';
  if (task.mode === 'unscripted' && !task.prompt) return 'Додайте завдання для відповіді своїми словами.';
  if (!isPronunciationAudioUrlValid(task.referenceAudioUrl)) return 'Вкажіть HTTPS-посилання на аудіозразок довжиною до 2048 символів або приберіть його.';
  return null;
}

/** Only the active mode's reference belongs in the persisted exercise contract. */
export function pronunciationTaskForSave(value: unknown): PronunciationTaskData {
  const task = normalizePronunciationTask(value);
  return task.mode === 'unscripted' ? { ...task, referenceText: '' } : task;
}
