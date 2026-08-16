import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ClipboardCheck, Search } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';

const initial = { id: '', lesson_id: '', title: '', instructions: '', task_type: 'text', ai_review: false, is_published: false };

export default function HomeworkPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [form, setForm] = useState(initial);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [schemaError, setSchemaError] = useState(false);

  async function load() {
    const [homework, lessonRows] = await Promise.all([
      supabase.from('homework').select('*, lessons(title, courses(title))').order('created_at', { ascending: false }),
      supabase.from('lessons').select('id, title, courses(title)').order('created_at', { ascending: false }),
    ]);
    if (homework.error) setSchemaError(true); else { setSchemaError(false); setRows(homework.data || []); }
    setLessons(lessonRows.data || []);
  }
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => rows.filter(row => `${row.title} ${row.instructions || ''}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { lesson_id: form.lesson_id, title: form.title, instructions: form.instructions, task_type: form.task_type, ai_review: form.ai_review, is_published: form.is_published };
    const { error } = form.id ? await supabase.from('homework').update(payload).eq('id', form.id) : await supabase.from('homework').insert([payload]);
    if (error) showToast(error.message, 'error'); else { showToast('Домашнє завдання збережено', 'success'); setOpen(false); setForm(initial); load(); }
  }
  async function remove(row: any) { if (!confirm(`Видалити «${row.title}»?`)) return; const { error } = await supabase.from('homework').delete().eq('id', row.id); if (error) showToast(error.message, 'error'); else load(); }

  return <div><PageHeader title="Домашні завдання" actions={<Button onClick={() => { setForm(initial); setOpen(true); }}><Plus size={18} />Додати</Button>} />
    {schemaError && <div className="mb-5 rounded-xl border border-butter-200 bg-butter-100 p-4 text-sm text-butter-700">Застосуйте міграцію Supabase з репозиторію, щоб увімкнути домашні завдання.</div>}
    {open && <Card tone="accent" className="mb-5"><form onSubmit={save} className="space-y-4"><div className="flex justify-between"><h2 className="text-lg font-bold">{form.id ? 'Редагування' : 'Нове домашнє завдання'}</h2><button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-400">Закрити</button></div><div className="grid md:grid-cols-2 gap-4"><label><span className="block text-sm font-semibold mb-1">Урок</span><select required className="field" value={form.lesson_id} onChange={e => setForm({ ...form, lesson_id: e.target.value })}><option value="">Оберіть урок</option>{lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.courses?.title} · {lesson.title || 'Без назви'}</option>)}</select></label><label><span className="block text-sm font-semibold mb-1">Тип</span><select className="field" value={form.task_type} onChange={e => setForm({ ...form, task_type: e.target.value })}><option value="text">Текстове</option><option value="quiz">Тест</option><option value="matching">Зіставлення</option><option value="ordering">Пазл / порядок</option><option value="free_answer">Вільна відповідь</option><option value="speech">Голосова відповідь</option></select></label></div><input required className="field" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Назва" /><textarea className="field min-h-28" value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} placeholder="Умова завдання" /><div className="flex flex-wrap gap-6"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.ai_review} onChange={e => setForm({ ...form, ai_review: e.target.checked })} className="accent-lavender-500" />Перевіряти через AI</label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked })} className="accent-lavender-500" />Опубліковано</label></div><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Скасувати</Button><Button type="submit">Зберегти</Button></div></form></Card>}
    <div className="relative mb-4"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input className="field pl-10" placeholder="Пошук" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <Card className="p-0 overflow-hidden">{filtered.length === 0 ? <EmptyState icon={<ClipboardCheck size={28} />} title="Домашніх завдань немає" /> : <div className="divide-y divide-lavender-100">{filtered.map(row => <div key={row.id} className="flex items-center justify-between p-4"><div><div className="flex gap-2 items-center"><p className="font-bold">{row.title}</p>{row.is_published && <span className="text-xs rounded-full bg-mint-100 text-mint-700 px-2 py-0.5">Опубліковано</span>}{row.ai_review && <span className="text-xs rounded-full bg-lavender-100 text-lavender-700 px-2 py-0.5">AI</span>}</div><p className="text-sm text-ink-400">{row.lessons?.courses?.title} · {row.lessons?.title} · {row.task_type}</p></div><div className="flex"><IconButton onClick={() => { setForm({ ...initial, ...row }); setOpen(true); }}><Pencil size={16} /></IconButton><IconButton variant="danger" onClick={() => remove(row)}><Trash2 size={16} /></IconButton></div></div>)}</div>}</Card>
  </div>;
}
