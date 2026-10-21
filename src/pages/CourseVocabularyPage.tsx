import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, BookOpen, Check, ChevronLeft, ChevronRight, Copy, Download, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';
import Button, { buttonClass } from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import {
  buildCourseVocabulary, buildVocabularyText, fetchAllRows, filterVocabularyEntries,
  UNASSIGNED_COURSE_ID, vocabularyFileName,
} from '../lib/courseVocabulary';
import type { VocabularyCard, VocabularyCourse, VocabularyLesson } from '../lib/courseVocabulary';

const ROWS_PER_PAGE = 50;
type VocabularyData = ReturnType<typeof buildCourseVocabulary>;

export default function CourseVocabularyPage() {
  const [params, setParams] = useSearchParams();
  const { showToast } = useToast();
  const [data, setData] = useState<VocabularyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedCards, setLoadedCards] = useState(0);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [page, setPage] = useState(0);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [copiedText, setCopiedText] = useState('');
  const exportRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      setLoadedCards(0);
      try {
        const [courses, lessons, cards] = await Promise.all([
          fetchAllRows<VocabularyCourse>((from, to) => supabase.from('courses').select('id, title, level').order('id').range(from, to)),
          fetchAllRows<VocabularyLesson>((from, to) => supabase.from('lessons').select('id, course_id, title').order('id').range(from, to)),
          // * also supports older cards that predate the optional irregular-verb fields.
          fetchAllRows<VocabularyCard>((from, to) => supabase.from('cards').select('*').order('id').range(from, to), count => { if (!cancelled) setLoadedCards(count); }),
        ]);
        if (!cancelled) setData(buildCourseVocabulary(courses, lessons, cards));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Спробуйте ще раз.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [reload]);

  const courses = useMemo(() => data ? [...data.courses, ...(data.unassigned.cardCount ? [data.unassigned] : [])] : [], [data]);
  const selectedId = params.get('course') || courses[0]?.id || '';
  const course = courses.find(item => item.id === selectedId);
  const unassigned = course?.id === UNASSIGNED_COURSE_ID;
  const entries = useMemo(() => course?.entries || [], [course]);
  const activeLessonId = course?.lessons.some(lesson => lesson.id === lessonId) ? lessonId : '';
  const visibleEntries = useMemo(() => filterVocabularyEntries(entries, query, activeLessonId), [entries, query, activeLessonId]);
  const pageCount = Math.max(1, Math.ceil(visibleEntries.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageEntries = visibleEntries.slice(currentPage * ROWS_PER_PAGE, (currentPage + 1) * ROWS_PER_PAGE);
  // Export always uses the complete selected course, independently of the table filters.
  const exportText = course ? buildVocabularyText(course.title, course.entries) : '';

  function selectCourse(id: string) {
    setParams({ course: id });
    setLessonId('');
    setQuery('');
    setPage(0);
    setCopyError(false);
  }

  async function copyCourse() {
    setCopying(true);
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(exportText);
      setCopiedText(exportText);
      showToast(`Скопійовано весь список: ${entries.length} слів і фраз`, 'success');
    } catch {
      setCopyError(true);
      exportRef.current?.focus();
      exportRef.current?.select();
      showToast('Не вдалося скопіювати. Виділіть текст нижче або завантажте TXT.', 'error');
    } finally {
      setCopying(false);
    }
  }

  function downloadCourse() {
    if (!course) return;
    try {
      const url = URL.createObjectURL(new Blob([exportText], { type: 'text/plain;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = vocabularyFileName(course.title);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showToast('Не вдалося завантажити файл. Скопіюйте текст зі списку нижче.', 'error');
    }
  }

  return <div>
    <PageHeader title="Словник курсів" description="Усі додані слова й фрази кожного курсу — для повторення та нагадувань у чаті." actions={<Button variant="secondary" size="sm" disabled={loading} onClick={() => setReload(value => value + 1)}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Оновити</Button>} />

    {loading ? <Card className="text-center py-14" role="status"><BookOpen size={28} className="mx-auto mb-3 text-lavender-400" /><p className="font-bold">Завантажуємо повний словник…</p><p className="mt-2 text-sm text-ink-400">Завантажено карток: {loadedCards}</p></Card>
      : error ? <Card className="border-blush-200" role="alert"><div className="flex gap-3"><AlertCircle size={22} className="shrink-0 text-blush-500" /><div><h2 className="font-bold">Не вдалося завантажити словник</h2><p className="mt-1 text-sm text-ink-600 break-words">{error}</p><Button className="mt-4" size="sm" onClick={() => setReload(value => value + 1)}>Спробувати ще раз</Button></div></div></Card>
      : courses.length === 0 ? <EmptyState icon={<BookOpen size={28} />} title="Курсів і карток поки немає. Додайте курс та слова до його уроків." />
      : <>
        <Card className="mb-5">
          <label htmlFor="vocabulary-course" className="mb-2 block text-sm font-bold">Курс</label>
          <select id="vocabulary-course" className="field" value={course?.id || ''} onChange={event => selectCourse(event.target.value)}>
            <option value="" disabled>Оберіть курс</option>
            {courses.map(item => <option key={item.id} value={item.id}>{item.title} · {item.entries.length} слів і фраз · {item.cardCount} карток</option>)}
          </select>
          {!!data?.unassigned.cardCount && !unassigned && <p className="mt-3 text-sm text-ink-600">Ще {data.unassigned.cardCount} карток без визначеного курсу. <button onClick={() => selectCourse(UNASSIGNED_COURSE_ID)} className="font-bold text-lavender-600 underline underline-offset-2">Переглянути</button></p>}
        </Card>

        {!course ? <EmptyState icon={<BookOpen size={28} />} title="Цей курс не знайдено. Оберіть курс зі списку." /> : <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {[['Слів і фраз без повторів', entries.length], ['Карток загалом', course.cardCount], ['Уроків у курсі', unassigned ? '—' : course.lessons.length]].map(([label, value]) => <Card key={label} className="py-4"><p className="text-sm text-ink-400">{label}</p><p className="mt-1 text-2xl font-extrabold text-lavender-600">{value}</p></Card>)}
          </div>
          {unassigned && <Card tone="accent" className="mb-5 text-sm text-ink-600">Ці картки не мають уроку, або їхній урок не пов’язаний з доступним курсом. Рівень картки сам по собі не визначає курс.</Card>}

          <Card tone="accent" className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><h2 className="text-lg font-bold">Список для чату</h2><p className="mt-1 text-sm text-ink-600">{unassigned ? 'Копіювання й TXT містять увесь цей список.' : 'Копіювання й TXT містять увесь курс.'} Пошук і фільтр уроку не скорочують його.</p></div>
              <div className="flex flex-wrap gap-2"><Button size="sm" disabled={!entries.length || copying} onClick={copyCourse}>{copiedText === exportText && exportText ? <Check size={17} /> : <Copy size={17} />}{copying ? 'Копіюємо…' : unassigned ? 'Копіювати весь список' : 'Копіювати весь курс'}</Button><Button variant="secondary" size="sm" disabled={!entries.length} onClick={downloadCourse}><Download size={17} />Завантажити TXT</Button></div>
            </div>
            {entries.length > 0 && <details className="mt-4" open={copyError || undefined}><summary className="cursor-pointer text-sm font-bold text-lavender-700">Переглянути повний текст ({entries.length})</summary>{copyError && <p className="mt-3 text-sm text-blush-700" role="alert">Доступ до буфера обміну недоступний. Натисніть «Виділити текст» і скопіюйте його вручну.</p>}<label htmlFor="vocabulary-export" className="sr-only">Повний список слів для копіювання</label><textarea id="vocabulary-export" ref={exportRef} readOnly value={exportText} className="field mt-3 min-h-48 font-mono text-sm" /><Button size="sm" variant="secondary" className="mt-2" onClick={() => { exportRef.current?.focus(); exportRef.current?.select(); }}>Виділити текст</Button></details>}
          </Card>

          <div className="mb-4 flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><label htmlFor="vocabulary-search" className="sr-only">Пошук слова або перекладу</label><input id="vocabulary-search" className="field pl-10" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Слово, переклад або форма дієслова" /></div>
            {!unassigned && <><label htmlFor="vocabulary-lesson" className="sr-only">Фільтр за уроком</label><select id="vocabulary-lesson" className="field md:max-w-sm" value={activeLessonId} onChange={event => { setLessonId(event.target.value); setPage(0); }}><option value="">Усі уроки ({course.lessons.length})</option>{course.lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title || 'Урок без назви'}</option>)}</select></>}
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="border-b border-lavender-100 px-5 py-3 text-sm text-ink-400" aria-live="polite">Знайдено: {visibleEntries.length} із {entries.length} слів і фраз</div>
            {entries.length === 0 ? <div className="p-5"><EmptyState icon={<BookOpen size={28} />} title="У цьому курсі ще немає слів. Додайте картки до його уроків." />{!unassigned && <Link to={`/courses/${course.id}`} className={buttonClass('secondary', 'sm', 'mt-4')}>До уроків курсу</Link>}</div>
              : visibleEntries.length === 0 ? <EmptyState icon={<Search size={28} />} title="За цим запитом слів не знайдено. Спробуйте інший пошук або урок." />
                : <div className="overflow-x-auto"><table className="w-full table-fixed text-sm"><thead className="bg-paper-100 text-left text-ink-400"><tr><th className="w-72 px-5 py-3">Слово / форми дієслова</th><th className="w-56 px-5 py-3">Переклад</th><th className="w-64 px-5 py-3">Уроки</th><th className="w-24 px-5 py-3 text-right">Карток</th></tr></thead><tbody className="divide-y divide-lavender-100">{pageEntries.map(entry => <tr key={entry.key} className="hover:bg-lavender-50/50"><td className="break-words px-5 py-4"><div className="space-y-1 font-bold">{entry.english.length ? entry.english.map(variant => <p key={variant}>{variant}</p>) : 'Без слова'}</div>{entry.transcriptions.length > 0 && <p className="mt-1 text-xs text-ink-400">{entry.transcriptions.join(' / ')}</p>}</td><td className="break-words px-5 py-4 text-ink-600">{entry.translations.join('; ') || '—'}</td><td className="break-words px-5 py-4"><div className="flex flex-col gap-2">{entry.origins.length ? entry.origins.map(origin => unassigned ? <span key={origin.lessonId} className="text-ink-400">{origin.title}</span> : <Link key={origin.lessonId} to={`/courses/${course.id}/lessons/${origin.lessonId}`} className="text-lavender-600 hover:underline">{origin.title}</Link>) : <span className="text-ink-400">Без уроку</span>}</div></td><td className="px-5 py-4 text-right text-ink-400">{entry.cardCount}</td></tr>)}</tbody></table></div>}
            {pageCount > 1 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-lavender-100 px-5 py-3"><span className="text-sm text-ink-400">Сторінка {currentPage + 1} з {pageCount}</span><div className="flex gap-2"><Button variant="secondary" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label="Попередня сторінка"><ChevronLeft size={17} />Назад</Button><Button variant="secondary" size="sm" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)} aria-label="Наступна сторінка">Далі<ChevronRight size={17} /></Button></div></div>}
          </Card>
        </>}
      </>}
  </div>;
}
