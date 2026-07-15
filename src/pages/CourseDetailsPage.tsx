import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Plus, Pencil, Trash2, Video, Music, ImageIcon } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function CourseDetailsPage() {
  const { courseId } = useParams();
  const { showToast } = useToast();
  const [course, setCourse] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId]);

  async function fetchCourseData() {
    const { data: courseData, error: courseError } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (courseError) {
      console.error(courseError);
      return;
    }
    setCourse(courseData);

    const { data: lessonsData, error: lessonsError } = await supabase.from('lessons').select('*').eq('course_id', courseId).order('created_at', { ascending: true });
    if (lessonsError) {
      console.error(lessonsError);
    } else {
      setLessons(lessonsData || []);
    }
  }

  async function deleteLesson(lesson: any) {
    if (!confirm(`Видалити урок «${lesson.title}» разом з його тестами та картками? Цю дію не можна скасувати.`)) return;
    try {
      const { data: cardRows, error: cardsError } = await supabase.from('cards').select('id').eq('lesson_id', lesson.id);
      if (cardsError) throw cardsError;
      const cardIds = (cardRows || []).map(c => c.id);

      if (cardIds.length > 0) {
        const { error: tagsError } = await supabase.from('card_tags').delete().in('card_id', cardIds);
        if (tagsError) throw tagsError;
        const { error: delCardsError } = await supabase.from('cards').delete().in('id', cardIds);
        if (delCardsError) throw delCardsError;
      }

      const { error } = await supabase.from('lessons').delete().eq('id', lesson.id);
      if (error) throw error;

      showToast('Урок видалено', 'success');
      fetchCourseData();
    } catch (error: any) {
      showToast('Помилка: ' + error.message, 'error');
    }
  }

  if (!course) return <div className="p-8">Завантаження...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6 font-medium">
        <ArrowLeft size={16} className="mr-2" /> Назад до курсів
      </Link>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8 flex items-center gap-6">
        <div className="w-24 h-24 bg-gray-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-gray-300">
          {course.image_uncolored_url ? <img src={course.image_uncolored_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={28} />}
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
          <div className="flex gap-4 text-gray-500">
            <span>Рівень: {course.level}</span>
            <span>Уроків загалом: {course.total_lessons}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Уроки ({lessons.length})</h2>
        <Link
          to={`/courses/${courseId}/lessons/new`}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center"
        >
          <Plus size={18} className="mr-2" /> Додати урок
        </Link>
      </div>

      <div className="space-y-4">
        {lessons.map((lesson, index) => (
          <div key={lesson.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 transition flex justify-between items-center gap-4">
            <Link to={`/courses/${courseId}/lessons/${lesson.id}`} className="flex-1 min-w-0">
              <h3 className="font-bold text-lg text-blue-600">Урок {index + 1}: {lesson.title}</h3>
              <div className="flex gap-3 mt-2 text-gray-400">
                {lesson.video_url && <Video size={16} aria-label="Має відео" />}
                {lesson.audio_url && <Music size={16} aria-label="Має аудіо" />}
              </div>
            </Link>
            <div className="flex gap-2 shrink-0">
              <Link to={`/courses/${courseId}/lessons/${lesson.id}`} title="Редагувати урок"
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                <Pencil size={18} />
              </Link>
              <button onClick={() => deleteLesson(lesson)} title="Видалити урок"
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
        {lessons.length === 0 && (
          <div className="bg-white p-8 rounded-xl border border-gray-100 text-center text-gray-500">
            У цьому курсі ще немає уроків.
          </div>
        )}
      </div>
    </div>
  );
}
