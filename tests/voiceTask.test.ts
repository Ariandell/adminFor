import assert from 'node:assert/strict';
import test from 'node:test';
import type { OutputBlockData } from '@editorjs/editorjs';
import { normalizeSpeakingTask } from '../src/lib/speakingTask.ts';
import { normalizePronunciationTask } from '../src/lib/pronunciationTask.ts';
import { normalizeVoiceTask, voiceBlocksForSave, voiceEditorBlocks } from '../src/lib/voiceTask.ts';

test('a new voice draft defaults to reading while explicit empty legacy titles remain empty', () => {
  assert.deepEqual(normalizeVoiceTask(undefined), {
    title: 'Усне завдання', prompt: '', criteria: '', targetWords: [], maxDurationSeconds: 60,
    mode: 'scripted', evaluation: 'pronunciation', locale: 'en-US', referenceText: '', referenceAudioUrl: '',
  });
  assert.equal(normalizeVoiceTask({ title: '' }).title, '');
  assert.equal(normalizeVoiceTask({ title: '<b> </b>' }).title, '');
  assert.equal(normalizeVoiceTask({ mode: 'scripted', evaluation: 'content' }).evaluation, 'content');
});

test('existing speaking and both pronunciation modes roundtrip without changing type, content or metadata', () => {
  const blocks: OutputBlockData[] = [
    { id: 'talk', type: 'speaking', data: normalizeSpeakingTask({ title: '', prompt: 'Describe your day.', criteria: 'Use Past Simple.', targetWords: ['visited'], maxDurationSeconds: 90 }), tunes: { alignment: 'left' } },
    { id: 'read', type: 'pronunciation', data: normalizePronunciationTask({ title: 'Read aloud', referenceText: 'Good morning.', locale: 'en-GB', referenceAudioUrl: 'https://example.com/read.mp3', maxDurationSeconds: 30 }) },
    { id: 'free', type: 'pronunciation', data: normalizePronunciationTask({ mode: 'unscripted', prompt: 'Describe your room.', referenceText: '' }) },
  ];
  const snapshot = structuredClone(blocks);
  const drafts = voiceEditorBlocks(blocks);
  assert.deepEqual(drafts.map(block => block.type), ['voice', 'voice', 'voice']);
  assert.deepEqual(drafts.map(block => [block.data.mode, block.data.evaluation]), [
    ['unscripted', 'content'], ['scripted', 'pronunciation'], ['unscripted', 'pronunciation'],
  ]);
  assert.deepEqual(voiceBlocksForSave(drafts), snapshot);
  assert.deepEqual(blocks, snapshot, 'adapting must not mutate the loaded lesson');
});

test('unknown and existing nonvoice blocks pass through without normalization or conversion', () => {
  const blocks: OutputBlockData[] = [
    { id: 'text', type: 'paragraph', data: { text: '<b>Keep markup</b>' }, tunes: { custom: true } },
    { id: 'old', type: 'customLegacyBlock', data: { arbitrary: ['keep', 42] } },
    { id: 'stored', type: 'speaking', data: { prompt: 'Keep original data', custom: 'untouched' } },
  ];
  assert.strictEqual(voiceEditorBlocks(blocks)[0], blocks[0]);
  assert.strictEqual(voiceEditorBlocks(blocks)[1], blocks[1]);
  const saved = voiceBlocksForSave(blocks);
  for (let i = 0; i < blocks.length; i++) assert.strictEqual(saved[i], blocks[i]);
});

test('mode and assessment switches retain inactive text, words and audio in the editor draft', () => {
  const original = normalizeVoiceTask({
    prompt: 'Describe your morning.', referenceText: 'I open the window.',
    referenceAudioUrl: 'https://example.com/morning.mp3', criteria: 'Use Present Simple.',
    targetWords: ['usually', 'window'], mode: 'unscripted', evaluation: 'content', locale: 'en-GB',
  });
  const reading = normalizeVoiceTask({ ...original, mode: 'scripted' });
  const pronunciation = normalizeVoiceTask({ ...reading, mode: 'unscripted', evaluation: 'pronunciation' });
  const returned = normalizeVoiceTask({ ...pronunciation, evaluation: 'content' });
  assert.deepEqual(returned, original);
  assert.deepEqual(voiceEditorBlocks([{ id: 'draft', type: 'voice', data: original }])[0].data, original);
});

test('reading always saves to pronunciation, while free answers save the selected supported contract', () => {
  const data = normalizeVoiceTask({
    prompt: 'Describe your day.', referenceText: 'I visited the park.',
    criteria: 'Use Past Simple.', targetWords: ['visited'], evaluation: 'content', locale: 'en-GB',
  });
  const savedReading = voiceBlocksForSave([{ id: 'task', type: 'voice', data }])[0];
  assert.equal(savedReading.type, 'pronunciation');
  assert.equal(savedReading.data.mode, 'scripted');
  assert.equal(savedReading.data.referenceText, 'I visited the park.');
  assert.equal('criteria' in savedReading.data, false);
  const savedContent = voiceBlocksForSave([{ id: 'task', type: 'voice', data: { ...data, mode: 'unscripted' } }])[0];
  assert.equal(savedContent.type, 'speaking');
  assert.equal(savedContent.data.criteria, 'Use Past Simple.');
  assert.deepEqual(savedContent.data.targetWords, ['visited']);
  assert.equal('referenceText' in savedContent.data, false);
  const savedPronunciation = voiceBlocksForSave([{ id: 'task', type: 'voice', data: { ...data, mode: 'unscripted', evaluation: 'pronunciation' } }])[0];
  assert.equal(savedPronunciation.type, 'pronunciation');
  assert.equal(savedPronunciation.data.referenceText, '');
  assert.equal(savedPronunciation.data.prompt, 'Describe your day.');
  assert.equal(savedPronunciation.data.locale, 'en-GB');
  assert.equal(data.referenceText, 'I visited the park.', 'saving may not clear the editor draft');
});

test('mixed lesson adapters preserve block order and stable IDs used by remote assessments', () => {
  const unknown: OutputBlockData = { id: 'before', type: 'custom', data: { retain: true } };
  const block: OutputBlockData = { id: 'voice-id', type: 'voice', data: normalizeVoiceTask({ referenceText: 'Hello.' }), tunes: { alignment: { alignment: 'center' } } };
  const divider: OutputBlockData = { id: 'after', type: 'delimiter', data: {} };
  const saved = voiceBlocksForSave([unknown, block, divider]);
  assert.deepEqual(saved.map(item => item.id), ['before', 'voice-id', 'after']);
  assert.deepEqual(saved.map(item => item.type), ['custom', 'pronunciation', 'delimiter']);
  assert.deepEqual(saved[1].tunes, block.tunes);
  assert.strictEqual(saved[0], unknown);
  assert.strictEqual(saved[2], divider);
});
