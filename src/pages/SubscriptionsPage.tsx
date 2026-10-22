import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Copy, ImageIcon, Pencil, Plus, RefreshCw, Search, WalletCards, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import FileDropzone from '../components/ui/FileDropzone';
import PageHeader from '../components/ui/PageHeader';
import {
  FEATURE_CATALOG, buildPlanPayload, createPlanDraft, planToDraft, summarizePlan,
  validatePlanDraft, type FeatureKey, type PlanDraft,
} from '../lib/subscriptionPlan';

type PlanRow = Record<string, unknown> & { id: string; title: string; is_active: boolean; updated_at?: string };
type Course = { id: string; title: string; is_published: boolean };
const migration = '202610220001_subscription_builder.sql';
const groups = [
  { key: 'learning', title: 'Навчання', description: 'Переклад та голосові завдання в уроках' },
  { key: 'words', title: 'Слова й повторення', description: 'Авторський словник, власні картки та практика' },
  { key: 'ai', title: 'ШІ', description: 'Доступ і кількість звернень до помічника' },
  { key: 'extras', title: 'Додаткові можливості', description: 'Статистика та оформлення профілю' },
];

function newDraft() {
  return { ...createPlanDraft(), code: `plan_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}` };
}
function isSchemaError(error: { code?: string; message?: string }) {
  return ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error.code || '');
}
function errorText(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === '23505') return 'Такий код підписки вже існує. Зміни його в додаткових налаштуваннях.';
  if (code === '42501') return 'Немає дозволу зберегти підписку. Перевір доступ адміністратора.';
  if (code === '23514') return 'Перевір ціну, код підписки та ліміти функцій.';
  return 'Не вдалося зберегти підписку. Перевір з’єднання та спробуй ще раз.';
}
function priceText(draft: PlanDraft) {
  const amount = Number(draft.price.replace(',', '.'));
  if (!draft.price || !Number.isFinite(amount)) return 'Вкажи ціну';
  try { return new Intl.NumberFormat('uk-UA', { style: 'currency', currency: draft.currency }).format(amount); }
  catch { return `${draft.price} ${draft.currency}`; }
}
function FieldError({ name, errors }: { name: string; errors: Record<string, string> }) {
  return errors[name] ? <p className="mt-1 text-sm text-blush-700">{errors[name]}</p> : null;
}
function CourseBundleSummary({ access, courses }: { access: PlanDraft['courses']; courses: Course[] }) {
  if (access.mode !== 'selected') return <p className="text-sm font-semibold">{access.mode === 'all' ? 'Усі опубліковані курси, зокрема майбутні' : 'Без доступу до курсів'}</p>;
  return <div>
    <p className="text-sm font-semibold">Курсів у пакеті: {access.ids.length}</p>
    {access.ids.length > 0 && <ul aria-label="Курси в підписці" className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-auto">{access.ids.map(id => {
      const course = courses.find(item => item.id === id);
      return <li key={id} className="max-w-full break-words rounded-lg bg-lavender-50 px-2.5 py-1 text-xs text-lavender-700">{course?.title || 'Недоступний курс'}</li>;
    })}</ul>}
  </div>;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

export default function SubscriptionsPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseError, setCourseError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [needsMigration, setNeedsMigration] = useState(false);
  const [draft, setDraft] = useState<PlanDraft>(newDraft);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [featureSearch, setFeatureSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [dirty, setDirty] = useState(false);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const editorRef = useRef<HTMLElement>(null);
  const validationRef = useRef<HTMLDivElement>(null);
  const requestGeneration = useRef(0);
  const saveLock = useRef(false);
  const newPlanId = useRef(crypto.randomUUID());
  const pendingImage = useRef<{ file: File; path: string; url: string; unconfirmed: boolean } | null>(null);

  async function load() {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setLoadError('');
    try {
      const allPlans: PlanRow[] = [];
      let schemaMissing = false;
      for (let offset = 0; ;) {
        let result = await supabase.from('subscription_plans')
          .select('*, description, image_url, entitlements, updated_at')
          .order('created_at', { ascending: false }).order('id').range(offset, offset + 999);
        if (result.error && isSchemaError(result.error)) {
          schemaMissing = true;
          result = await supabase.from('subscription_plans').select('*')
            .order('created_at', { ascending: false }).order('id').range(offset, offset + 999);
        }
        if (result.error) throw result.error;
        if (!result.data.length) break;
        allPlans.push(...result.data as PlanRow[]);
        offset += result.data.length;
      }
      if (generation !== requestGeneration.current) return;
      setRows(allPlans);
      setNeedsMigration(schemaMissing);
      const allCourses: Course[] = [];
      for (let offset = 0; ;) {
        const result = await supabase.from('courses').select('id, title, is_published').order('title').order('id').range(offset, offset + 999);
        if (result.error) { if (generation === requestGeneration.current) setCourseError(true); return; }
        if (!result.data.length) break;
        allCourses.push(...result.data);
        offset += result.data.length;
      }
      if (generation === requestGeneration.current) { setCourses(allCourses); setCourseError(false); }
    } catch {
      if (generation === requestGeneration.current) setLoadError('Не вдалося завантажити підписки. Перевір з’єднання та повтори спробу.');
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }
  useEffect(() => { void load(); return () => { requestGeneration.current++; }; }, []);
  useEffect(() => {
    if (!imageFile) { setImagePreview(''); return; }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function change<K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) {
    setDraft(current => ({ ...current, [key]: value, needsConfiguration: key === 'courses' ? false : current.needsConfiguration })); setDirty(true);
    setErrors(current => Object.fromEntries(Object.entries(current).filter(([name]) => name !== key && !name.startsWith(`${key}.`))));
  }
  function updateFeature(key: FeatureKey, patch: Partial<PlanDraft['features'][FeatureKey]>) {
    setDraft(current => ({ ...current, needsConfiguration: false, features: { ...current.features, [key]: { ...current.features[key], ...patch } } }));
    setDirty(true);
    setErrors(current => Object.fromEntries(Object.entries(current).filter(([name]) => !name.startsWith(`features.${key}`))));
  }
  function canLeave() { return !saving && (!dirty || window.confirm('Закрити без збереження змін?')); }
  function start(row?: PlanRow, duplicate = false) {
    if (open && !canLeave()) return;
    let next = row ? planToDraft(row) : newDraft();
    if (duplicate) next = { ...next, code: newDraft().code, title: `${next.title} — копія`.slice(0, 120), is_active: false };
    setDraft(next); setEditing(duplicate ? null : row || null); setImageFile(null); setErrors({});
    newPlanId.current = crypto.randomUUID(); pendingImage.current = null;
    setFeatureSearch(''); setCourseSearch(''); setDirty(false); setOpen(true);
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  function close() {
    if (!canLeave()) return;
    setOpen(false); setDirty(false); setEditing(null); setImageFile(null);
  }
  function chooseImage(file: File | null) {
    if (file && (!['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      showToast('Обери PNG, JPG, WebP або AVIF розміром до 5 МБ.', 'error'); return;
    }
    setImageFile(file); pendingImage.current = null; setDirty(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saveLock.current || needsMigration) return;
    const validation = validatePlanDraft(draft);
    const missingCourse = draft.courses.mode === 'selected' && draft.courses.ids.some(id => !courses.some(course => course.id === id));
    if (missingCourse && !courseError) validation['courses.ids'] = 'Один із курсів більше недоступний. Перевір вибір курсів.';
    setErrors(validation);
    if (Object.keys(validation).length) {
      requestAnimationFrame(() => { validationRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); validationRef.current?.focus({ preventScroll: true }); });
      return;
    }
    saveLock.current = true; setSaving(true);
    let uploadedPath: string | null = null;
    let writeAttempted = false;
    let definitiveRejection = false;
    let attemptedPayload: Record<string, unknown> | null = null;
    const previousUnconfirmedWrite = pendingImage.current?.unconfirmed === true;
    const recordId = editing?.id || newPlanId.current;
    async function saved() {
      pendingImage.current = null;
      showToast(editing ? 'Підписку оновлено' : 'Підписку створено', 'success');
      setOpen(false); setDirty(false); setEditing(null); setImageFile(null); await load();
    }
    try {
      let imageUrl = draft.image_url;
      if (imageFile && pendingImage.current?.file === imageFile) {
        imageUrl = pendingImage.current.url; uploadedPath = pendingImage.current.path;
      } else if (imageFile) {
        const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif' }[imageFile.type];
        uploadedPath = `subscriptions/${crypto.randomUUID()}.${ext}`;
        const upload = await supabase.storage.from('course-images').upload(uploadedPath, imageFile, { upsert: false, contentType: imageFile.type });
        if (upload.error) throw upload.error;
        imageUrl = supabase.storage.from('course-images').getPublicUrl(uploadedPath).data.publicUrl;
        pendingImage.current = { file: imageFile, path: uploadedPath, url: imageUrl, unconfirmed: false };
      }
      const payload = buildPlanPayload({ ...draft, image_url: imageUrl });
      attemptedPayload = payload;
      let query = editing ? supabase.from('subscription_plans').update(payload).eq('id', editing.id) : supabase.from('subscription_plans').insert({ ...payload, id: recordId });
      if (editing?.updated_at) query = query.eq('updated_at', editing.updated_at);
      writeAttempted = true;
      if (pendingImage.current) pendingImage.current.unconfirmed = true;
      const result = await query.select('id').single();
      if (result.error) {
        definitiveRejection = /^(23|42)/.test(result.error.code || '') || result.error.code === 'PGRST116';
        throw result.error;
      }
      uploadedPath = null;
      await saved();
    } catch (error) {
      if (writeAttempted && attemptedPayload) {
        try {
          const confirmed = await supabase.from('subscription_plans').select('*').eq('id', recordId).maybeSingle();
          if (confirmed.data && Object.entries(attemptedPayload).every(([key, value]) => canonical(confirmed.data[key]) === canonical(value))) {
            uploadedPath = null; await saved(); return;
          }
        } catch { /* A lost response is not evidence that the write failed. */ }
      }
      if (error && typeof error === 'object' && 'code' in error && error.code === 'PGRST116') {
        showToast('Підписку вже змінили в іншому вікні. Онови список і відкрий її ще раз.', 'error'); return;
      }
      showToast(errorText(error), 'error');
    } finally {
      if (uploadedPath && (!writeAttempted || (definitiveRejection && !previousUnconfirmedWrite))) {
        await supabase.storage.from('course-images').remove([uploadedPath]).catch(() => undefined);
        pendingImage.current = null;
      }
      saveLock.current = false; setSaving(false);
    }
  }
  async function changeStatus(row: PlanRow) {
    if (statusBusy || saving) return;
    const next = !row.is_active;
    if (next && (row.entitlements == null || Object.keys(validatePlanDraft(planToDraft(row))).length)) {
      start(row); showToast('Спочатку налаштуй функції та збережи підписку.', 'error'); return;
    }
    setStatusBusy(row.id);
    try {
      let query = supabase.from('subscription_plans').update({ is_active: next }).eq('id', row.id);
      if (row.updated_at) query = query.eq('updated_at', row.updated_at);
      const result = await query.select('id').single();
      if (result.error) throw result.error;
      showToast(next ? 'Підписка активна в каталозі' : 'Підписку приховано з каталогу', 'success'); await load();
    } catch { showToast('Не вдалося змінити статус. Онови список і спробуй ще раз.', 'error'); }
    finally { setStatusBusy(null); }
  }
  const visibleRows = rows.filter(row => {
    const matchesStatus = filter === 'all' || (filter === 'active' ? row.is_active : !row.is_active);
    return matchesStatus && `${row.title} ${row.description || ''} ${row.code}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  });
  const summaries = summarizePlan({ ...draft, courses: { mode: 'none', ids: [] } });
  const pendingCount = FEATURE_CATALOG.filter(feature => feature.status === 'planned' && draft.features[feature.key].enabled).length;
  const matchingCourses = courses.filter(course => course.title.toLocaleLowerCase().includes(courseSearch.trim().toLocaleLowerCase()));

  return <div>
    <PageHeader title="Підписки" description="Створи набір можливостей, вибери курси та налаштуй ліміти."
      actions={<><Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading || saving}><RefreshCw size={16} />Оновити</Button><Button onClick={() => start()} disabled={loading || needsMigration || saving}><Plus size={18} />Створити підписку</Button></>} />
    {needsMigration && <div role="alert" className="mb-5 rounded-xl border border-butter-200 bg-butter-50 p-4 text-sm text-butter-700">
      Для конструктора потрібно оновити базу: <code className="break-all">{migration}</code>.
      <Button variant="ghost" size="sm" onClick={() => void load()}>Перевірити ще раз</Button>
    </div>}
    {loadError && <div role="alert" className="mb-5 rounded-xl bg-blush-50 p-4 text-blush-700">{loadError} <Button size="sm" variant="secondary" onClick={() => void load()}>Повторити</Button></div>}

    {open && <section ref={editorRef} tabIndex={-1} aria-label={editing ? 'Редагування підписки' : 'Нова підписка'} className="mb-8 scroll-mt-6 outline-none">
      <form onSubmit={save} noValidate>
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">{editing ? 'Редагування підписки' : 'Нова підписка'}</h2><Button type="button" size="sm" variant="ghost" onClick={close} disabled={saving}><X size={16} />Закрити</Button></div>
        {Object.keys(errors).length > 0 && <div role="alert" ref={validationRef} tabIndex={-1} className="mb-4 rounded-xl bg-blush-50 p-4 text-sm text-blush-700">{[...new Set(Object.values(errors))].map(message => <p key={message}>{message}</p>)}</div>}
        {draft.configIssue && <div role="alert" className="mb-4 rounded-xl bg-butter-50 p-4 text-sm text-butter-700">{draft.configIssue}</div>}
        {draft.needsConfiguration && <div className="mb-4 rounded-xl bg-butter-50 p-4 text-sm text-butter-700">Це підписка зі старого довідника. Обери її функції — старі значення не перетворюються на дозволи автоматично.<Button type="button" size="sm" variant="ghost" onClick={() => change('needsConfiguration', false)}>Підтвердити налаштування з нуля</Button></div>}
        <fieldset disabled={saving || !!draft.configIssue} className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
          <div className="min-w-0 space-y-5">
            <Card>
              <h3 className="mb-4 text-lg font-extrabold">Про підписку</h3>
              <div className="space-y-4">
                <label className="block text-sm font-semibold">Назва<input autoFocus className="field mt-1" maxLength={120} placeholder="Наприклад, Базова" value={draft.title} onChange={e => change('title', e.target.value)} /><FieldError name="title" errors={errors} /></label>
                <label className="block text-sm font-semibold">Опис<textarea className="field mt-1 min-h-24" maxLength={2000} placeholder="Кому підійде підписка та що вона дає" value={draft.description} onChange={e => change('description', e.target.value)} /><FieldError name="description" errors={errors} /></label>
                <FileDropzone label="Зображення" file={imageFile} currentUrl={draft.image_url} onChange={chooseImage} hint="PNG, JPG, WebP або AVIF · до 5 МБ" />
                {(imageFile || draft.image_url) && <Button type="button" size="sm" variant="ghost" onClick={() => { setImageFile(null); pendingImage.current = null; change('image_url', ''); }}>Прибрати зображення</Button>}
                <FieldError name="image_url" errors={errors} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm font-semibold">Ціна<input className="field mt-1" inputMode="decimal" placeholder="300" value={draft.price} onChange={e => change('price', e.target.value)} /><FieldError name="price" errors={errors} /></label>
                  <label className="text-sm font-semibold">Валюта<select className="field mt-1" value={draft.currency} onChange={e => change('currency', e.target.value)}>{['UAH', 'USD', 'EUR'].map(value => <option key={value}>{value}</option>)}</select></label>
                  <label className="text-sm font-semibold">Період<select className="field mt-1" value={draft.billing_period} onChange={e => change('billing_period', e.target.value as PlanDraft['billing_period'])}><option value="month">Місяць</option><option value="year">Рік</option></select></label>
                </div>
              </div>
            </Card>
            <Card>
              <h3 className="text-lg font-extrabold">Доступ до курсів</h3><p className="mb-4 mt-1 text-sm text-ink-600">Для кожної підписки можна скласти власний пакет курсів.</p>
              <label className="block text-sm font-semibold">Які курси включено<select className="field mt-1" value={draft.courses.mode} onChange={e => change('courses', { mode: e.target.value as PlanDraft['courses']['mode'], ids: [] })}><option value="none">Без доступу до курсів</option><option value="all">Усі опубліковані курси, зокрема майбутні</option><option value="selected">Пакет вибраних курсів</option></select></label>
              {draft.courses.mode === 'selected' && <div className="mt-4">
                <p className="mb-3 text-sm text-ink-600">Включено лише відмічені курси. Нові курси додавай до цього пакета окремо.</p>
                {courseError ? <p role="alert" className="text-sm text-blush-700">Не вдалося завантажити курси. <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>Повторити</Button></p> : <>
                  <input aria-label="Пошук курсу" className="field mb-3" placeholder="Знайти курс" value={courseSearch} onChange={e => setCourseSearch(e.target.value)} />
                  <div className="max-h-64 space-y-1 overflow-auto rounded-xl border border-lavender-100 p-2">{matchingCourses.map(course => <label key={course.id} className={`flex cursor-pointer items-center gap-3 rounded-lg p-3 ${draft.courses.ids.includes(course.id) ? 'bg-lavender-50' : 'hover:bg-paper-100'}`}><input type="checkbox" className="h-4 w-4 shrink-0 accent-lavender-600" checked={draft.courses.ids.includes(course.id)} onChange={e => change('courses', { mode: 'selected', ids: e.target.checked ? [...draft.courses.ids, course.id] : draft.courses.ids.filter(id => id !== course.id) })} /><span className="min-w-0 text-sm font-semibold break-words">{course.title}</span>{!course.is_published && <span className="ml-auto shrink-0 rounded-full bg-butter-50 px-2 py-1 text-xs text-butter-700">Чернетка</span>}</label>)}{matchingCourses.length === 0 && <p className="p-3 text-sm text-ink-600">{courses.length ? 'Курсів за цим запитом немає.' : 'Курсів поки немає.'}</p>}</div>
                  <p className="mt-2 text-xs text-ink-600">Обрано: {draft.courses.ids.length}. Чернетки стануть доступні після публікації.</p>
                </>}
                {draft.courses.ids.filter(id => !courses.some(course => course.id === id)).map(id => <div key={id} className="mt-2 flex items-center justify-between gap-2 text-sm text-blush-700"><span>Недоступний курс</span><Button size="sm" type="button" variant="ghost" onClick={() => change('courses', { ...draft.courses, ids: draft.courses.ids.filter(value => value !== id) })}>Прибрати</Button></div>)}
              </div>}
              <FieldError name="courses.ids" errors={errors} />
            </Card>
            <Card>
              <h3 className="text-lg font-extrabold">Можливості та ліміти</h3><p className="mb-4 mt-1 text-sm text-ink-600">Увімкни потрібне. Для функцій із лімітом вкажи кількість або обери безліміт.</p>
              <input aria-label="Пошук функції" className="field mb-5" placeholder="Знайти функцію" value={featureSearch} onChange={e => setFeatureSearch(e.target.value)} />
              <div className="space-y-7">{groups.map(group => {
                const features = FEATURE_CATALOG.filter(feature => feature.group === group.key && `${feature.label} ${feature.description}`.toLocaleLowerCase().includes(featureSearch.toLocaleLowerCase()));
                if (!features.length) return null;
                return <section key={group.key}><h4 className="font-extrabold">{group.title}</h4><p className="mb-3 text-xs text-ink-600">{group.description}</p><div className="space-y-3">{features.map(feature => {
                  const rule = draft.features[feature.key];
                  return <div key={feature.key} className={`rounded-xl border p-4 transition-colors ${rule.enabled ? 'border-lavender-300 bg-lavender-50/60' : 'border-paper-200 bg-white'}`}>
                    <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-lavender-600" checked={rule.enabled} onChange={e => updateFeature(feature.key, { enabled: e.target.checked })} /><span className="min-w-0"><span className="flex flex-wrap items-center gap-2 font-bold">{feature.label}{feature.status === 'planned' && <span className="rounded-full bg-butter-100 px-2 py-0.5 text-[11px] font-semibold text-butter-700">Заплановано</span>}</span><span className="mt-1 block text-sm text-ink-600">{feature.description}</span></span></label>
                    {rule.enabled && feature.period && <div className="ml-7 mt-3 flex flex-wrap items-end gap-3">
                      <label className="text-xs font-semibold">Обмеження<select className="field mt-1 text-sm" aria-label={`${feature.label}: обмеження`} value={rule.unlimited ? 'unlimited' : 'limited'} onChange={e => updateFeature(feature.key, { unlimited: e.target.value === 'unlimited' })}><option value="limited">{feature.period === 'day' ? 'Ліміт на день' : 'Загальний ліміт'}</option><option value="unlimited">Безліміт</option></select></label>
                      {!rule.unlimited && <label className="min-w-0 flex-1 text-xs font-semibold">{feature.unit}{feature.period === 'day' ? ' на день' : ' загалом'}<input aria-label={`${feature.label}: кількість`} className="field mt-1 w-full text-sm" type="number" min="1" max="1000000" step="1" placeholder="Кількість" value={rule.limit} onChange={e => updateFeature(feature.key, { limit: e.target.value })} /></label>}
                      <FieldError name={`features.${feature.key}.limit`} errors={errors} />
                    </div>}
                  </div>;
                })}</div></section>;
              })}</div>
              {!FEATURE_CATALOG.some(feature => `${feature.label} ${feature.description}`.toLocaleLowerCase().includes(featureSearch.toLocaleLowerCase())) && <p className="py-5 text-center text-sm text-ink-600">Функцій за цим запитом немає.</p>}
            </Card>
            <Card><details><summary className="cursor-pointer font-bold">Додаткові налаштування</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Унікальний код<input className="field mt-1" value={draft.code} maxLength={64} onChange={e => change('code', e.target.value)} /><FieldError name="code" errors={errors} /></label>
              <label className="text-sm font-semibold">Група тарифу<select className="field mt-1" value={draft.tier} onChange={e => change('tier', e.target.value as PlanDraft['tier'])}><option value="basic">Basic</option><option value="premium">Premium</option></select><span className="mt-1 block text-xs font-normal text-ink-600">Для сумісності з промокодами. Доступ визначають галочки вище.</span></label>
              <label className="text-sm font-semibold">Бонусні іскри<input className="field mt-1" type="number" min="0" max="1000000" value={draft.reward_currency} onChange={e => change('reward_currency', e.target.value)} /><FieldError name="reward_currency" errors={errors} /><span className="mt-1 block text-xs font-normal text-ink-600">Запланована можливість. Нарахування ще не підключено.</span></label>
            </div></details></Card>
          </div>
          <aside className="min-w-0"><div className="space-y-4 xl:sticky xl:top-6">
            <Card className="overflow-hidden p-0"><div className="aspect-[16/10] bg-gradient-to-br from-mint-100 via-paper-100 to-lavender-100">{(imagePreview || draft.image_url) ? <img className="h-full w-full object-cover" src={imagePreview || draft.image_url} alt="Обкладинка підписки" /> : <div className="flex h-full items-center justify-center text-lavender-500"><WalletCards size={46} strokeWidth={1.2} /></div>}</div><div className="p-5"><p className="mb-2 text-xs font-bold uppercase tracking-widest text-lavender-700">Попередній перегляд</p><h3 className="break-words text-2xl font-extrabold">{draft.title || 'Назва підписки'}</h3>{draft.description && <p className="mt-2 whitespace-pre-line break-words text-sm text-ink-600">{draft.description}</p>}<p className="mt-5 text-2xl font-extrabold">{priceText(draft)}<span className="ml-1 text-sm font-normal text-ink-600">/ {draft.billing_period === 'year' ? 'рік' : 'місяць'}</span></p><div className="mt-4"><CourseBundleSummary access={draft.courses} courses={courses} /></div><ul className="mt-3 space-y-2">{summaries.map((text, index) => <li key={index} className="flex items-start gap-2 text-sm"><Check size={15} className="mt-0.5 shrink-0 text-lavender-600" /><span>{text}</span></li>)}</ul>{!summaries.length && <p className="mt-3 text-sm text-ink-600">Обери можливості підписки.</p>}</div></Card>
            {pendingCount > 0 && <p className="rounded-xl bg-butter-50 p-3 text-xs text-butter-700">Є заплановані функції ({pendingCount}). Увімкнення в тарифі не додає їх у додаток.</p>}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-lavender-200 bg-white p-4"><input type="checkbox" className="mt-1 h-4 w-4 accent-lavender-600" checked={draft.is_active} onChange={e => change('is_active', e.target.checked)} /><span><span className="block text-sm font-bold">Активна в каталозі</span><span className="block text-xs text-ink-600">Вимкни, щоб зберегти як чернетку.</span></span></label>
          </div></aside>
        </fieldset>
        <div className="sticky bottom-3 z-10 mt-5 flex flex-wrap justify-end gap-3 rounded-2xl border border-lavender-200 bg-white/95 p-3 shadow-cozy backdrop-blur"><Button type="button" variant="secondary" onClick={close} disabled={saving}>Скасувати</Button><Button type="submit" disabled={saving || needsMigration || !!draft.configIssue}>{saving ? 'Зберігаємо…' : 'Зберегти підписку'}</Button></div>
      </form>
    </section>}

    <div className="mb-5 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input aria-label="Пошук підписки" className="field pl-10" placeholder="Назва або опис підписки" value={search} onChange={e => setSearch(e.target.value)} /></div><select aria-label="Статус підписки" className="field sm:w-48" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Усі підписки</option><option value="active">Активні</option><option value="draft">Чернетки</option></select></div>
    {loading ? <p role="status" className="py-12 text-center text-sm text-ink-600">Завантажуємо підписки…</p> : visibleRows.length === 0 ? <Card><EmptyState icon={<WalletCards size={30} />} title={search || filter !== 'all' ? 'Підписок не знайдено' : 'Створи першу підписку'} /></Card> : <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">{visibleRows.map(row => {
      const rowDraft = planToDraft(row);
      return <Card key={row.id} className="flex min-w-0 flex-col overflow-hidden p-0"><div className="flex h-40 items-center justify-center bg-gradient-to-br from-mint-100 to-lavender-50">{typeof row.image_url === 'string' && row.image_url ? <img src={row.image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={32} className="text-lavender-400" />}</div><div className="flex flex-1 flex-col p-5"><div className="mb-2 flex items-start justify-between gap-2"><h2 className="min-w-0 break-words text-xl font-extrabold">{row.title}</h2><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${row.is_active ? 'bg-mint-100 text-mint-700' : 'bg-paper-100 text-ink-600'}`}>{row.is_active ? 'Активна' : 'Чернетка'}</span></div>{rowDraft.description && <p className="line-clamp-3 text-sm text-ink-600">{rowDraft.description}</p>}<p className="my-4 text-xl font-extrabold">{priceText(rowDraft)}<span className="ml-1 text-sm font-normal text-ink-600">/ {rowDraft.billing_period === 'year' ? 'рік' : 'місяць'}</span></p><p className="mb-4 text-sm text-ink-600">{row.entitlements == null ? 'Функції ще не налаштовані' : `${Object.values(rowDraft.features).filter(feature => feature.enabled).length} функцій · ${rowDraft.courses.mode === 'all' ? 'усі курси' : rowDraft.courses.mode === 'selected' ? `${rowDraft.courses.ids.length} курсів` : 'без курсів'}`}</p><div className="mb-4">{row.entitlements != null && <CourseBundleSummary access={rowDraft.courses} courses={courses} />}</div><div className="mt-auto flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => start(row)} disabled={saving || needsMigration}><Pencil size={15} />Редагувати</Button><Button size="sm" variant="ghost" onClick={() => start(row, true)} disabled={saving || needsMigration}><Copy size={15} />Копія</Button><Button size="sm" variant="ghost" disabled={!!statusBusy || saving || needsMigration} onClick={() => void changeStatus(row)}>{statusBusy === row.id ? 'Зберігаємо…' : row.is_active ? 'Приховати' : 'Активувати'}</Button></div></div></Card>;
    })}</div>}
  </div>;
}
