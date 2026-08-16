import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronRight, Pencil, Trash2, Tags as TagsIcon } from 'lucide-react';
import { useToast } from '../components/Toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import EmptyState from '../components/ui/EmptyState';
import Badge, { pastelFor } from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';

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
  const [editingId, setEditingId] = useState<string | null>(null);
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

  async function saveTag(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    try {
      const duplicate = tags.find(tag => tag.id !== editingId && tag.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());
      if (duplicate) throw new Error('Такий тег уже існує');
      const { error } = editingId
        ? await supabase.from('tags').update({ name: name.trim() }).eq('id', editingId)
        : await supabase.from('tags').insert([{ name: name.trim() }]);
      if (error) throw error;

      setName('');
      setEditingId(null);
      fetchTags();
    } catch (error: any) {
      showToast('Помилка: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function editTag(tag: any) {
    setEditingId(tag.id);
    setName(tag.name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div>
      <PageHeader title="Теги" description="Групуйте слова й швидко знаходьте пов’язані картки" />
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8">
      <Card className="h-fit">
        <h2 className="text-xl font-semibold mb-4">{editingId ? 'Редагувати тег' : 'Новий тег'}</h2>
        <form onSubmit={saveTag} className="flex flex-col gap-3">
          <input
            required
            value={name}
            onChange={e => setName(e.target.value)}
            type="text"
            placeholder="Наприклад: Їжа, Тварини..."
            className="field"
          />
          <Button disabled={loading} type="submit">
            {editingId ? 'Зберегти' : 'Додати'}
          </Button>
          {editingId && <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setName(''); }}>Скасувати</Button>}
        </form>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4">Існуючі теги ({tags.length})</h2>
        <div className="space-y-3">
          {tags.map(tag => {
            const isOpen = expandedTagId === tag.id;
            const words = wordsByTag[tag.id];
            const count = tagCounts[tag.id] ?? 0;
            const hue = pastelFor(tag.name);

            return (
              <Card key={tag.id} className="p-0 overflow-hidden">
                <div className="flex items-center justify-between">
                  <button onClick={() => toggleTag(tag.id)} className="flex-1 flex items-center gap-3 px-4 py-3 text-left">
                    <ChevronRight size={16} className={`text-ink-400 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                    <Badge label={tag.name} seed={tag.name} />
                    <span className="text-xs text-ink-400">{count} {wordsLabel(count)}</span>
                  </button>
                  <IconButton onClick={() => editTag(tag)} title="Редагувати тег">
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton variant="danger" onClick={() => deleteTag(tag.id)} className="mr-2">
                    <Trash2 size={16} />
                  </IconButton>
                </div>

                {isOpen && (
                  <div className={`border-t border-lavender-100 px-4 py-3 ${hue.bg}`}>
                    {loadingTagId === tag.id && (
                      <p className="text-sm text-ink-400">Завантаження слів...</p>
                    )}
                    {loadingTagId !== tag.id && words && words.length === 0 && (
                      <p className="text-sm text-ink-400">До цього тега ще не прив'язано жодного слова</p>
                    )}
                    {loadingTagId !== tag.id && words && words.length > 0 && (
                      <ul className="space-y-2">
                        {words.map(card => (
                          <li key={card.id} className="flex items-center justify-between gap-4 bg-white rounded-lg px-3 py-2 border border-lavender-100">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 bg-paper-100 rounded-md overflow-hidden shrink-0">
                                {card.image_color_url && (
                                  <img src={card.image_color_url} alt="" className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold">{card.original_word}</span>
                                <span className="text-ink-600"> — {card.translation}</span>
                              </div>
                            </div>
                            <span className="text-xs text-ink-400 shrink-0 text-right">
                              {card.lessons?.courses?.title}
                              {card.lessons?.title ? ` / ${card.lessons.title}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
          {tags.length === 0 && (
            <EmptyState icon={<TagsIcon size={28} />} title="Тегів ще немає" />
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
