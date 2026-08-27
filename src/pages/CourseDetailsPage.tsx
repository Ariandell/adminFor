import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Plus, Pencil, Trash2, Video, Music, ImageIcon, GraduationCap } from 'lucide-react';
import { useToast } from '../components/Toast';
import Card from '../components/ui/Card';
import { buttonClass } from '../components/ui/Button';
import IconButton, { iconButtonClass } from '../components/ui/IconButton';
import EmptyState from '../components/ui/EmptyState';

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
    const { data: courseData, error: courseError } = await supabase.from('courses').select('*').eq('id', courseId).maybeSingle();
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

  if (!course) return <div className="p-8 text-ink-400">Завантаження...</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <Link to="/courses" className="inline-flex items-center text-lavender-600 hover:text-lavender-700 mb-6 font-semibold">
        <ArrowLeft size={16} className="mr-2" /> Назад до курсів
      </Link>

      <Card className="mb-8 flex items-center gap-6">
        <div className="w-24 h-24 bg-paper-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-lavender-300">
          {course.image_uncolored_url ? <img src={course.image_uncolored_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={28} />}
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-3">{course.title}</h1>
          <div className="flex gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full bg-mint-100 text-mint-700">
              Рівень: {course.level}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full bg-butter-100 text-butter-700">
              {course.total_lessons} уроків загалом
            </span>
          </div>
        </div>
      </Card>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Уроки ({lessons.length})</h2>
        <Link to={`/courses/${courseId}/lessons/new`} className={buttonClass('primary', 'sm')}>
          <Plus size={18} /> Додати урок
        </Link>
      </div>

      <div className="space-y-4">
        {lessons.map((lesson, index) => (
          <Card key={lesson.id} className="p-5 hover:border-lavender-300 hover:shadow-cozy-lg transition flex justify-between items-center gap-4">
            <Link to={`/courses/${courseId}/lessons/${lesson.id}`} className="flex-1 min-w-0">
              <h3 className="font-bold text-lg text-lavender-600">Урок {index + 1}: {lesson.title}</h3>
              <div className="flex gap-3 mt-2 text-ink-400">
                {lesson.video_url && <Video size={16} aria-label="Має відео" />}
                {lesson.audio_url && <Music size={16} aria-label="Має аудіо" />}
              </div>
            </Link>
            <div className="flex gap-2 shrink-0">
              <Link to={`/courses/${courseId}/lessons/${lesson.id}`} title="Редагувати урок" className={iconButtonClass()}>
                <Pencil size={18} />
              </Link>
              <IconButton variant="danger" onClick={() => deleteLesson(lesson)} title="Видалити урок">
                <Trash2 size={18} />
              </IconButton>
            </div>
          </Card>
        ))}
        {lessons.length === 0 && (
          <EmptyState icon={<GraduationCap size={28} />} title="У цьому курсі ще немає уроків." />
        )}
      </div>
    </div>
  );
}
