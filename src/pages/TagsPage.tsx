import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronRight, Trash2 } from 'lucide-react';
import { useToast } from '../components/Toast';

function wordsLabel(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'слово';
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'слова';
  return 'слів';
}

export default function TagsPage() {
  const { showToast } = useToast();
  const [tags, setTags] = useState<any[]>([]);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const [expandedTagId, setExpandedTagId] = useState<string | null>(null);
  const [wordsByTag, setWordsByTag] = useState<Record<string, any[]>>({});
  const [loadingTagId, setLoadingTagId] = useState<string | null>(null);

  useEffect(() => {
    fetchTags();
  }, []);

  async function fetchTags() {
    const { data, error } = await supabase.from('tags').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setTags(data || []);

    const { data: linkData, error: linkError } = await supabase.from('card_tags').select('tag_id');
    if (linkError) {
      console.error(linkError);
      return;
    }
    const counts: Record<string, number> = {};
    (linkData || []).forEach((row: any) => {
      counts[row.tag_id] = (counts[row.tag_id] || 0) + 1;
    });
    setTagCounts(counts);
  }

  async function fetchWordsForTag(tagId: string) {
    setLoadingTagId(tagId);
    try {
      const { data, error } = await supabase
        .from('card_tags')
        .select('cards(id, original_word, translation, image_color_url, lessons(title, courses(title)))')
        .eq('tag_id', tagId);
      if (error) throw error;

      const words = (data || [])
        .map((row: any) => row.cards)
        .filter(Boolean)
        .sort((a: any, b: any) => a.original_word.localeCompare(b.original_word));

      setWordsByTag(prev => ({ ...prev, [tagId]: words }));
    } catch (error: any) {
      showToast('Помилка завантаження слів: ' + error.message, 'error');
    } finally {
      setLoadingTagId(null);
    }
  }

  function toggleTag(tagId: string) {
    if (expandedTagId === tagId) {
      setExpandedTagId(null);
      return;
    }
    setExpandedTagId(tagId);
    if (!wordsByTag[tagId]) {
      fetchWordsForTag(tagId);
    }
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

      setWordsByTag(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (expandedTagId === id) setExpandedTagId(null);

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
        <div className="space-y-2">
          {tags.map(tag => {
            const isOpen = expandedTagId === tag.id;
            const words = wordsByTag[tag.id];
            const count = tagCounts[tag.id] ?? 0;

            return (
              <div key={tag.id} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between hover:bg-gray-50 transition">
                  <button onClick={() => toggleTag(tag.id)} className="flex-1 flex items-center gap-2 px-4 py-3 text-left">
                    <ChevronRight size={16} className={`text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                    <span className="font-medium text-gray-800">{tag.name}</span>
                    <span className="text-xs text-gray-400">{count} {wordsLabel(count)}</span>
                  </button>
                  <button onClick={() => deleteTag(tag.id)} className="text-gray-400 hover:text-red-500 px-4 py-3">
                    <Trash2 size={16} />
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    {loadingTagId === tag.id && (
                      <p className="text-sm text-gray-400">Завантаження слів...</p>
                    )}
                    {loadingTagId !== tag.id && words && words.length === 0 && (
                      <p className="text-sm text-gray-400">До цього тега ще не прив'язано жодного слова</p>
                    )}
                    {loadingTagId !== tag.id && words && words.length > 0 && (
                      <ul className="space-y-2">
                        {words.map(card => (
                          <li key={card.id} className="flex items-center justify-between gap-4 bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 bg-gray-100 rounded-md overflow-hidden shrink-0">
                                {card.image_color_url && (
                                  <img src={card.image_color_url} alt="" className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold">{card.original_word}</span>
                                <span className="text-gray-500"> — {card.translation}</span>
                              </div>
                            </div>
                            <span className="text-xs text-gray-400 shrink-0 text-right">
                              {card.lessons?.courses?.title}
                              {card.lessons?.title ? ` / ${card.lessons.title}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {tags.length === 0 && (
            <p className="text-gray-500 w-full">Тегів ще немає</p>
          )}
        </div>
      </div>
    </div>
  );
}
