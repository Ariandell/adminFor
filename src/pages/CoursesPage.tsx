import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, ImageIcon, BookOpen } from 'lucide-react';
import { useToast } from '../components/Toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import EmptyState from '../components/ui/EmptyState';
import FileDropzone from '../components/ui/FileDropzone';
import PageHeader from '../components/ui/PageHeader';

export default function CoursesPage() {
  const { showToast } = useToast();
  const [courses, setCourses] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState('BEGINNER 1');
  const [totalLessons, setTotalLessons] = useState(10);
  const [courseType, setCourseType] = useState('main');
  const [accessTier, setAccessTier] = useState('free');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [published, setPublished] = useState(false);

  const [uncoloredFile, setUncoloredFile] = useState<File | null>(null);
  const [coloredFile, setColoredFile] = useState<File | null>(null);

  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  async function fetchCourses() {
    const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: true });
    if (error) console.error(error);
    else setCourses(data || []);
  }

  async function uploadImage(file: File, path: string) {
    const { error } = await supabase.storage.from('course-images').upload(path, file);
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from('course-images').getPublicUrl(path);
    return publicUrl;
  }

  function resetForm() {
    setEditingCourse(null);
    setTitle('');
    setLevel('BEGINNER 1');
    setTotalLessons(10);
    setCourseType('main');
    setAccessTier('free');
    setDescription('');
    setPrice('');
    setPublished(false);
    setUncoloredFile(null);
    setColoredFile(null);
  }

  function startEditCourse(course: any) {
    setEditingCourse(course);
    setTitle(course.title);
    setLevel(course.level);
    setTotalLessons(course.total_lessons);
    setCourseType(course.course_type || 'main');
    setAccessTier(course.access_tier || 'free');
    setDescription(course.description || '');
    setPrice(course.price == null ? '' : String(course.price));
    setPublished(!!course.is_published);
    setUncoloredFile(null);
    setColoredFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveCourse(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      let uncoloredUrl = editingCourse?.image_uncolored_url ?? null;
      let coloredUrl = editingCourse?.image_colored_url ?? null;

      if (uncoloredFile) {
        uncoloredUrl = await uploadImage(uncoloredFile, `uncolored/${Date.now()}_${uncoloredFile.name}`);
      }
      if (coloredFile) {
        coloredUrl = await uploadImage(coloredFile, `colored/${Date.now()}_${coloredFile.name}`);
      }

      const courseData = {
        title,
        level,
        total_lessons: totalLessons,
        course_type: courseType,
        access_tier: accessTier,
        description: description || null,
        price: accessTier === 'purchase' && price ? Number(price) : null,
        is_published: published,
        image_uncolored_url: uncoloredUrl,
        image_colored_url: coloredUrl
      };

      if (editingCourse) {
        const { error } = await supabase.from('courses').update(courseData).eq('id', editingCourse.id);
        if (error) throw error;
        showToast('Курс оновлено!', 'success');
      } else {
        const { error } = await supabase.from('courses').insert([courseData]);
        if (error) throw error;
        showToast('Курс успішно створено!', 'success');
      }

      fetchCourses();
      resetForm();
    } catch (error: any) {
      showToast('Помилка: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function deleteCourse(course: any) {
    if (!confirm(`Видалити курс «${course.title}» разом з усіма його уроками, тестами та картками? Цю дію не можна скасувати.`)) return;
    setLoading(true);
    try {
      const { data: lessonRows, error: lessonsError } = await supabase.from('lessons').select('id').eq('course_id', course.id);
      if (lessonsError) throw lessonsError;
      const lessonIds = (lessonRows || []).map(l => l.id);

      if (lessonIds.length > 0) {
        const { data: cardRows, error: cardsError } = await supabase.from('cards').select('id').in('lesson_id', lessonIds);
        if (cardsError) throw cardsError;
        const cardIds = (cardRows || []).map(c => c.id);

        if (cardIds.length > 0) {
          const { error: tagsError } = await supabase.from('card_tags').delete().in('card_id', cardIds);
          if (tagsError) throw tagsError;
          const { error: delCardsError } = await supabase.from('cards').delete().in('id', cardIds);
          if (delCardsError) throw delCardsError;
        }

        const { error: delLessonsError } = await supabase.from('lessons').delete().in('id', lessonIds);
        if (delLessonsError) throw delLessonsError;
      }

      const { error } = await supabase.from('courses').delete().eq('id', course.id);
      if (error) throw error;

      showToast('Курс видалено', 'success');
      if (editingCourse?.id === course.id) resetForm();
      fetchCourses();
    } catch (error: any) {
      showToast('Помилка: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Курси" description="Основні та додаткові навчальні програми" />
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8">
      {/* Form Section */}
      <Card tone={editingCourse ? 'accent' : 'default'} className="h-fit">
        <h2 className="text-2xl font-bold mb-6">{editingCourse ? `Редагувати: ${editingCourse.title}` : 'Створити новий курс'}</h2>
        <form onSubmit={saveCourse} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-600 mb-1">Назва курсу</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} type="text" placeholder="Наприклад: Англійська" className="w-full border border-lavender-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-lavender-300" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-600 mb-1">Рівень</label>
              <input required value={level} onChange={e => setLevel(e.target.value)} type="text" className="w-full border border-lavender-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-lavender-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-600 mb-1">Всього уроків</label>
              <input required value={totalLessons} onChange={e => setTotalLessons(Number(e.target.value))} type="number" min="1" className="w-full border border-lavender-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-lavender-300" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-600 mb-1">Опис</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="field min-h-20" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-600 mb-1">Розділ</label>
              <select value={courseType} onChange={e => setCourseType(e.target.value)} className="field"><option value="main">Основний курс</option><option value="additional">Додатковий курс</option></select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-600 mb-1">Доступ</label>
              <select value={accessTier} onChange={e => setAccessTier(e.target.value)} className="field"><option value="free">Безкоштовно</option><option value="basic">Basic</option><option value="premium">Premium</option><option value="purchase">Окрема покупка</option></select>
            </div>
          </div>
          {accessTier === 'purchase' && <div><label className="block text-sm font-medium text-ink-600 mb-1">Ціна</label><input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="field" /></div>}
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} className="accent-lavender-500" />Опубліковано</label>

          <div className="pt-4 border-t border-lavender-100 space-y-4">
            <FileDropzone
              label="Чорно-біле фото"
              file={uncoloredFile}
              currentUrl={editingCourse?.image_uncolored_url}
              onChange={setUncoloredFile}
              hint={editingCourse?.image_uncolored_url ? 'поточне збережеться' : undefined}
            />
            <FileDropzone
              label="Кольорове фото"
              file={coloredFile}
              currentUrl={editingCourse?.image_colored_url}
              onChange={setColoredFile}
              hint={editingCourse?.image_colored_url ? 'поточне збережеться' : undefined}
            />
          </div>

          <div className="flex gap-3 mt-6">
            <Button disabled={loading} type="submit" className="flex-1">
              {loading ? 'Збереження...' : editingCourse ? 'Зберегти зміни' : 'Додати курс'}
            </Button>
            {editingCourse && (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Скасувати
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* List Section */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Існуючі курси ({courses.length})</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {courses.map(course => (
            <Card key={course.id} className="p-4 hover:border-lavender-300 hover:shadow-cozy-lg transition flex flex-col gap-3">
              <Link to={`/courses/${course.id}`} className="flex gap-4 items-center min-w-0">
                <div className="w-16 h-16 bg-paper-100 rounded-xl overflow-hidden shrink-0">
                  {course.image_uncolored_url ? (
                    <img src={course.image_uncolored_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lavender-300"><ImageIcon size={22} /></div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-lg leading-tight text-lavender-600 truncate">{course.title}</h3>
                  <p className="text-sm text-ink-400 mt-1">{course.level}</p>
                  <p className="text-sm text-ink-400">{course.total_lessons} уроків загалом</p>
                  <div className="flex gap-2 mt-2"><span className="text-xs rounded-full bg-lavender-100 text-lavender-700 px-2 py-0.5">{course.course_type === 'additional' ? 'Додатковий' : 'Основний'}</span><span className="text-xs rounded-full bg-mint-100 text-mint-700 px-2 py-0.5">{course.access_tier || 'free'}</span></div>
                </div>
              </Link>
              <div className="flex gap-2 justify-end border-t border-lavender-100 pt-2 -mx-1">
                <IconButton onClick={() => startEditCourse(course)} title="Редагувати курс">
                  <Pencil size={18} />
                </IconButton>
                <IconButton variant="danger" onClick={() => deleteCourse(course)} title="Видалити курс">
                  <Trash2 size={18} />
                </IconButton>
              </div>
            </Card>
          ))}
          {courses.length === 0 && (
            <div className="sm:col-span-2">
              <EmptyState icon={<BookOpen size={28} />} title="Курсів ще немає — створіть перший зліва" />
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
