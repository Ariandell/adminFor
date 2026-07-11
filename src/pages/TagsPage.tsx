import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Trash2 } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function TagsPage() {
  const { showToast } = useToast();
  const [tags, setTags] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  async function fetchTags() {
    const { data, error } = await supabase.from('tags').select('*').order('created_at', { ascending: false });
    if (error) console.error(error);
    else setTags(data || []);
  }

  async function createTag(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    
    try {
      const { error } = await supabase.from('tags').insert([{ name: name.trim() }]);
      if (error) throw error;
      
      setName('');
      fetchTags();
    } catch (error: any) {
      showToast('Помилка: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function deleteTag(id: string) {
    if (!confirm('Видалити цей тег?')) return;
    try {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
      fetchTags();
    } catch (error: any) {
      showToast('Помилка: ' + error.message, 'error');
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Управління тегами</h1>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <h2 className="text-xl font-semibold mb-4">Створити новий тег</h2>
        <form onSubmit={createTag} className="flex gap-4">
          <input
            required
            value={name}
            onChange={e => setName(e.target.value)}
            type="text"
            placeholder="Наприклад: Їжа, Тварини..."
            className="flex-1 border rounded-lg p-2"
          />
          <button disabled={loading} type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
            Додати
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold mb-4">Існуючі теги ({tags.length})</h2>
        <div className="flex flex-wrap gap-3">
          {tags.map(tag => (
            <div key={tag.id} className="bg-gray-100 px-4 py-2 rounded-full flex items-center gap-2 group">
              <span className="text-gray-800">{tag.name}</span>
              <button onClick={() => deleteTag(tag.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {tags.length === 0 && (
            <p className="text-gray-500 w-full">Тегів ще немає</p>
          )}
        </div>
      </div>
    </div>
  );
}
