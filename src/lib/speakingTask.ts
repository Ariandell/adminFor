export interface SpeakingTaskData {
  title: string;
  prompt: string;
  criteria: string;
  targetWords: string[];
  maxDurationSeconds: number;
}

export const speakingTaskLimits = {
  title: 120,
  prompt: 2000,
  criteria: 2000,
  targetWords: 30,
  targetWord: 80,
  minDurationSeconds: 15,
  maxDurationSeconds: 120,
  defaultDurationSeconds: 60,
} as const;

/** Speaking tasks contain plain text; imported HTML is never rendered as markup. */
function plainText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\r\n?/g, '\n')
    // Strip non-printing controls while retaining tabs and line breaks.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
}

/** Safe defaults also let older lessons omit every optional speaking field. */
export function normalizeSpeakingTask(value: unknown): SpeakingTaskData {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const targetWords: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(source.targetWords)) {
    for (const item of source.targetWords) {
      const word = plainText(item, speakingTaskLimits.targetWord).replace(/\s+/g, ' ');
      const key = word.toLowerCase();
      if (!word || seen.has(key)) continue;
      seen.add(key);
      targetWords.push(word);
      if (targetWords.length === speakingTaskLimits.targetWords) break;
    }
  }
  const duration = typeof source.maxDurationSeconds === 'number' && Number.isFinite(source.maxDurationSeconds)
    ? Math.round(source.maxDurationSeconds)
    : speakingTaskLimits.defaultDurationSeconds;
  return {
    title: plainText(source.title, speakingTaskLimits.title),
    prompt: plainText(source.prompt, speakingTaskLimits.prompt),
    criteria: plainText(source.criteria, speakingTaskLimits.criteria),
    targetWords,
    maxDurationSeconds: Math.max(speakingTaskLimits.minDurationSeconds, Math.min(speakingTaskLimits.maxDurationSeconds, duration)),
  };
}

export function isSpeakingTargetWordValid(value: string): boolean {
  return /^[A-Za-z][A-Za-z'’ -]*$/.test(value.trim());
}

/** Keep incomplete blocks in Editor.js output so authors can fix them before saving. */
export function speakingTaskValidationError(value: unknown): string | null {
  const task = normalizeSpeakingTask(value);
  if (!task.prompt) return 'Додайте інструкцію до кожного усного завдання.';
  if (task.targetWords.some(word => !isSpeakingTargetWordValid(word))) {
    return 'У словах для усного завдання використовуйте англійські літери, апострофи, дефіси та пробіли.';
  }
  return null;
}
