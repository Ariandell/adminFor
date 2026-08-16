import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Pencil, Plus, Search, Trash2, X, Tags as TagsIcon } from 'lucide-react';
import { useToast } from '../components/Toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import EmptyState from '../components/ui/EmptyState';
import { pastelFor } from '../components/ui/Badge';
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
  const [query, setQuery] = useState('');
  const [isComposerOpen, setIsComposerOpen] = useState(false);

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
      setIsComposerOpen(false);
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
    setIsComposerOpen(true);
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

  const filteredTags = tags
    .filter(tag => tag.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  const selectedTag = tags.find(tag => tag.id === expandedTagId);
  const selectedHue = selectedTag ? pastelFor(selectedTag.name) : null;
  const selectedWords = expandedTagId ? wordsByTag[expandedTagId] : undefined;

  return (
    <div>
      <PageHeader
        title="Теги"
        description="Групуйте слова й швидко знаходьте пов’язані картки"
        actions={<Button size="sm" onClick={() => { setEditingId(null); setName(''); setIsComposerOpen(true); }}><Plus size={16} /> Додати тег</Button>}
      />

      <section className="max-w-5xl">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-bold text-ink">Усі теги</h2>
            <span className="text-sm text-ink-400">{tags.length}</span>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Пошук тегів"
              className="field w-full py-2 pl-9 pr-9"
            />
            {query && <button type="button" onClick={() => setQuery('')} title="Очистити пошук" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:bg-paper-200 hover:text-ink"><X size={16} /></button>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {filteredTags.map(tag => {
            const isOpen = expandedTagId === tag.id;
            const count = tagCounts[tag.id] ?? 0;
            const hue = pastelFor(tag.name);

            return (
              <div key={tag.id} className={`group inline-flex items-center rounded-full border bg-white/75 py-1 pl-1.5 pr-1 shadow-sm transition ${isOpen ? `${hue.border} ring-2 ring-lavender-100` : 'border-lavender-100 hover:border-lavender-200 hover:shadow-cozy-sm'}`}>
                <button type="button" onClick={() => toggleTag(tag.id)} className="flex items-center gap-2 rounded-full px-2 py-1 text-left">
                  <span className={`h-2 w-2 rounded-full ${hue.dot}`} />
                  <span className="text-sm font-semibold text-ink">{tag.name}</span>
                  <span className="text-xs tabular-nums text-ink-400">{count}</span>
                </button>
                <div className="ml-0.5 flex items-center opacity-60 transition group-hover:opacity-100">
                  <IconButton onClick={() => editTag(tag)} title="Редагувати тег" className="p-1.5"><Pencil size={14} /></IconButton>
                  <IconButton variant="danger" onClick={() => deleteTag(tag.id)} title="Видалити тег" className="p-1.5"><Trash2 size={14} /></IconButton>
                </div>
              </div>
            );
          })}
          {tags.length === 0 && (
            <EmptyState icon={<TagsIcon size={28} />} title="Тегів ще немає" className="w-full" />
          )}
          {tags.length > 0 && filteredTags.length === 0 && (
            <EmptyState icon={<Search size={28} />} title="Тегів за цим запитом не знайдено" className="w-full py-10" />
          )}
        </div>

        {selectedTag && selectedHue && (
          <section className="mt-9 border-t border-lavender-100 pt-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${selectedHue.dot}`} />
                <h2 className="text-lg font-bold text-ink">{selectedTag.name}</h2>
                <span className="text-sm text-ink-400">{tagCounts[selectedTag.id] ?? 0} {wordsLabel(tagCounts[selectedTag.id] ?? 0)}</span>
              </div>
              <IconButton onClick={() => setExpandedTagId(null)} title="Закрити"><X size={18} /></IconButton>
            </div>
            <Card className={`border-0 ${selectedHue.bg}`}>
              {loadingTagId === selectedTag.id && <p className="text-sm text-ink-400">Завантаження слів...</p>}
              {loadingTagId !== selectedTag.id && selectedWords && selectedWords.length === 0 && <p className="text-sm text-ink-400">До цього тега ще не прив'язано жодного слова</p>}
              {loadingTagId !== selectedTag.id && selectedWords && selectedWords.length > 0 && (
                <ul className="grid gap-2 md:grid-cols-2">
                  {selectedWords.map(card => (
                    <li key={card.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/70 bg-white/85 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-paper-100">
                          {card.image_color_url && <img src={card.image_color_url} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <div className="min-w-0"><span className="font-semibold">{card.original_word}</span><span className="text-ink-600"> — {card.translation}</span></div>
                      </div>
                      <span className="shrink-0 text-right text-xs text-ink-400">{card.lessons?.courses?.title}{card.lessons?.title ? ` / ${card.lessons.title}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        )}
      </section>

      {isComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Закрити" onClick={() => { setIsComposerOpen(false); setEditingId(null); setName(''); }} className="absolute inset-0 bg-ink/20 backdrop-blur-sm" />
          <Card className="relative z-10 w-full max-w-md p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">{editingId ? 'Редагувати тег' : 'Новий тег'}</h2><IconButton onClick={() => { setIsComposerOpen(false); setEditingId(null); setName(''); }} title="Закрити"><X size={18} /></IconButton></div>
            <form onSubmit={saveTag} className="flex gap-2">
              <input autoFocus required value={name} onChange={e => setName(e.target.value)} type="text" placeholder="Назва тега" className="field min-w-0 flex-1" />
              <Button disabled={loading} type="submit" size="sm">{editingId ? 'Зберегти' : 'Додати'}</Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
