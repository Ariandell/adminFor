import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, ImageIcon } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function CoursesPage() {
  const { showToast } = useToast();
  const [courses, setCourses] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState('BEGINNER 1');
  const [totalLessons, setTotalLessons] = useState(10);

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
    setUncoloredFile(null);
    setColoredFile(null);
  }

  function startEditCourse(course: any) {
    setEditingCourse(course);
    setTitle(course.title);
    setLevel(course.level);
    setTotalLessons(course.total_lessons);
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Form Section */}
      <div className={`p-6 rounded-2xl shadow-sm border h-fit ${editingCourse ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-gray-100'}`}>
        <h2 className="text-2xl font-bold mb-6">{editingCourse ? `Редагувати: ${editingCourse.title}` : 'Створити новий курс'}</h2>
        <form onSubmit={saveCourse} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Назва курсу</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} type="text" placeholder="Наприклад: Англійська" className="w-full border rounded-lg p-2" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Рівень</label>
              <input required value={level} onChange={e => setLevel(e.target.value)} type="text" className="w-full border rounded-lg p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Всього уроків</label>
              <input required value={totalLessons} onChange={e => setTotalLessons(Number(e.target.value))} type="number" min="1" className="w-full border rounded-lg p-2" />
            </div>
          </div>

          <div className="pt-4 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Чорно-біле фото
              {editingCourse?.image_uncolored_url && <span className="text-gray-400 font-normal"> · поточне збережеться</span>}
            </label>
            <input type="file" accept="image/*" onChange={e => setUncoloredFile(e.target.files?.[0] || null)} className="w-full text-sm" />
          </div>

          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Кольорове фото
              {editingCourse?.image_colored_url && <span className="text-gray-400 font-normal"> · поточне збережеться</span>}
            </label>
            <input type="file" accept="image/*" onChange={e => setColoredFile(e.target.files?.[0] || null)} className="w-full text-sm" />
          </div>

          <div className="flex gap-3 mt-6">
            <button disabled={loading} type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
              {loading ? 'Збереження...' : editingCourse ? 'Зберегти зміни' : 'Додати курс'}
            </button>
            {editingCourse && (
              <button type="button" onClick={resetForm} className="px-6 py-3 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 font-medium">
                Скасувати
              </button>
            )}
          </div>
        </form>
      </div>

      {/* List Section */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Існуючі курси ({courses.length})</h2>
        <div className="space-y-4">
          {courses.map(course => (
            <div key={course.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition flex gap-4 items-center">
              <Link to={`/courses/${course.id}`} className="flex gap-4 items-center flex-1 min-w-0">
                <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                  {course.image_uncolored_url ? (
                    <img src={course.image_uncolored_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={24} /></div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-lg leading-tight text-blue-600 truncate">{course.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{course.level}</p>
                  <p className="text-sm text-gray-500">{course.total_lessons} уроків загалом</p>
                </div>
              </Link>
              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={() => startEditCourse(course)} title="Редагувати курс"
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                  <Pencil size={18} />
                </button>
                <button onClick={() => deleteCourse(course)} title="Видалити курс"
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {courses.length === 0 && (
            <p className="text-gray-500 text-center py-8">Курсів ще немає</p>
          )}
        </div>
      </div>
    </div>
  );
}
