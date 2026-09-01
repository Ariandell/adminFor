import assert from 'node:assert/strict';
import test from 'node:test';
import { achievementActions, formatAchievementRule, getAchievementAction } from '../src/lib/achievementRules.ts';

test('offers card actions independently from their target number', () => {
  const action = getAchievementAction('cards', 'cards_viewed');
  assert.equal(action?.unit, 'карток');
  assert.equal(formatAchievementRule('cards', 'cards_viewed', 50), 'Прогорне 50 карток');
});

test('supports cumulative audio time achievements', () => {
  assert.equal(formatAchievementRule('audio', 'audio_minutes', 20), 'Прослухає аудіо загалом 20 хв.');
});

test('every scope has at least one selectable action', () => {
  for (const actions of Object.values(achievementActions)) assert.ok(actions.length > 0);
});
