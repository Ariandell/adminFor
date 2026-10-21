import { normalizeCardWord } from './cardText.ts';

export const UNASSIGNED_COURSE_ID = '__unassigned__';

export type VocabularyCourse = { id: string; title: string | null; level?: string | null };
export type VocabularyLesson = { id: string; course_id: string | null; title: string | null };
export type VocabularyCard = {
  id: string;
  lesson_id?: string | null;
  original_word?: string | null;
  translation?: string | null;
  card_type?: string | null;
  infinitive?: string | null;
  past_simple?: string | null;
  past_participle?: string | null;
  transcription?: string | null;
};
export type VocabularyOrigin = { lessonId: string; title: string };
export type VocabularyEntry = {
  key: string;
  word: string;
  english: string[];
  translations: string[];
  transcriptions: string[];
  origins: VocabularyOrigin[];
  cardCount: number;
};
export type CourseVocabulary = {
  id: string;
  title: string;
  level?: string | null;
  lessons: VocabularyLesson[];
  entries: VocabularyEntry[];
  cardCount: number;
};

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/** Read until an empty page, including when the server caps rows below pageSize. */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  onProgress?: (rowCount: number) => void,
  pageSize = 1000,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Invalid page size');
  const rows: T[] = [];
  while (true) {
    const { data, error } = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) return rows;
    rows.push(...data);
    onProgress?.(rows.length);
  }
}

const clean = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();
const folded = (value: string) => clean(value).toLocaleLowerCase();

function addVariant(values: string[], value: string) {
  if (value && !values.some(existing => folded(existing) === folded(value))) values.push(value);
}

export function cardEnglish(card: VocabularyCard): string {
  if (card.card_type === 'irregular_verb' || card.infinitive || card.past_simple || card.past_participle) {
    return [clean(card.infinitive) || clean(card.original_word) || '—', clean(card.past_simple) || '—', clean(card.past_participle) || '—'].join(' – ');
  }
  return clean(card.original_word);
}

/** Membership comes only from a saved lesson's course, never a card's level. */
export function buildCourseVocabulary(courses: VocabularyCourse[], lessons: VocabularyLesson[], cards: VocabularyCard[]) {
  const lessonById = new Map(lessons.map(lesson => [lesson.id, lesson]));
  const buckets = courses.map<CourseVocabulary>(course => ({
    id: course.id,
    title: clean(course.title) || 'Курс без назви',
    level: course.level,
    lessons: lessons.filter(lesson => lesson.course_id === course.id),
    entries: [],
    cardCount: 0,
  }));
  const unassigned: CourseVocabulary = { id: UNASSIGNED_COURSE_ID, title: 'Без прив’язки до курсу', lessons: [], entries: [], cardCount: 0 };
  const bucketById = new Map(buckets.map(bucket => [bucket.id, bucket]));
  const entriesByBucket = new Map<string, Map<string, VocabularyEntry>>();
  // Card ids are unique in storage. Avoid counting a repeated fetched row twice.
  const seenCards = new Set<string>();
  for (const card of cards) {
    if (seenCards.has(card.id)) continue;
    seenCards.add(card.id);
    const lesson = card.lesson_id ? lessonById.get(card.lesson_id) : undefined;
    const bucket = (lesson?.course_id ? bucketById.get(lesson.course_id) : undefined) || unassigned;
    bucket.cardCount++;
    const entries = entriesByBucket.get(bucket.id) || new Map<string, VocabularyEntry>();
    entriesByBucket.set(bucket.id, entries);
    const word = clean(card.infinitive) || clean(card.original_word);
    const key = normalizeCardWord(word) || `__card__${card.id}`;
    const entry = entries.get(key) || { key, word, english: [], translations: [], transcriptions: [], origins: [], cardCount: 0 };
    entry.cardCount++;
    addVariant(entry.english, cardEnglish(card));
    addVariant(entry.translations, clean(card.translation));
    addVariant(entry.transcriptions, clean(card.transcription));
    if (lesson && !entry.origins.some(origin => origin.lessonId === lesson.id)) {
      entry.origins.push({ lessonId: lesson.id, title: clean(lesson.title) || 'Урок без назви' });
    }
    entries.set(key, entry);
  }
  for (const bucket of [...buckets, unassigned]) {
    bucket.entries = [...(entriesByBucket.get(bucket.id)?.values() || [])]
      .sort((a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }));
  }
  return { courses: buckets, unassigned };
}

export function filterVocabularyEntries(entries: VocabularyEntry[], query: string, lessonId = '') {
  const needle = folded(query);
  return entries.filter(entry => (!lessonId || entry.origins.some(origin => origin.lessonId === lessonId)) &&
    (!needle || folded([...entry.english, ...entry.translations, ...entry.transcriptions, ...entry.origins.map(origin => origin.title)].join(' ')).includes(needle)));
}

export function buildVocabularyText(title: string, entries: VocabularyEntry[]): string {
  const lines = entries.map(entry => {
    const english = entry.english.join(' / ') || '(без слова)';
    const transcriptions = entry.transcriptions.filter(value => !folded(english).includes(folded(value)));
    return `${english}${transcriptions.length ? ` [${transcriptions.join(' / ')}]` : ''}${entry.translations.length ? ` — ${entry.translations.join('; ')}` : ''}`;
  });
  return `${clean(title)}\n\n${lines.join('\n')}`;
}

export function vocabularyFileName(title: string): string {
  const safeTitle = Array.from(clean(title), character => character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? '-' : character).join('').replace(/[. ]+$/g, '');
  return `${safeTitle || 'vocabulary'}-words.txt`;
}
