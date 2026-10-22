import { useEffect, useRef, useState } from 'react';
import { Mic, Plus, Trash2, Upload, X } from 'lucide-react';
import { isPronunciationAudioUrlValid, pronunciationTaskLimits } from '../../lib/pronunciationTask';
import { isSpeakingTargetWordValid, speakingTaskLimits } from '../../lib/speakingTask';
import type { VoiceTaskData } from '../../lib/voiceTask';
import { uploadAudio } from './r2Upload';

interface Props {
  data: VoiceTaskData;
  onChange: (data: VoiceTaskData) => void;
  onUploadingChange: (uploading: boolean) => void;
  onDelete: () => void;
}

const fieldClass = 'w-full rounded-lg border border-lavender-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-lavender-300 disabled:opacity-60';
const labelClass = 'mb-1.5 block text-sm font-semibold text-ink-600';

export function VoiceTaskForm({ data, onChange, onUploadingChange, onDelete }: Props) {
  const [draft, setDraft] = useState(data);
  const draftRef = useRef(data);
  const mountedRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [audioError, setAudioError] = useState('');
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const update = (next: VoiceTaskData) => {
    draftRef.current = next;
    setDraft(next);
    onChange(next);
  };
  const upload = async (file: File) => {
    if (file.type && !file.type.startsWith('audio/')) {
      setAudioError('Оберіть аудіофайл.');
      return;
    }
    setUploading(true);
    setAudioError('');
    onUploadingChange(true);
    try {
      const url = (await uploadAudio(file)).trim();
      if (!url || !isPronunciationAudioUrlValid(url)) throw new Error('Invalid audio URL');
      if (mountedRef.current) update({ ...draftRef.current, referenceAudioUrl: url });
    } catch {
      if (mountedRef.current) setAudioError('Не вдалося завантажити аудіо. Спробуйте ще раз.');
    } finally {
      if (mountedRef.current) {
        setUploading(false);
        onUploadingChange(false);
      }
    }
  };

  const scripted = draft.mode === 'scripted';
  const pronunciation = scripted || draft.evaluation === 'pronunciation';
  const durations = [...new Set([15, 30, 45, 60, 90, 120, draft.maxDurationSeconds])].sort((a, b) => a - b);
  const audioUrlValid = isPronunciationAudioUrlValid(draft.referenceAudioUrl.trim());

  return <section className="overflow-hidden rounded-2xl border border-lavender-200 bg-lavender-50 shadow-cozy-sm" aria-label="Усне завдання">
    <div className="flex items-center justify-between gap-3 border-b border-lavender-200 bg-mint-100 px-5 py-3">
      <div className="flex items-center gap-2 font-bold text-ink"><Mic size={18} /> Усне завдання</div>
      <button type="button" onClick={onDelete} title="Видалити усне завдання" aria-label="Видалити усне завдання" className="rounded-lg p-2 text-ink-400 hover:bg-white/60 hover:text-rose-600"><Trash2 size={16} /></button>
    </div>
    <div className="space-y-4 p-5">
      <div className={`grid gap-4 ${!scripted ? 'sm:grid-cols-2' : ''}`}>
        <label className="block">
          <span className={labelClass}>Режим відповіді</span>
          <select value={draft.mode} onChange={event => update({ ...draft, mode: event.target.value === 'unscripted' ? 'unscripted' : 'scripted' })} className={fieldClass}>
            <option value="scripted">Прочитати текст</option>
            <option value="unscripted">Відповісти своїми словами</option>
          </select>
        </label>
        {!scripted && <label className="block">
          <span className={labelClass}>Що перевіряти</span>
          <select value={draft.evaluation} onChange={event => update({ ...draft, evaluation: event.target.value === 'content' ? 'content' : 'pronunciation' })} className={fieldClass}>
            <option value="pronunciation">Вимова й плавність</option>
            <option value="content">Зміст і граматика</option>
          </select>
        </label>}
      </div>
      <p className="text-sm text-ink-500">{pronunciation
        ? 'Перевіряємо вимову та плавність мовлення.'
        : 'Перевіряємо відповідність завданню, граматику та вживання слів.'}</p>
      <label className="block">
        <span className={labelClass}>Назва · необов’язково</span>
        <input type="text" maxLength={speakingTaskLimits.title} value={draft.title} onChange={event => update({ ...draft, title: event.target.value })} className={fieldClass} placeholder={scripted ? 'Тренуємо вимову' : 'Мій день'} />
      </label>
      <label className="block">
        <span className={labelClass}>{scripted ? 'Інструкція · необов’язково' : 'Завдання для учня'}</span>
        <textarea required={!scripted} maxLength={speakingTaskLimits.prompt} value={draft.prompt} onChange={event => update({ ...draft, prompt: event.target.value })} rows={scripted ? 2 : 3} className={`${fieldClass} resize-y`} placeholder={scripted ? 'Прочитайте текст уголос у зручному темпі.' : 'Розкажіть англійською, як пройшов ваш день.'} />
        <span className="mt-1 block text-xs text-ink-400">{draft.prompt.length}/{speakingTaskLimits.prompt}</span>
      </label>
      {scripted && <label className="block">
        <span className={labelClass}>Текст для читання</span>
        <textarea required maxLength={pronunciationTaskLimits.referenceText} value={draft.referenceText} onChange={event => update({ ...draft, referenceText: event.target.value })} rows={4} className={`${fieldClass} resize-y`} placeholder="Every morning I open the window and listen to the birds." lang="en" />
        <span className="mt-1 block text-xs text-ink-400">{draft.referenceText.length}/{pronunciationTaskLimits.referenceText}</span>
      </label>}
      <div className={`grid gap-4 ${pronunciation ? 'sm:grid-cols-2' : ''}`}>
        {pronunciation && <label className="block">
          <span className={labelClass}>Вимова</span>
          <select value={draft.locale} onChange={event => update({ ...draft, locale: event.target.value === 'en-GB' ? 'en-GB' : 'en-US' })} className={fieldClass}>
            <option value="en-US">Американська</option>
            <option value="en-GB">Британська</option>
          </select>
        </label>}
        <label className="block">
          <span className={labelClass}>Час для запису</span>
          <select value={draft.maxDurationSeconds} onChange={event => update({ ...draft, maxDurationSeconds: Number(event.target.value) })} className={fieldClass}>
            {durations.map(duration => <option key={duration} value={duration}>До {duration} секунд</option>)}
          </select>
        </label>
      </div>
      {!pronunciation && <>
        <label className="block">
          <span className={labelClass}>Критерії перевірки · необов’язково</span>
          <textarea maxLength={speakingTaskLimits.criteria} value={draft.criteria} onChange={event => update({ ...draft, criteria: event.target.value })} rows={3} className={`${fieldClass} resize-y`} placeholder="Наприклад: учень описує три події та використовує Past Simple." />
          <span className="mt-1 block text-xs text-ink-400">{draft.criteria.length}/{speakingTaskLimits.criteria}</span>
        </label>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={labelClass}>Слова для вживання · необов’язково</span>
            <button type="button" disabled={draft.targetWords.length >= speakingTaskLimits.targetWords} onClick={() => update({ ...draft, targetWords: [...draft.targetWords, ''] })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-lavender-700 hover:bg-lavender-100 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={15} /> Додати слово</button>
          </div>
          <p className="mb-2 text-xs text-ink-400">До {speakingTaskLimits.targetWords} англійських слів або фраз. Учень побачить цей список.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {draft.targetWords.map((word, index) => <div key={index} className="flex items-center gap-1">
              <input type="text" maxLength={speakingTaskLimits.targetWord} aria-label={`Слово або фраза ${index + 1}`} aria-invalid={!!word.trim() && !isSpeakingTargetWordValid(word)} value={word} onChange={event => update({ ...draft, targetWords: draft.targetWords.map((current, currentIndex) => currentIndex === index ? event.target.value : current) })} className={fieldClass} placeholder="Наприклад: usually" />
              <button type="button" onClick={() => update({ ...draft, targetWords: draft.targetWords.filter((_, currentIndex) => currentIndex !== index) })} title={`Видалити слово ${index + 1}`} aria-label={`Видалити слово ${index + 1}`} className="rounded-lg p-2 text-ink-400 hover:bg-white hover:text-rose-600"><X size={15} /></button>
            </div>)}
          </div>
          {draft.targetWords.some(word => !!word.trim() && !isSpeakingTargetWordValid(word)) && <p role="alert" className="mt-2 text-xs text-rose-700">Використовуйте англійські літери, апострофи, дефіси та пробіли.</p>}
        </div>
      </>}
      {pronunciation && <div className="rounded-xl border border-lavender-200 bg-white/60 p-3">
        <label className="block">
          <span className={labelClass}>Аудіозразок · необов’язково</span>
          <input type="url" inputMode="url" maxLength={pronunciationTaskLimits.referenceAudioUrl} value={draft.referenceAudioUrl} disabled={uploading} aria-invalid={!audioUrlValid} onChange={event => { setAudioError(''); update({ ...draft, referenceAudioUrl: event.target.value }); }} className={fieldClass} placeholder="https://…" />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" disabled={uploading} aria-label="Завантажити аудіозразок" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file); }} />
          <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-lavender-100 px-3 py-2 text-xs font-semibold text-lavender-700 hover:bg-lavender-200 disabled:cursor-wait disabled:opacity-60"><Upload size={14} />{uploading ? 'Завантаження…' : 'Завантажити аудіо'}</button>
          {!!draft.referenceAudioUrl && <button type="button" disabled={uploading} onClick={() => { setAudioError(''); update({ ...draft, referenceAudioUrl: '' }); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-ink-500 hover:text-rose-600 disabled:opacity-50"><X size={14} />Прибрати</button>}
        </div>
        {!audioUrlValid && <p role="alert" className="mt-2 text-xs text-rose-700">Вкажіть HTTPS-посилання на аудіо до {pronunciationTaskLimits.referenceAudioUrl} символів.</p>}
        {audioError && <p role="alert" className="mt-2 text-xs text-rose-700">{audioError}</p>}
        {audioUrlValid && !!draft.referenceAudioUrl.trim() && <audio key={draft.referenceAudioUrl.trim()} src={draft.referenceAudioUrl.trim()} controls preload="none" aria-label="Аудіозразок вимови" className="mt-3 w-full" onError={() => setAudioError('Не вдалося відтворити аудіо. Перевірте файл або посилання.')} />}
      </div>}
    </div>
  </section>;
}
