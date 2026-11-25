import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyPayload, emptyDaily } from '../src/lib/dailyQuest.ts';
test('daily builder validates supported conditions, rewards, and whole targets', () => {
  const draft = { ...emptyDaily(), title: '  Два уроки  ', is_active: true };
  assert.deepEqual(dailyPayload(draft), { title: 'Два уроки', description: '', kind: 'lessons_completed', target: 2, reward_points: 20, course_id: null, is_active: true });
  for (const invalid of [{ target: '2.5' }, { target: '0' }, { reward_points: '-1' }, { reward_points: '61' }, { course_id: 'bogus' }, { kind: 'unknown' }, { title: ' ' }]) {
    assert.throws(() => dailyPayload({ ...draft, ...invalid } as typeof draft));
  }
  assert.equal(dailyPayload({ ...draft, kind: 'weak_words', target: '50' }).target, 50);
  assert.throws(() => dailyPayload({ ...draft, kind: 'weak_words', target: '51' }));
});
