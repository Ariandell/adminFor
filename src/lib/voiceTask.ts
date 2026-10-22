import type { OutputBlockData } from '@editorjs/editorjs';
import { normalizePronunciationTask, pronunciationTaskForSave, type PronunciationLocale, type PronunciationMode } from './pronunciationTask.ts';
import { normalizeSpeakingTask } from './speakingTask.ts';

export type VoiceEvaluation = 'content' | 'pronunciation';

/** One authoring draft; persisted lessons still use the supported assessment contracts. */
export interface VoiceTaskData {
  title: string;
  prompt: string;
  criteria: string;
  targetWords: string[];
  maxDurationSeconds: number;
  mode: PronunciationMode;
  evaluation: VoiceEvaluation;
  locale: PronunciationLocale;
  referenceText: string;
  referenceAudioUrl: string;
}

/** Keep inactive fields so changing mode or assessment never discards an author's draft. */
export function normalizeVoiceTask(value: unknown): VoiceTaskData {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const speaking = normalizeSpeakingTask(source);
  const pronunciation = normalizePronunciationTask(source);
  return {
    // Older speaking tasks can intentionally have no title.
    title: typeof source.title === 'string' ? speaking.title : 'Усне завдання',
    prompt: speaking.prompt,
    criteria: speaking.criteria,
    targetWords: speaking.targetWords,
    maxDurationSeconds: speaking.maxDurationSeconds,
    mode: pronunciation.mode,
    evaluation: source.evaluation === 'content' ? 'content' : 'pronunciation',
    locale: pronunciation.locale,
    referenceText: pronunciation.referenceText,
    referenceAudioUrl: pronunciation.referenceAudioUrl,
  };
}

/** Adapt only known legacy tasks at the editor boundary, preserving IDs and block metadata. */
export function voiceEditorBlocks(blocks: OutputBlockData[]): OutputBlockData[] {
  return blocks.map(block => {
    if (block.type === 'speaking') {
      return {
        ...block,
        type: 'voice',
        data: normalizeVoiceTask({ ...normalizeSpeakingTask(block.data), mode: 'unscripted', evaluation: 'content' }),
      };
    }
    if (block.type === 'pronunciation') {
      return {
        ...block,
        type: 'voice',
        data: normalizeVoiceTask({ ...normalizePronunciationTask(block.data), evaluation: 'pronunciation' }),
      };
    }
    return block;
  });
}

/** Never persist the editor-only type: current Flutter and APIs select an exact block type. */
export function voiceBlocksForSave(blocks: OutputBlockData[]): OutputBlockData[] {
  return blocks.map(block => {
    if (block.type !== 'voice') return block;
    const task = normalizeVoiceTask(block.data);
    const pronunciation = task.mode === 'scripted' || task.evaluation === 'pronunciation';
    return {
      ...block,
      type: pronunciation ? 'pronunciation' : 'speaking',
      data: pronunciation ? pronunciationTaskForSave(task) : normalizeSpeakingTask(task),
    };
  });
}
