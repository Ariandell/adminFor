import { useState } from 'react';
import { Mic, Plus, Trash2, X } from 'lucide-react';
import { isSpeakingTargetWordValid, speakingTaskLimits, type SpeakingTaskData } from '../../lib/speakingTask';

interface Props {
  data: SpeakingTaskData;
  onChange: (data: SpeakingTaskData) => void;
  onDelete: () => void;
}

const fieldClass = 'w-full rounded-lg border border-lavender-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-lavender-300';
const labelClass = 'mb-1.5 block text-sm font-semibold text-ink-600';

export function SpeakingTaskForm({ data, onChange, onDelete }: Props) {
  const [draft, setDraft] = useState(data);
  const update = (next: SpeakingTaskData) => {
    setDraft(next);
    onChange(next);
  };
  const durations = [...new Set([15, 30, 45, 60, 90, 120, draft.maxDurationSeconds])].sort((a, b) => a - b);

  return <section className="overflow-hidden rounded-2xl border border-lavender-200 bg-lavender-50 shadow-cozy-sm" aria-label="Усне завдання">
    <div className="flex items-center justify-between gap-3 border-b border-lavender-200 bg-mint-100 px-5 py-3">
      <div className="flex items-center gap-2 font-bold text-ink"><Mic size={18} /> Усне завдання</div>
      <button type="button" onClick={onDelete} title="Видалити усне завдання" aria-label="Видалити усне завдання" className="rounded-lg p-2 text-ink-400 hover:bg-white/60 hover:text-rose-600"><Trash2 size={16} /></button>
    </div>
    <div className="space-y-4 p-5">
      <p className="text-sm text-ink-500">Учень запише відповідь англійською. Перевірка врахує зміст завдання, граматику та слова для вживання.</p>
      <label className="block">
        <span className={labelClass}>Назва · необов’язково</span>
        <input type="text" maxLength={speakingTaskLimits.title} value={draft.title} onChange={event => update({ ...draft, title: event.target.value })} className={fieldClass} placeholder="Мій день" />
      </label>
      <label className="block">
        <span className={labelClass}>Інструкція для учня</span>
        <textarea required maxLength={speakingTaskLimits.prompt} value={draft.prompt} onChange={event => update({ ...draft, prompt: event.target.value })} rows={4} className={`${fieldClass} resize-y`} placeholder="Розкажіть англійською, як пройшов ваш день. Назвіть щонайменше три події." />
        <span className="mt-1 block text-xs text-ink-400">{draft.prompt.length}/{speakingTaskLimits.prompt}</span>
      </label>
      <label className="block">
        <span className={labelClass}>Час для відповіді</span>
        <select value={draft.maxDurationSeconds} onChange={event => update({ ...draft, maxDurationSeconds: Number(event.target.value) })} className={fieldClass}>
          {durations.map(duration => <option key={duration} value={duration}>До {duration} секунд</option>)}
        </select>
      </label>
      <label className="block">
        <span className={labelClass}>Критерії перевірки · необов’язково</span>
        <textarea maxLength={speakingTaskLimits.criteria} value={draft.criteria} onChange={event => update({ ...draft, criteria: event.target.value })} rows={3} className={`${fieldClass} resize-y`} placeholder="Наприклад: відповідь стосується сьогоднішнього дня, учень використовує Past Simple." />
        <span className="mt-1 block text-xs text-ink-400">Додаткові вказівки для перевірки відповіді · {draft.criteria.length}/{speakingTaskLimits.criteria}</span>
      </label>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={labelClass}>Слова для вживання · необов’язково</span>
          <button type="button" disabled={draft.targetWords.length >= speakingTaskLimits.targetWords} onClick={() => update({ ...draft, targetWords: [...draft.targetWords, ''] })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-lavender-700 hover:bg-lavender-100 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={15} /> Додати слово</button>
        </div>
        <p className="mb-2 text-xs text-ink-400">До {speakingTaskLimits.targetWords} англійських слів або фраз, до {speakingTaskLimits.targetWord} символів кожне. Учень побачить цей список.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {draft.targetWords.map((word, index) => <div key={index} className="flex items-center gap-1">
            <input type="text" maxLength={speakingTaskLimits.targetWord} aria-label={`Слово або фраза ${index + 1}`} aria-invalid={!!word.trim() && !isSpeakingTargetWordValid(word)} value={word} onChange={event => update({ ...draft, targetWords: draft.targetWords.map((current, currentIndex) => currentIndex === index ? event.target.value : current) })} className={fieldClass} placeholder="Наприклад: usually" />
            <button type="button" onClick={() => update({ ...draft, targetWords: draft.targetWords.filter((_, currentIndex) => currentIndex !== index) })} title={`Видалити слово ${index + 1}`} aria-label={`Видалити слово ${index + 1}`} className="rounded-lg p-2 text-ink-400 hover:bg-white hover:text-rose-600"><X size={15} /></button>
          </div>)}
        </div>
        {draft.targetWords.some(word => !!word.trim() && !isSpeakingTargetWordValid(word)) && <p role="alert" className="mt-2 text-xs text-rose-700">Використовуйте англійські літери, апострофи, дефіси та пробіли.</p>}
      </div>
    </div>
  </section>;
}
