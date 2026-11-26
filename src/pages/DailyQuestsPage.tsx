import { useEffect, useState } from 'react';
import { Pencil, Plus, CalendarCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import { changeDailyKind, dailyKindGroups, dailyKinds, dailyPayload, emptyDaily, type DailyDraft, type DailyKind } from '../lib/dailyQuest';

type Quest = ReturnType<typeof dailyPayload> & { id: string };
export default function DailyQuestsPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Quest[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [draft, setDraft] = useState<DailyDraft>(emptyDaily);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    const [quests, catalog] = await Promise.all([
      supabase.from('daily_quest_templates').select('id,title,description,kind,target,reward_points,course_id,is_active').order('created_at', { ascending: false }),
      supabase.from('courses').select('id,title').order('title'),
    ]);
    if (quests.error || catalog.error) setError('Не вдалося завантажити дейліки. Спробуй ще раз.');
    else { setRows(quests.data as Quest[]); setCourses(catalog.data); setError(''); }
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  function edit(row?: Quest) {
    setEditing(row?.id ?? null);
    setDraft(row ? { ...row, course_id: row.course_id ?? '', target: String(row.target), reward_points: String(row.reward_points) } : emptyDaily());
    setOpen(true); setError('');
  }
  function set<K extends keyof DailyDraft>(key: K, value: DailyDraft[K]) { setDraft(d => ({ ...d, [key]: value })); }
  async function save() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const payload = dailyPayload(draft);
      const query = editing ? supabase.from('daily_quest_templates').update(payload).eq('id', editing) : supabase.from('daily_quest_templates').insert(payload);
      const result = await query.select('id').single();
      if (result.error) throw Error('Не вдалося зберегти. Перевір доступ і спробуй ще раз.');
      setOpen(false); showToast('Дейлік збережено'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Не вдалося зберегти.'); }
    finally { setBusy(false); }
  }
  const input = 'mt-2 w-full rounded-xl border border-lavender-200 bg-white px-4 py-3 text-sm';
  const selected = dailyKinds.find(k => k.value === draft.kind)!;
  return <>
    <PageHeader title="Дейліки" description="До трьох завдань на день для кожного учня" actions={<Button onClick={() => edit()} disabled={busy}><Plus size={18} />Створити дейлік</Button>} />
    {error && <div role="alert" className="mb-5 rounded-xl bg-blush-50 p-4 text-sm">{error} {!open && <Button size="sm" variant="ghost" onClick={load}>Повторити</Button>}</div>}
    {open && <Card className="mb-7">
      <h2 className="mb-5 text-xl font-extrabold">{editing ? 'Редагувати дейлік' : 'Новий дейлік'}</h2>
      <form onSubmit={e => { e.preventDefault(); void save(); }} className="grid gap-5 sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm font-bold">Назва<input className={input} value={draft.title} maxLength={80} required onChange={e => set('title', e.target.value)} placeholder="Маленькі кроки щодня" /></label>
        <label className="sm:col-span-2 text-sm font-bold">Опис<textarea className={input} value={draft.description} maxLength={240} rows={2} onChange={e => set('description', e.target.value)} /></label>
        <label className={`text-sm font-bold ${selected.allowsCourse ? '' : 'sm:col-span-2'}`}>
          Умова
          <select className={input} value={draft.kind} aria-describedby="daily-condition-description" onChange={e => {
            const kind = e.target.value as DailyKind;
            setDraft(current => changeDailyKind(current, kind));
          }}>
            {Object.entries(dailyKindGroups).map(([group, label]) => <optgroup key={group} label={label}>
              {dailyKinds.filter(kind => kind.group === group).map(kind => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
            </optgroup>)}
          </select>
        </label>
        {selected.allowsCourse && <label className="text-sm font-bold">Курс<select className={input} value={draft.course_id} onChange={e => set('course_id', e.target.value)}><option value="">Будь-який доступний</option>{courses.map(c => <option value={c.id} key={c.id}>{c.title}</option>)}</select></label>}
        <label className="text-sm font-bold">Ціль · {selected.unit}<input className={input} type="number" min={1} max={selected.max} step={1} required value={draft.target} onChange={e => set('target', e.target.value)} /></label>
        <label className="text-sm font-bold">Бали рейтингу<input className={input} type="number" min={0} max={60} step={1} required value={draft.reward_points} onChange={e => set('reward_points', e.target.value)} /></label>
        <div className="sm:col-span-2 rounded-xl bg-lavender-50 p-4 text-sm">
          <p className="font-bold">{draft.title || 'Назва дейліка'}</p>
          <p className="mt-1">{selected.label} · {draft.target || '—'} · +{draft.reward_points || '0'} балів</p>
          <p id="daily-condition-description" className="mt-2 text-ink-400">{selected.description}</p>
        </div>
        <label className="sm:col-span-2 flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={draft.is_active} onChange={e => set('is_active', e.target.checked)} />Доступний для видачі</label>
        <p className="sm:col-span-2 text-xs text-ink-400">Зміни застосовуються до нових видач. Уже видані завдання та їхні винагороди зберігаються до кінця дня за Києвом.</p>
        <div className="sm:col-span-2 flex gap-3"><Button type="submit" disabled={busy}>{busy ? 'Зберігаємо…' : 'Зберегти'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Скасувати</Button></div>
      </form>
    </Card>}
    {loading ? <p className="py-12 text-center text-ink-400">Завантаження…</p> : rows.length === 0 && !error ? <Card className="py-12 text-center"><CalendarCheck className="mx-auto mb-3 text-lavender-500" size={32} /><p>Створи перше щоденне завдання.</p></Card> : <div className="grid gap-4 lg:grid-cols-2">{rows.map(row => {
      const kind = dailyKinds.find(kind => kind.value === row.kind);
      const scope = kind?.group === 'personal' ? dailyKindGroups.personal
        : kind?.group === 'activity' ? 'Увесь додаток'
        : kind?.allowsCourse === false ? 'Різні доступні курси'
        : courses.find(course => course.id === row.course_id)?.title ?? 'Будь-який доступний курс';
      return <Card key={row.id}>
        <div className="flex items-start justify-between gap-4"><div><span className="text-xs text-ink-400">{row.is_active ? 'Активний' : 'Вимкнений'} · +{row.reward_points} балів</span><h2 className="mt-2 text-lg font-extrabold">{row.title}</h2></div><Button size="sm" variant="ghost" onClick={() => edit(row)}><Pencil size={16} />Змінити</Button></div>
        {row.description && <p className="mt-2 text-sm text-ink-600">{row.description}</p>}
        <p className="mt-4 text-sm">{kind?.label} · {row.target}</p>
        <p className="mt-1 text-xs text-ink-400">{scope}</p>
      </Card>;
    })}</div>}
  </>;
}
