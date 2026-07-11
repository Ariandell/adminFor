import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Plus, Video, Volume2, ChevronRight, ImageIcon } from 'lucide-react';

export default function CourseDetailsPage() {
  const { courseId } = useParams();
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

  if (!course) return <div className="text-muted-foreground py-8">Завантаження…</div>;

  return (
    <div>
      <Link to="/" className="inline-flex items-center text-[15px] text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft size={17} className="mr-1.5" /> Курси
      </Link>

      <div className="bg-card p-6 rounded-2xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-10 flex items-center gap-6">
        <div className="w-24 h-24 bg-muted rounded-2xl overflow-hidden shrink-0 flex items-center justify-center">
          {course.image_uncolored_url ? (
            <img src={course.image_uncolored_url || "/placeholder.svg"} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={28} className="text-muted-foreground/50" />
          )}
        </div>
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight leading-tight mb-2">{course.title}</h1>
          <div className="flex gap-2 text-sm">
            <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground font-medium">{course.level}</span>
            <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground font-medium">{course.total_lessons} уроків</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Уроки</h2>
          <span className="text-sm text-muted-foreground">{lessons.length}</span>
        </div>
        <Link
          to={`/courses/${courseId}/lessons/new`}
          className="bg-accent text-accent-foreground px-4 py-2.5 rounded-xl text-[15px] font-medium hover:bg-accent-hover active:scale-[0.98] transition-all duration-200 flex items-center"
        >
          <Plus size={18} className="mr-1.5" /> Додати урок
        </Link>
      </div>

      <div className="space-y-3">
        {lessons.map((lesson, index) => (
          <Link
            key={lesson.id}
            to={`/courses/${courseId}/lessons/${lesson.id}`}
            className="group flex items-center gap-4 bg-card p-4 rounded-2xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground shrink-0">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[16px] tracking-tight truncate">{lesson.title}</h3>
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                {lesson.video_url && <span className="inline-flex items-center gap-1"><Video size={13} /> Відео</span>}
                {lesson.audio_url && <span className="inline-flex items-center gap-1"><Volume2 size={13} /> Аудіо</span>}
              </div>
            </div>
            <ChevronRight size={20} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
          </Link>
        ))}
        {lessons.length === 0 && (
          <div className="bg-card p-16 rounded-2xl border border-dashed border-border text-center text-muted-foreground">
            У цьому курсі ще немає уроків
          </div>
        )}
      </div>
    </div>
  );
}
