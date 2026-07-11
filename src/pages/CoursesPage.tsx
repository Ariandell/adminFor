import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

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

      showToast('Курс успішно створено!', 'success');
      fetchCourses();
      
      setTitle('');
      setUncoloredFile(null);
      setColoredFile(null);
    } catch (error: any) {
      showToast('Помилка: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Form Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
        <h2 className="text-2xl font-bold mb-6">Створити новий курс</h2>
        <form onSubmit={createCourse} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Назва курсу</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} type="text" placeholder="ЯПОНСЬКА (日本語)" className="w-full border rounded-lg p-2" />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Чорно-біле фото (Uncolored)</label>
            <input type="file" accept="image/*" onChange={e => setUncoloredFile(e.target.files?.[0] || null)} className="w-full text-sm" />
          </div>

          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Кольорове фото (Colored)</label>
            <input type="file" accept="image/*" onChange={e => setColoredFile(e.target.files?.[0] || null)} className="w-full text-sm" />
          </div>

          <button disabled={loading} type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg mt-6 hover:bg-blue-700 disabled:opacity-50 transition">
            {loading ? 'Створення...' : 'Додати курс'}
          </button>
        </form>
      </div>

      {/* List Section */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Існуючі курси ({courses.length})</h2>
        <div className="space-y-4">
          {courses.map(course => (
            <Link key={course.id} to={`/courses/${course.id}`} className="block bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition flex gap-4 items-center">
              <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                {course.image_uncolored_url ? (
                  <img src={course.image_uncolored_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No image</div>
                )}
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight text-blue-600">{course.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{course.level}</p>
                <p className="text-sm text-gray-500">{course.total_lessons} уроків загалом</p>
              </div>
            </Link>
          ))}
          {courses.length === 0 && (
            <p className="text-gray-500 text-center py-8">Курсів ще немає</p>
          )}
        </div>
      </div>
    </div>
  );
}
