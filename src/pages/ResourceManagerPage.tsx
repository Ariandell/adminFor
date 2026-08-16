import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Database, Search } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';

export type Field = { key: string; label: string; type?: 'text' | 'number' | 'select' | 'textarea' | 'boolean' | 'datetime'; options?: { value: string; label: string }[]; required?: boolean; default?: unknown; list?: boolean };
export type ResourceConfig = { title: string; table: string; fields: Field[]; nameKey: string; subtitleKey?: string };

export default function ResourceManagerPage({ config }: { config: ResourceConfig }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, any>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [schemaError, setSchemaError] = useState('');

  function defaults() { return Object.fromEntries(config.fields.map(field => [field.key, field.default ?? (field.type === 'boolean' ? true : '')])); }
  async function fetchRows() {
    const { data, error } = await supabase.from(config.table).select('*').order('created_at', { ascending: false });
    if (error) { setSchemaError(error.message); setRows([]); } else { setSchemaError(''); setRows(data || []); }
  }
  useEffect(() => { fetchRows(); }, [config.table]);

  const visibleRows = useMemo(() => rows.filter(row => JSON.stringify(row).toLocaleLowerCase().includes(search.toLocaleLowerCase())), [rows, search]);
  function add() { setEditingId(null); setForm(defaults()); setOpen(true); }
  function edit(row: any) { setEditingId(row.id); setForm({ ...defaults(), ...row }); setOpen(true); }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    const payload: Record<string, unknown> = {};
    config.fields.forEach(field => { payload[field.key] = field.type === 'number' && form[field.key] !== '' ? Number(form[field.key]) : form[field.key]; });
    const query = editingId ? supabase.from(config.table).update(payload).eq('id', editingId) : supabase.from(config.table).insert([payload]);
    const { error } = await query; setLoading(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editingId ? 'Зміни збережено' : 'Запис додано', 'success'); setOpen(false); fetchRows();
  }
  async function remove(row: any) {
    if (!confirm(`Видалити «${row[config.nameKey]}»?`)) return;
    const { error } = await supabase.from(config.table).delete().eq('id', row.id);
    if (error) showToast(error.message, 'error'); else { showToast('Запис видалено', 'success'); fetchRows(); }
  }

  return <div>
    <PageHeader title={config.title} actions={<Button onClick={add}><Plus size={18} />Додати</Button>} />
    {schemaError && <div className="mb-5 rounded-xl border border-butter-200 bg-butter-100 p-4 text-sm text-butter-700"><strong>Таблиця ще не створена.</strong> Застосуйте міграцію <code>supabase/migrations/202608160001_content_admin.sql</code>.</div>}
    {open && <Card tone="accent" className="mb-5"><form onSubmit={save} className="space-y-4"><div className="flex justify-between"><h2 className="text-lg font-bold">{editingId ? 'Редагування' : 'Новий запис'}</h2><button type="button" className="text-sm text-ink-400" onClick={() => setOpen(false)}>Закрити</button></div><div className="grid md:grid-cols-2 gap-4">{config.fields.map(field => <label key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}><span className="block text-sm font-semibold text-ink-600 mb-1">{field.label}</span>{field.type === 'select' ? <select className="field" required={field.required} value={form[field.key] ?? ''} onChange={e => setForm({ ...form, [field.key]: e.target.value })}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === 'textarea' ? <textarea className="field min-h-24" required={field.required} value={form[field.key] ?? ''} onChange={e => setForm({ ...form, [field.key]: e.target.value })} /> : field.type === 'boolean' ? <input type="checkbox" checked={!!form[field.key]} onChange={e => setForm({ ...form, [field.key]: e.target.checked })} className="w-5 h-5 accent-lavender-500" /> : <input className="field" type={field.type === 'number' ? 'number' : field.type === 'datetime' ? 'datetime-local' : 'text'} required={field.required} value={form[field.key] ?? ''} onChange={e => setForm({ ...form, [field.key]: e.target.value })} />}</label>)}</div><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Скасувати</Button><Button type="submit" disabled={loading}>Зберегти</Button></div></form></Card>}
    <div className="relative mb-4"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input className="field pl-10" placeholder="Пошук" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <Card className="p-0 overflow-hidden">{visibleRows.length === 0 ? <EmptyState icon={<Database size={28} />} title="Записів немає" /> : <div className="divide-y divide-lavender-100">{visibleRows.map(row => <div key={row.id} className="flex items-center justify-between gap-4 p-4 hover:bg-lavender-50/50"><div className="min-w-0"><p className="font-bold truncate">{row[config.nameKey]}</p>{config.subtitleKey && <p className="text-sm text-ink-400 truncate">{row[config.subtitleKey]}</p>}<div className="flex gap-3 mt-1 text-xs text-ink-400">{config.fields.filter(field => field.list).map(field => <span key={field.key}>{field.label}: {String(row[field.key] ?? '—')}</span>)}</div></div><div className="flex"><IconButton onClick={() => edit(row)}><Pencil size={16} /></IconButton><IconButton variant="danger" onClick={() => remove(row)}><Trash2 size={16} /></IconButton></div></div>)}</div>}</Card>
  </div>;
}

export const resourceConfigs: Record<string, ResourceConfig> = {
  achievements: { title: 'Досягнення', table: 'achievements', nameKey: 'title', subtitleKey: 'description', fields: [
    { key: 'title', label: 'Назва', required: true }, { key: 'code', label: 'Код', required: true }, { key: 'description', label: 'Опис', type: 'textarea' },
    { key: 'condition_type', label: 'Умова', type: 'select', default: 'lessons_completed', options: [{ value: 'lessons_completed', label: 'Пройдено уроків' }, { value: 'cards_learned', label: 'Вивчено карток' }, { value: 'streak_days', label: 'Днів поспіль' }, { value: 'minutes_spent', label: 'Хвилин у додатку' }] },
    { key: 'condition_value', label: 'Значення', type: 'number', default: 1, list: true }, { key: 'reward_currency', label: 'Нагорода валютою', type: 'number', default: 0, list: true }, { key: 'icon_url', label: 'URL іконки' }, { key: 'is_active', label: 'Активне', type: 'boolean', default: true }
  ]},
  cosmetics: { title: 'Аватари й рамки', table: 'cosmetics', nameKey: 'title', subtitleKey: 'image_url', fields: [
    { key: 'title', label: 'Назва', required: true }, { key: 'cosmetic_type', label: 'Тип', type: 'select', default: 'avatar', options: [{ value: 'avatar', label: 'Аватар' }, { value: 'frame', label: 'Рамка' }], list: true }, { key: 'image_url', label: 'URL зображення', required: true }, { key: 'price_currency', label: 'Ціна у валюті', type: 'number', default: 0, list: true }, { key: 'access_tier', label: 'Доступ', type: 'select', default: 'free', options: [{ value: 'free', label: 'Безкоштовно' }, { value: 'basic', label: 'Basic' }, { value: 'premium', label: 'Premium' }] }, { key: 'is_active', label: 'Активне', type: 'boolean', default: true }
  ]},
  subscriptions: { title: 'Тарифи', table: 'subscription_plans', nameKey: 'title', subtitleKey: 'code', fields: [
    { key: 'title', label: 'Назва', required: true }, { key: 'code', label: 'Код', type: 'select', default: 'basic_monthly', options: [{ value: 'basic_monthly', label: 'Basic — місяць' }, { value: 'basic_yearly', label: 'Basic — рік' }, { value: 'premium_monthly', label: 'Premium — місяць' }, { value: 'premium_yearly', label: 'Premium — рік' }] }, { key: 'tier', label: 'Рівень', type: 'select', default: 'basic', options: [{ value: 'basic', label: 'Basic' }, { value: 'premium', label: 'Premium' }], list: true }, { key: 'billing_period', label: 'Період', type: 'select', default: 'month', options: [{ value: 'month', label: 'Місяць' }, { value: 'year', label: 'Рік' }], list: true }, { key: 'price', label: 'Ціна', type: 'number', required: true, list: true }, { key: 'currency', label: 'Валюта', default: 'UAH' }, { key: 'ai_requests_limit', label: 'Ліміт AI-запитів', type: 'number' }, { key: 'reward_currency', label: 'Бонусна валюта', type: 'number', default: 0 }, { key: 'is_active', label: 'Активний', type: 'boolean', default: true }
  ]},
  promos: { title: 'Промокоди', table: 'promo_codes', nameKey: 'code', subtitleKey: 'discount_type', fields: [
    { key: 'code', label: 'Промокод', required: true }, { key: 'discount_type', label: 'Тип бонусу', type: 'select', default: 'percent', options: [{ value: 'percent', label: 'Відсоток' }, { value: 'fixed', label: 'Фіксована знижка' }, { value: 'trial_days', label: 'Дні підписки' }, { value: 'currency', label: 'Валюта додатка' }], list: true }, { key: 'discount_value', label: 'Значення', type: 'number', required: true, list: true }, { key: 'plan_tier', label: 'Для тарифу', type: 'select', default: 'basic', options: [{ value: 'basic', label: 'Basic' }, { value: 'premium', label: 'Premium' }] }, { key: 'usage_limit', label: 'Ліміт використань', type: 'number' }, { key: 'starts_at', label: 'Початок', type: 'datetime' }, { key: 'expires_at', label: 'Завершення', type: 'datetime' }, { key: 'is_active', label: 'Активний', type: 'boolean', default: true }
  ]},
  sources: { title: 'Джерела трафіку', table: 'marketing_sources', nameKey: 'name', subtitleKey: 'code', fields: [
    { key: 'name', label: 'Назва', required: true }, { key: 'code', label: 'Код посилання', required: true }, { key: 'channel', label: 'Канал', list: true }, { key: 'campaign', label: 'Кампанія', list: true }, { key: 'is_active', label: 'Активне', type: 'boolean', default: true }
  ]},
};
