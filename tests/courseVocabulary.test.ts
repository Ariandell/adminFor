import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCourseVocabulary, buildVocabularyText, fetchAllRows, filterVocabularyEntries,
  UNASSIGNED_COURSE_ID, vocabularyFileName,
} from '../src/lib/courseVocabulary.ts';
import type { VocabularyCard } from '../src/lib/courseVocabulary.ts';

const courses = [
  { id: 'course-a', title: 'First course', level: 'A1' },
  { id: 'course-b', title: 'Second course', level: 'A1' },
  { id: 'course-empty', title: 'Empty course' },
];
const lessons = [
  { id: 'lesson-a1', course_id: 'course-a', title: 'Travel' },
  { id: 'lesson-a2', course_id: 'course-a', title: 'At home' },
  { id: 'lesson-b', course_id: 'course-b', title: 'Basics' },
  { id: 'lesson-orphan', course_id: 'deleted-course', title: 'Old lesson' },
];
const card = (id: string, original_word: string, lesson_id: string | null, extra: Partial<VocabularyCard> = {}): VocabularyCard => ({ id, original_word, lesson_id, ...extra });

test('maps cards only through their lesson and retains empty courses', () => {
  const result = buildCourseVocabulary(courses, lessons, [
    card('a', 'hello', 'lesson-a1'), card('b', 'world', 'lesson-b'),
    card('c', 'unassigned', null), card('d', 'missing lesson', 'deleted-lesson'),
    card('e', 'missing course', 'lesson-orphan'),
  ]);
  assert.deepEqual(result.courses.map(course => [course.id, course.cardCount]), [
    ['course-a', 1], ['course-b', 1], ['course-empty', 0],
  ]);
  assert.equal(result.unassigned.id, UNASSIGNED_COURSE_ID);
  assert.equal(result.unassigned.cardCount, 3);
  assert.deepEqual(result.unassigned.entries.find(entry => entry.word === 'missing course')?.origins, [{ lessonId: 'lesson-orphan', title: 'Old lesson' }]);
});

test('deduplicates words across lessons while preserving translations, pronunciation and origins', () => {
  const rows = [
    card('1', ' Book (бук) ', 'lesson-a1', { translation: 'книга', transcription: 'бук' }),
    card('2', 'book', 'lesson-a2', { translation: 'бронювати' }),
    card('3', 'BOOK', 'lesson-a1', { translation: 'Книга' }),
  ];
  const result = buildCourseVocabulary(courses, lessons, [...rows, rows[0]]).courses[0];
  assert.equal(result.cardCount, 3);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].cardCount, 3);
  assert.deepEqual(result.entries[0].english, ['Book (бук)', 'book']);
  assert.deepEqual(result.entries[0].translations, ['книга', 'бронювати']);
  assert.deepEqual(result.entries[0].transcriptions, ['бук']);
  assert.deepEqual(result.entries[0].origins.map(origin => origin.lessonId), ['lesson-a1', 'lesson-a2']);
});

test('keeps all irregular forms and distinct variants for the same infinitive', () => {
  const result = buildCourseVocabulary(courses, lessons, [
    card('1', 'dream', 'lesson-a1', { card_type: 'irregular_verb', infinitive: 'dream', past_simple: 'dreamt', past_participle: 'dreamt', translation: 'снитися' }),
    card('2', 'dream', 'lesson-a2', { card_type: 'irregular_verb', infinitive: 'dream', past_simple: 'dreamed', past_participle: 'dreamed', translation: 'мріяти' }),
    card('3', 'go (ґоу)', 'lesson-a1', { infinitive: 'go (ґоу)', past_simple: 'went (вент)', past_participle: 'gone (ґон)', translation: 'йти' }),
  ]).courses[0];
  assert.deepEqual(result.entries[0].english, ['dream – dreamt – dreamt', 'dream – dreamed – dreamed']);
  const text = buildVocabularyText(result.title, result.entries);
  assert.match(text, /dream – dreamt – dreamt \/ dream – dreamed – dreamed — снитися; мріяти/);
  assert.match(text, /go \(ґоу\) – went \(вент\) – gone \(ґон\) — йти/);
});

test('search covers translations, verb forms, pronunciation and lesson names; lesson filter is scoped', () => {
  const entries = buildCourseVocabulary(courses, lessons, [
    card('1', 'go', 'lesson-a1', { infinitive: 'go', past_simple: 'went', past_participle: 'gone', translation: 'йти' }),
    card('2', 'sleep', 'lesson-a2', { translation: 'спати', transcription: 'сліп' }),
  ]).courses[0].entries;
  assert.equal(filterVocabularyEntries(entries, ' WENT ')[0].word, 'go');
  assert.equal(filterVocabularyEntries(entries, 'СПАТИ')[0].word, 'sleep');
  assert.equal(filterVocabularyEntries(entries, 'сліп')[0].word, 'sleep');
  assert.equal(filterVocabularyEntries(entries, 'travel')[0].word, 'go');
  assert.deepEqual(filterVocabularyEntries(entries, '', 'lesson-a2').map(entry => entry.word), ['sleep']);
  assert.deepEqual(filterVocabularyEntries(entries, 'went', 'lesson-a2'), []);
  assert.equal(entries.length, 2, 'filtering must not mutate the full export source');
  const text = buildVocabularyText('Entire course', entries);
  assert.match(text, /go – went – gone/);
  assert.match(text, /sleep \[сліп\] — спати/);
});

test('export normalizes line breaks and keeps words without a translation', () => {
  const entries = buildCourseVocabulary(courses, lessons, [card('1', '  take\n a break  ', 'lesson-a1')]).courses[0].entries;
  assert.equal(buildVocabularyText('  First\n course ', entries), 'First course\n\ntake a break');
  assert.equal(vocabularyFileName(' Travel: <A1> / test? '), 'Travel- -A1- - test--words.txt');
});

test('fetchAllRows reads more than the default 1000-row limit', async () => {
  const source = Array.from({ length: 2503 }, (_, id) => ({ id }));
  const ranges: number[][] = [];
  const progress: number[] = [];
  const result = await fetchAllRows(async (from, to) => {
    ranges.push([from, to]);
    return { data: source.slice(from, to + 1), error: null };
  }, count => progress.push(count));
  assert.deepEqual(result, source);
  assert.deepEqual(ranges, [[0, 999], [1000, 1999], [2000, 2999], [2503, 3502]]);
  assert.deepEqual(progress, [1000, 2000, 2503]);
});

test('fetchAllRows verifies completion at an exact page boundary', async () => {
  const source = Array.from({ length: 1000 }, (_, id) => id);
  const offsets: number[] = [];
  const result = await fetchAllRows(async (from, to) => {
    offsets.push(from);
    return { data: source.slice(from, to + 1), error: null };
  });
  assert.equal(result.length, 1000);
  assert.deepEqual(offsets, [0, 1000]);
});

test('fetchAllRows respects a server cap lower than the requested range without skipping rows', async () => {
  const source = Array.from({ length: 1201 }, (_, id) => id);
  const offsets: number[] = [];
  const result = await fetchAllRows(async (from, to) => {
    offsets.push(from);
    return { data: source.slice(from, Math.min(to + 1, from + 400)), error: null };
  });
  assert.deepEqual(result, source);
  assert.deepEqual(offsets, [0, 400, 800, 1200, 1201]);
});

test('a later page error rejects instead of returning a partial list', async () => {
  await assert.rejects(fetchAllRows(async from => from === 0
    ? { data: ['first row'], error: null }
    : { data: null, error: { message: 'Page failed' } }), /Page failed/);
});

test('all fetched cards remain in course aggregation past 1000 rows', async () => {
  const source = Array.from({ length: 1105 }, (_, id) => card(String(id), `word ${id}`, 'lesson-a1'));
  const rows = await fetchAllRows(async (from, to) => ({ data: source.slice(from, to + 1), error: null }));
  const result = buildCourseVocabulary(courses, lessons, rows).courses[0];
  assert.equal(result.cardCount, 1105);
  assert.equal(result.entries.length, 1105);
  assert.match(buildVocabularyText(result.title, result.entries), /word 1104/);
});
