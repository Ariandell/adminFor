import assert from 'node:assert/strict';
import test from 'node:test';
import { achievementActions, achievementScopes, formatAchievementRule, getAchievementAction } from '../src/lib/achievementRules.ts';

test('offers card actions independently from their target number', () => {
  const action = getAchievementAction('cards', 'cards_viewed');
  assert.equal(action?.unit, 'карток');
  assert.equal(formatAchievementRule('cards', 'cards_viewed', 50), 'Прогорне 50 карток');
});

test('keeps audio inside lesson achievements', () => {
  assert.equal(formatAchievementRule('lessons', 'audio_minutes', 20), 'Прослухає аудіо в уроках загалом 20 хвилин');
});

test('every scope has at least one selectable action', () => {
  for (const actions of Object.values(achievementActions)) assert.ok(actions.length > 0);
});

test('uses only real product domains as scopes', () => {
  assert.deepEqual(achievementScopes.map(scope => scope.value), ['app', 'courses', 'lessons', 'cards']);
});

test('formats a rule for a specific course', () => {
  assert.equal(
    formatAchievementRule('courses', 'course_lessons_completed', 5, 'English A1'),
    'Пройде 5 уроків у курсі «English A1»',
  );
});
