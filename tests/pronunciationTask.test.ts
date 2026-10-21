import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPronunciationAudioUrlValid,
  normalizePronunciationTask,
  pronunciationTaskForSave,
  pronunciationTaskValidationError,
} from '../src/lib/pronunciationTask.ts';
import { normalizeSpeakingTask } from '../src/lib/speakingTask.ts';
import { contentWithLessonSheet, lessonSheetBlocks } from '../src/lib/lessonSheet.ts';
import { editorContentChanged } from '../src/lib/editorHistory.ts';

test('pronunciation has a versioned, independent contract and safe defaults', () => {
  const task = normalizePronunciationTask(undefined);
  assert.deepEqual(task, {
    version: 1,
    title: 'Тренуємо вимову',
    prompt: '',
    mode: 'scripted',
    locale: 'en-US',
    referenceText: '',
    referenceAudioUrl: '',
    maxDurationSeconds: 60,
  });
  for (const value of [null, [], false, 'text', { mode: 'other', locale: 'fr-FR', version: 99 }]) {
    assert.deepEqual(normalizePronunciationTask(value), task);
  }
  assert.equal(normalizePronunciationTask({ locale: 'en-GB', mode: 'unscripted' }).locale, 'en-GB');
  assert.equal(normalizePronunciationTask({ title: '  ' }).title, 'Тренуємо вимову');
  assert.deepEqual(Object.keys(normalizePronunciationTask({ criteria: 'Do not migrate old speaking fields', targetWords: ['hello'] })), Object.keys(task));
});

test('each mode validates its own required text without imposing grammar or content criteria', () => {
  assert.equal(pronunciationTaskValidationError({ referenceText: 'Hello, world.' }), null);
  assert.equal(pronunciationTaskValidationError({ mode: 'unscripted', prompt: 'Describe your morning.' }), null);
  assert.ok(pronunciationTaskValidationError({ prompt: 'Read aloud.' }));
  assert.ok(pronunciationTaskValidationError({ referenceText: '<b> </b>' }));
  assert.ok(pronunciationTaskValidationError({ mode: 'unscripted', referenceText: 'Inactive reading text.' }));
  assert.ok(pronunciationTaskValidationError({ mode: 'unscripted', prompt: '<b></b>' }));
});

test('switching modes retains both drafts, while final unscripted saves clear only referenceText', () => {
  const reading = normalizePronunciationTask({
    referenceText: 'I open the window every morning.',
    prompt: 'Describe your morning.',
    referenceAudioUrl: 'https://audio.example.com/morning.mp3',
  });
  const answering = normalizePronunciationTask({ ...reading, mode: 'unscripted' });
  assert.equal(answering.referenceText, reading.referenceText);
  assert.deepEqual(normalizePronunciationTask({ ...answering, mode: 'scripted' }), reading);
  const savedAnswering = pronunciationTaskForSave(answering);
  assert.equal(savedAnswering.referenceText, '');
  assert.equal(savedAnswering.prompt, reading.prompt);
  assert.equal(savedAnswering.referenceAudioUrl, reading.referenceAudioUrl);
  assert.equal(answering.referenceText, reading.referenceText, 'canonicalization must not mutate the editor draft');
  assert.deepEqual(pronunciationTaskForSave(reading), reading);
  assert.deepEqual(pronunciationTaskForSave(savedAnswering), savedAnswering);
});

test('imported text is plain text and bounded, while recording duration is a finite integer', () => {
  const task = normalizePronunciationTask({
    title: `<b>${'t'.repeat(121)}</b>`,
    prompt: `<!--hidden-->${'p'.repeat(2001)}\u0000`,
    referenceText: `<img src=x onerror=alert(1)>${'r'.repeat(2001)}`,
    maxDurationSeconds: 72.6,
  });
  assert.equal(task.title, 't'.repeat(120));
  assert.equal(task.prompt, 'p'.repeat(2000));
  assert.equal(task.referenceText, 'r'.repeat(2000));
  assert.equal(task.maxDurationSeconds, 73);
  assert.equal(normalizePronunciationTask({ referenceText: 'Use a number < 5.\r\nA & B.\u0000' }).referenceText, 'Use a number < 5.\nA & B.');
  for (const [input, expected] of [[-1, 15], [15, 15], [120, 120], [999, 120], [Infinity, 60], [NaN, 60], ['90', 60]]) {
    assert.equal(normalizePronunciationTask({ maxDurationSeconds: input }).maxDurationSeconds, expected);
  }
});

test('optional reference audio accepts bounded HTTPS URLs and never rewrites an invalid URL', () => {
  for (const url of ['', 'https://audio.example.com/a.mp3', 'HTTPS://audio.example.com/clip?token=abc&x=2']) {
    assert.equal(isPronunciationAudioUrlValid(url), true, url);
    assert.equal(pronunciationTaskValidationError({ referenceText: 'Hello', referenceAudioUrl: url }), null);
  }
  const maxUrl = `https://audio.example.com/${'x'.repeat(2048 - 'https://audio.example.com/'.length)}`;
  assert.equal(isPronunciationAudioUrlValid(maxUrl), true);
  for (const url of [
    'http://audio.example.com/a.mp3', '//audio.example.com/a.mp3', '/audio/a.mp3',
    'javascript:alert(1)', 'data:audio/wav;base64,AAAA', 'https://',
    'https://user:password@audio.example.com/a.mp3', 'https://audio.example.com/a b.mp3',
    'https://audio.example.com/a\u0000.mp3', 'https:\\audio.example.com\\a.mp3', `${maxUrl}x`,
  ]) {
    assert.equal(isPronunciationAudioUrlValid(url), false, url);
    assert.ok(pronunciationTaskValidationError({ referenceText: 'Hello', referenceAudioUrl: url }), url);
    assert.equal(normalizePronunciationTask({ referenceAudioUrl: url }).referenceAudioUrl, url, 'do not silently truncate or sanitize an address into another file');
  }
  assert.equal(normalizePronunciationTask({ referenceAudioUrl: '  https://audio.example.com/a.mp3  ' }).referenceAudioUrl, 'https://audio.example.com/a.mp3');
});

test('mixed lessons preserve legacy speaking and unknown blocks while pronunciation changes participate in history', () => {
  const speaking = normalizeSpeakingTask({ prompt: 'Describe your day.', criteria: 'Use Past Simple.', targetWords: ['visited'] });
  const pronunciation = normalizePronunciationTask({ referenceText: 'I visited the park.', locale: 'en-GB' });
  const input = JSON.parse(JSON.stringify({ introduction: { story: 'Welcome' }, blocks: [
    { id: 'speaking', type: 'speaking', data: speaking },
    { id: 'pronunciation', type: 'pronunciation', data: pronunciation },
    { id: 'legacy', type: 'customLegacyBlock', data: { keep: true } },
  ] }));
  const saved = contentWithLessonSheet(input, lessonSheetBlocks(input).map(block => block.type === 'pronunciation'
    ? { ...block, data: pronunciationTaskForSave(block.data) }
    : block));
  assert.deepEqual(saved.blocks, input.blocks);
  assert.deepEqual(saved.introduction, input.introduction);
  assert.deepEqual(saved.blocks[0].data, speaking);
  const changed = saved.blocks.map(block => block.type === 'pronunciation'
    ? { ...block, data: { ...pronunciation, locale: 'en-US' } }
    : block);
  assert.equal(editorContentChanged(saved.blocks, changed), true);
  assert.equal(editorContentChanged(saved.blocks, JSON.parse(JSON.stringify(saved.blocks))), false);
});
