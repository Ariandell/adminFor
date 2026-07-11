import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { X, Plus } from 'lucide-react';
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
      showToast(error.message, 'error');
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
      showToast(error.message, 'error');
    }
  }

  return (
    <div className="max-w-2xl">
      <header className="mb-10">
        <h1 className="text-[34px] font-semibold tracking-tight leading-tight">Теги</h1>
        <p className="text-muted-foreground mt-1 text-[15px]">Категорії для карток зі словами</p>
      </header>

      <div className="bg-card p-6 rounded-2xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-8">
        <form onSubmit={createTag} className="flex gap-3">
          <input
            required
            value={name}
            onChange={e => setName(e.target.value)}
            type="text"
            placeholder="Наприклад, Їжа або Тварини"
            className="flex-1 rounded-xl border border-input bg-card px-3.5 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground/70 transition"
          />
          <button
            disabled={loading}
            type="submit"
            className="bg-accent text-accent-foreground px-5 py-2.5 rounded-xl text-[15px] font-medium hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 transition-all duration-200 flex items-center gap-1.5"
          >
            <Plus size={18} /> Додати
          </button>
        </form>
      </div>

      <div className="bg-card p-6 rounded-2xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Усі теги</h2>
          <span className="text-sm text-muted-foreground">{tags.length}</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {tags.map(tag => (
            <div key={tag.id} className="bg-muted pl-4 pr-2.5 py-1.5 rounded-full flex items-center gap-2 group hover:bg-border/50 transition-colors">
              <span className="text-[15px] text-foreground">{tag.name}</span>
              <button
                onClick={() => deleteTag(tag.id)}
                className="text-muted-foreground/60 hover:text-destructive w-5 h-5 flex items-center justify-center rounded-full hover:bg-destructive-soft transition-colors"
                aria-label={`Видалити тег ${tag.name}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {tags.length === 0 && (
            <p className="text-muted-foreground w-full text-center py-8">Тегів ще немає</p>
          )}
        </div>
      </div>
    </div>
  );
}
