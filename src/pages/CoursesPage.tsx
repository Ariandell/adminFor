import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { ImageIcon, ChevronRight } from 'lucide-react';
import ImageDropZone from '../components/ImageDropZone';

export default function CoursesPage() {
  const { showToast } = useToast();
  const [courses, setCourses] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState('BEGINNER 1');
  const [totalLessons, setTotalLessons] = useState(10);

  const [uncoloredFile, setUncoloredFile] = useState<File | null>(null);
  const [coloredFile, setColoredFile] = useState<File | null>(null);

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

  async function createCourse(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      let uncoloredUrl = null;
      let coloredUrl = null;

      if (uncoloredFile) {
        uncoloredUrl = await uploadImage(uncoloredFile, `uncolored/${Date.now()}_${uncoloredFile.name}`);
      }
      if (coloredFile) {
        coloredUrl = await uploadImage(coloredFile, `colored/${Date.now()}_${coloredFile.name}`);
      }

      const { error } = await supabase.from('courses').insert([
        {
          title,
          level,
          total_lessons: totalLessons,
          image_uncolored_url: uncoloredUrl,
          image_colored_url: coloredUrl
        }
      ]);

      if (error) throw error;

      showToast('Курс створено', 'success');
      fetchCourses();

      setTitle('');
      setUncoloredFile(null);
      setColoredFile(null);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground/70 transition';
  const labelClass = 'block text-[13px] font-medium text-muted-foreground mb-1.5';

  return (
    <div>
      <header className="mb-10">
        <h1 className="text-[34px] font-semibold tracking-tight leading-tight">Курси</h1>
        <p className="text-muted-foreground mt-1 text-[15px]">Створюйте та керуйте навчальними курсами</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* Form Section */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 lg:sticky lg:top-12">
          <h2 className="text-lg font-semibold mb-5 tracking-tight">Новий курс</h2>
          <form onSubmit={createCourse} className="space-y-4">
            <div>
              <label className={labelClass}>Назва</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} type="text" placeholder="Назва курсу" className={inputClass} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Рівень</label>
                <input required value={level} onChange={e => setLevel(e.target.value)} type="text" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Уроків</label>
                <input required value={totalLessons} onChange={e => setTotalLessons(Number(e.target.value))} type="number" min="1" className={inputClass} />
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-[13px] text-muted-foreground mb-3">Обкладинки курсу</p>
              <div className="grid grid-cols-2 gap-3">
                <ImageDropZone label="Чорно-біла" file={uncoloredFile} onChange={setUncoloredFile} compact />
                <ImageDropZone label="Кольорова" file={coloredFile} onChange={setColoredFile} compact />
              </div>
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-accent text-accent-foreground font-medium py-3 rounded-xl mt-2 hover:bg-accent-hover active:scale-[0.99] disabled:opacity-50 transition-all duration-200"
            >
              {loading ? 'Створення…' : 'Додати курс'}
            </button>
          </form>
        </div>

        {/* List Section */}
        <div className="lg:col-span-3">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-semibold tracking-tight">Усі курси</h2>
            <span className="text-sm text-muted-foreground">{courses.length}</span>
          </div>
          <div className="space-y-3">
            {courses.map(course => (
              <Link
                key={course.id}
                to={`/courses/${course.id}`}
                className="group flex gap-4 items-center bg-card p-3.5 rounded-2xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="w-16 h-16 bg-muted rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                  {course.image_uncolored_url ? (
                    <img src={course.image_uncolored_url || "/placeholder.svg"} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={22} className="text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[17px] leading-tight tracking-tight truncate">{course.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{course.level} · {course.total_lessons} уроків</p>
                </div>
                <ChevronRight size={20} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
              </Link>
            ))}
            {courses.length === 0 && (
              <div className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
                Курсів ще немає
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
