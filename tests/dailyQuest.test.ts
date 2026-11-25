import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeDailyKind, dailyKinds, dailyPayload, emptyDaily } from '../src/lib/dailyQuest.ts';
test('daily builder validates supported conditions, rewards, and whole targets', () => {
  const draft = { ...emptyDaily(), title: '  Два уроки  ', is_active: true };
  assert.deepEqual(dailyPayload(draft), { title: 'Два уроки', description: '', kind: 'lessons_completed', target: 2, reward_points: 20, course_id: null, is_active: true });
  for (const invalid of [{ target: '2.5' }, { target: '0' }, { reward_points: '-1' }, { reward_points: '61' }, { course_id: 'bogus' }, { kind: 'unknown' }, { title: ' ' }]) {
    assert.throws(() => dailyPayload({ ...draft, ...invalid } as typeof draft));
  }
});

const courseId = '1381b138-8036-4d53-90d9-565e8654d2fd';

test('all daily conditions accept their own limits and course scope', () => {
  const draft = { ...emptyDaily(), title: 'Дейлік' };
  const expected = {
    lessons_completed: { max: 10, allowsCourse: true },
    courses_practiced: { max: 3, allowsCourse: false },
    course_finished: { max: 1, allowsCourse: true },
    quiz_lessons_checked: { max: 10, allowsCourse: true },
    cards_reviewed: { max: 100, allowsCourse: true },
    cards_known: { max: 100, allowsCourse: true },
    weak_words: { max: 50, allowsCourse: true },
    weak_words_known: { max: 50, allowsCourse: true },
    personal_cards_reviewed: { max: 100, allowsCourse: false },
    personal_words_added: { max: 30, allowsCourse: false },
  };
  assert.deepEqual(dailyKinds.map(kind => kind.value).sort(), Object.keys(expected).sort());
  for (const { value: kind } of dailyKinds) {
    const { max, allowsCourse } = expected[kind];
    const atLimit = { ...draft, kind, target: String(max) };
    assert.equal(dailyPayload(atLimit).target, max, kind);
    assert.throws(() => dailyPayload({ ...atLimit, target: String(max + 1) }), /Вкажи цілу ціль/, kind);
    const scoped = { ...atLimit, course_id: courseId };
    if (allowsCourse) assert.equal(dailyPayload(scoped).course_id, courseId, kind);
    else assert.throws(() => dailyPayload(scoped), /Прибери обмеження за курсом/i, kind);
  }
});

test('changing the condition resets the target and only keeps a compatible course', () => {
  const draft = { ...emptyDaily(), title: 'Дейлік', target: '8', course_id: courseId };
  const finishCourse = changeDailyKind(draft, 'course_finished');
  assert.equal(finishCourse.target, '1');
  assert.equal(finishCourse.course_id, courseId);
  for (const kind of ['courses_practiced', 'personal_cards_reviewed', 'personal_words_added'] as const) {
    const changed = changeDailyKind(draft, kind);
    assert.equal(changed.course_id, '');
    assert.equal(dailyPayload(changed).course_id, null);
  }
});
