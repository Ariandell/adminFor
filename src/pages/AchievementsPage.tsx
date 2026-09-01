import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ImageIcon, Pencil, Plus, Search, Target, Trash2, Trophy } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import FileDropzone from '../components/ui/FileDropzone';
import IconButton from '../components/ui/IconButton';
import PageHeader from '../components/ui/PageHeader';
import {
  achievementActions,
  achievementScopes,
  formatAchievementRule,
  getAchievementAction,
  getAchievementScopeLabel,
  type AchievementScope,
} from '../lib/achievementRules';

type Achievement = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  icon_url: string | null;
  condition_scope: AchievementScope;
  condition_type: string;
  condition_value: number;
  condition_course_id: string | null;
  reward_currency: number;
  is_active: boolean;
  created_at: string;
};

type AchievementDraft = {
  title: string;
  description: string;
  condition_scope: AchievementScope;
  condition_type: string;
  condition_value: string;
  condition_course_id: string;
  is_active: boolean;
};

const emptyDraft = (): AchievementDraft => ({
  title: '',
  description: '',
  condition_scope: 'app',
  condition_type: achievementActions.app[0].value,
  condition_value: '1',
  condition_course_id: '',
  is_active: true,
});

export default function AchievementsPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Achievement[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [draft, setDraft] = useState<AchievementDraft>(emptyDraft);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | AchievementScope>('all');
  const [schemaError, setSchemaError] = useState('');

  async function fetchAchievements() {
    const [{ data, error }, courseResult] = await Promise.all([
      supabase
        .from('achievements')
        .select('id, code, title, description, icon_url, condition_scope, condition_type, condition_value, condition_course_id, reward_currency, is_active, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('courses').select('id, title').order('title'),
    ]);
    if (!courseResult.error) setCourses(courseResult.data || []);
    if (error) {
      setRows([]);
      setSchemaError(error.message);
      return;
    }
    setRows((data || []) as Achievement[]);
    setSchemaError('');
  }

  useEffect(() => { fetchAchievements(); }, []);

  const courseTitles = useMemo(() => new Map(courses.map(course => [course.id, course.title])), [courses]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rows.filter(row => {
      const matchesScope = scopeFilter === 'all' || row.condition_scope === scopeFilter;
      const matchesSearch = !query || `${row.title} ${row.description || ''} ${formatAchievementRule(row.condition_scope, row.condition_type, row.condition_value, row.condition_course_id ? courseTitles.get(row.condition_course_id) : undefined)}`.toLocaleLowerCase().includes(query);
      return matchesScope && matchesSearch;
    });
  }, [courseTitles, rows, scopeFilter, search]);

  const availableActions = achievementActions[draft.condition_scope];
  const selectedAction = getAchievementAction(draft.condition_scope, draft.condition_type);
  const previewTarget = Math.max(1, Number(draft.condition_value) || 1);
  const selectedCourseTitle = draft.condition_course_id ? courseTitles.get(draft.condition_course_id) : undefined;

  function startCreate() {
    setEditing(null);
    setDraft(emptyDraft());
    setImageFile(null);
    setOpen(true);
  }

  function startEdit(row: Achievement) {
    const knownScope: AchievementScope = row.condition_scope && row.condition_scope in achievementActions ? row.condition_scope : 'app';
    const actionBelongsToScope = achievementActions[knownScope].some(action => action.value === row.condition_type);
    setEditing(row);
    setDraft({
      title: row.title,
      description: row.description || '',
      condition_scope: knownScope,
      condition_type: actionBelongsToScope ? row.condition_type : achievementActions[knownScope][0].value,
      condition_value: String(row.condition_value || 1),
      condition_course_id: row.condition_course_id || '',
      is_active: row.is_active,
    });
    setImageFile(null);
    setOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    setOpen(false);
    setEditing(null);
    setImageFile(null);
  }

  function changeScope(scope: AchievementScope) {
    setDraft(current => ({
      ...current,
      condition_scope: scope,
      condition_type: achievementActions[scope][0].value,
      condition_course_id: '',
    }));
  }

  function changeAction(action: string) {
    const nextAction = getAchievementAction(draft.condition_scope, action);
    setDraft(current => ({
      ...current,
      condition_type: action,
      condition_course_id: nextAction?.requiresCourse ? current.condition_course_id : '',
    }));
  }

  async function uploadImage(file: File): Promise<string> {
    const extension = file.name.split('.').pop() || 'png';
    const path = `achievements/${uuidv4()}.${extension}`;
    const { error } = await supabase.storage.from('course-images').upload(path, file);
    if (error) throw error;
    return supabase.storage.from('course-images').getPublicUrl(path).data.publicUrl;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing?.icon_url && !imageFile) {
      showToast('Оберіть зображення досягнення', 'error');
      return;
    }
    if (selectedAction?.requiresCourse && !draft.condition_course_id) {
      showToast('Оберіть курс для цієї умови', 'error');
      return;
    }

    setLoading(true);
    try {
      const iconUrl = imageFile ? await uploadImage(imageFile) : editing?.icon_url || null;
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        icon_url: iconUrl,
        condition_scope: draft.condition_scope,
        condition_type: draft.condition_type,
        condition_value: previewTarget,
        condition_course_id: selectedAction?.requiresCourse ? draft.condition_course_id : null,
        is_active: draft.is_active,
      };

      const { error } = editing
        ? await supabase.from('achievements').update(payload).eq('id', editing.id)
        : await supabase.from('achievements').insert([{
            ...payload,
            code: `achievement_${uuidv4().replaceAll('-', '')}`,
            reward_currency: 0,
          }]);
      if (error) throw error;

      showToast(editing ? 'Досягнення оновлено' : 'Досягнення створено', 'success');
      closeForm();
      fetchAchievements();
    } catch (error: any) {
      const needsMigration = error.message?.includes('condition_scope') || error.message?.includes('condition_course_id');
      showToast(needsMigration ? 'Спочатку застосуйте нову міграцію Supabase.' : `Помилка: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function remove(row: Achievement) {
    if (!confirm(`Видалити досягнення «${row.title}»?`)) return;
    const { error } = await supabase.from('achievements').delete().eq('id', row.id);
    if (error) showToast(`Помилка: ${error.message}`, 'error');
    else {
      showToast('Досягнення видалено', 'success');
      fetchAchievements();
    }
  }

  return (
    <div>
      <PageHeader
        title="Досягнення"
        description="Нагороди за прогрес і активність студентів"
        actions={<Button onClick={startCreate}><Plus size={18} />Створити досягнення</Button>}
      />

      {schemaError && (
        <div className="mb-5 rounded-xl border border-butter-200 bg-butter-100 p-4 text-sm text-butter-700">
          Застосуйте міграції <code>202609010001_achievement_rules.sql</code> і <code>202609010002_achievement_contexts.sql</code>, щоб увімкнути конструктор правил.
        </div>
      )}

      {open && (
        <Card tone="accent" className="mb-6">
          <form onSubmit={save} className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{editing ? 'Редагувати досягнення' : 'Нове досягнення'}</h2>
                {editing && <p className="mt-1 text-sm text-ink-400">{editing.title}</p>}
              </div>
              <button type="button" className="text-sm font-semibold text-ink-400 hover:text-ink" onClick={closeForm}>Закрити</button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-ink-600">Назва</span>
                  <input required className="field" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-ink-600">Опис</span>
                  <textarea required className="field min-h-28" value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} />
                </label>
              </div>
              <FileDropzone
                label="Зображення"
                file={imageFile}
                currentUrl={editing?.icon_url}
                onChange={setImageFile}
              />
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <Target size={18} className="text-lavender-500" />
                <h3 className="font-bold">Умова отримання</h3>
              </div>
              <div className="grid gap-3 rounded-2xl border border-lavender-100 bg-white/70 p-4 md:grid-cols-[0.85fr_1.6fr_0.55fr]">
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-400">Область</span>
                  <select className="field" value={draft.condition_scope} onChange={event => changeScope(event.target.value as AchievementScope)}>
                    {achievementScopes.map(scope => <option key={scope.value} value={scope.value}>{scope.label}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-400">Дія</span>
                  <select className="field" value={draft.condition_type} onChange={event => changeAction(event.target.value)}>
                    {availableActions.map(action => <option key={action.value} value={action.value}>{action.label}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-400">Кількість</span>
                  <div className="relative">
                    <input required min="1" max={draft.condition_type === 'course_progress_percent' ? 100 : undefined} step="1" type="number" className="field pr-20" value={draft.condition_value} onChange={event => setDraft({ ...draft, condition_value: event.target.value })} />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">{selectedAction?.unit}</span>
                  </div>
                </label>
                {selectedAction?.requiresCourse && (
                  <label className="md:col-span-3">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-400">Конкретний курс</span>
                    <select required className="field" value={draft.condition_course_id} onChange={event => setDraft({ ...draft, condition_course_id: event.target.value })}>
                      <option value="">Оберіть курс</option>
                      {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-mint-50 px-4 py-3 text-sm font-semibold text-ink-600">
                <Trophy size={17} className="shrink-0 text-mint-600" />
                Студент отримає досягнення, коли: {formatAchievementRule(draft.condition_scope, draft.condition_type, previewTarget, selectedCourseTitle)}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-lavender-100 pt-5">
              <label className="flex items-center gap-2 text-sm font-semibold text-ink-600">
                <input type="checkbox" checked={draft.is_active} onChange={event => setDraft({ ...draft, is_active: event.target.checked })} className="h-5 w-5 accent-lavender-500" />
                Активне
              </label>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={closeForm}>Скасувати</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Збереження...' : editing ? 'Зберегти зміни' : 'Створити'}</Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="field pl-10" placeholder="Пошук досягнень" value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        <select className="field sm:w-52" value={scopeFilter} onChange={event => setScopeFilter(event.target.value as 'all' | AchievementScope)}>
          <option value="all">Усі області</option>
          {achievementScopes.map(scope => <option key={scope.value} value={scope.value}>{scope.label}</option>)}
        </select>
      </div>

      {filteredRows.length === 0 ? (
        <Card><EmptyState icon={<Trophy size={28} />} title={rows.length ? 'Досягнень не знайдено' : 'Досягнень ще немає'} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredRows.map(row => (
            <Card key={row.id} className="group flex min-w-0 gap-4 p-4 transition hover:border-lavender-300 hover:shadow-cozy-lg">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-lavender-100 bg-lavender-50 text-lavender-300">
                {row.icon_url ? <img src={row.icon_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={24} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-words font-bold">{row.title}</h3>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge label={getAchievementScopeLabel(row.condition_scope)} seed={row.condition_scope} />
                      {!row.is_active && <Badge label="Неактивне" seed="inactive" />}
                    </div>
                  </div>
                  <div className="flex shrink-0 opacity-70 transition group-hover:opacity-100">
                    <IconButton title="Редагувати" onClick={() => startEdit(row)}><Pencil size={16} /></IconButton>
                    <IconButton title="Видалити" variant="danger" onClick={() => remove(row)}><Trash2 size={16} /></IconButton>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 break-words text-sm text-ink-400">{row.description}</p>
                <p className="mt-3 break-words text-sm font-semibold text-ink-600">{formatAchievementRule(row.condition_scope, row.condition_type, row.condition_value, row.condition_course_id ? courseTitles.get(row.condition_course_id) : undefined)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
