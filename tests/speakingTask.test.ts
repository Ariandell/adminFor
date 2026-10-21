import assert from 'node:assert/strict';
import test from 'node:test';
import { isSpeakingTargetWordValid, normalizeSpeakingTask, speakingTaskValidationError } from '../src/lib/speakingTask.ts';
import { contentWithLessonSheet, lessonSheetBlocks } from '../src/lib/lessonSheet.ts';
import { editorContentChanged } from '../src/lib/editorHistory.ts';

test('a speaking prompt alone is valid and optional fields receive safe defaults', () => {
  const task = normalizeSpeakingTask({ prompt: '  Recount your day.  ' });
  assert.deepEqual(task, { title: '', prompt: 'Recount your day.', criteria: '', targetWords: [], maxDurationSeconds: 60 });
  assert.equal(speakingTaskValidationError(task), null);
  for (const value of [undefined, null, [], 1, 'prompt', { prompt: {} }, { prompt: '  \n  ' }, { prompt: '<b></b>' }]) {
    assert.ok(speakingTaskValidationError(value));
  }
});

test('imported text remains plain text and all speaking fields are bounded', () => {
  const task = normalizeSpeakingTask({
    title: `<b>${'a'.repeat(150)}</b>`,
    prompt: `<!-- hidden --><img src=x onerror=alert(1)>${'p'.repeat(2100)}\u0000`,
    criteria: 'c'.repeat(2100),
    targetWords: [null, ' usually ', 'USUALLY', 4, '<b>have\n breakfast</b>', ...Array.from({ length: 40 }, (_, index) => `${index}${'w'.repeat(90)}`)],
    maxDurationSeconds: Infinity,
  });
  assert.equal(task.title, 'a'.repeat(120));
  assert.equal(task.prompt, 'p'.repeat(2000));
  assert.equal(task.criteria.length, 2000);
  assert.equal(task.targetWords.length, 30);
  assert.deepEqual(task.targetWords.slice(0, 2), ['usually', 'have breakfast']);
  assert.ok(task.targetWords.every(word => word.length <= 80));
  assert.equal(task.maxDurationSeconds, 60);
  assert.equal(normalizeSpeakingTask({ prompt: 'Use a number < 5.' }).prompt, 'Use a number < 5.');
});

test('recording duration is an integer from 15 to 120 seconds', () => {
  for (const [input, expected] of [[-5, 15], [15, 15], [72.6, 73], [121, 120], [NaN, 60], ['90', 60]]) {
    assert.equal(normalizeSpeakingTask({ maxDurationSeconds: input }).maxDurationSeconds, expected);
  }
});

test('target words match the speaking evaluation API English word and phrase constraints', () => {
  for (const word of ['wake up', "don't", 'it’s', 'well-known', ' Usually ']) {
    assert.equal(isSpeakingTargetWordValid(word), true, word);
    assert.equal(speakingTaskValidationError({ prompt: 'Describe your day.', targetWords: [word] }), null);
  }
  for (const word of ['ранок', '123', 'wake/up', 'hello!', '-word']) {
    assert.equal(isSpeakingTargetWordValid(word), false, word);
    assert.ok(speakingTaskValidationError({ prompt: 'Describe your day.', targetWords: [word] }));
  }
});

test('full lesson JSON and sheet saves preserve speaking blocks beside older blocks', () => {
  const task = normalizeSpeakingTask({ title: 'My day', prompt: 'Recount your day.', criteria: 'Use Past Simple.', targetWords: ['visited'], maxDurationSeconds: 90 });
  const input = JSON.parse(JSON.stringify({ introduction: { story: 'Welcome' }, blocks: [
    { id: 'text', type: 'paragraph', data: { text: 'Hello' } },
    { id: 'speaking', type: 'speaking', data: task },
    { id: 'old', type: 'customLegacyBlock', data: { keep: true } },
  ] }));
  const saved = contentWithLessonSheet(input, lessonSheetBlocks(input));
  assert.deepEqual(saved.blocks, input.blocks);
  assert.deepEqual((saved as typeof input).introduction, input.introduction);
  assert.equal(editorContentChanged(saved.blocks, saved.blocks.map(block => block.type === 'speaking' ? { ...block, data: { ...task, prompt: 'Describe tomorrow.' } } : block)), true);
  assert.deepEqual(normalizeSpeakingTask(task), task);
});
