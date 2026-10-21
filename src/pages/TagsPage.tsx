import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ChevronDown, Pencil, Plus, RefreshCw, Search, Trash2, X, Tags as TagsIcon } from 'lucide-react';
import { useToast } from '../components/Toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import EmptyState from '../components/ui/EmptyState';
import { pastelFor } from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import { fetchAllRows } from '../lib/courseVocabulary';
import { tagWordLabel, wordsFromTagLinks } from '../lib/tagWords';
import type { TaggedCard, TagWordLink } from '../lib/tagWords';

type Tag = { id: string; name: string };
type WordList = { status: 'loading' | 'ready' | 'error'; words: TaggedCard[] };

function wordsLabel(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'слово';
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'слова';
  return 'слів';
}

export default function TagsPage() {
  const { showToast } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [tagsLoading, setTagsLoading] = useState(true);
  const [tagsError, setTagsError] = useState(false);
  const [countsKnown, setCountsKnown] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const expandedTagId = searchParams.get('tag');
  function setExpandedTagId(tagId: string | null) {
    const next = new URLSearchParams(searchParams);
    if (tagId) next.set('tag', tagId);
    else next.delete('tag');
    setSearchParams(next, { replace: true });
  }
  const [wordsByTag, setWordsByTag] = useState<Record<string, WordList>>({});
  const wordsPanel = useRef<HTMLElement>(null);
  const lastScrolledTag = useRef<string | null>(null);
  const mounted = useRef(true);
  const tagRequest = useRef(0);
  const wordRequests = useRef<Record<string, number>>({});

  useEffect(() => {
    mounted.current = true;
    fetchTags();
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (expandedTagId && tags.some(tag => tag.id === expandedTagId) && !wordsByTag[expandedTagId]) {
      fetchWordsForTag(expandedTagId);
    }
  }, [expandedTagId, tags, wordsByTag]);

  useEffect(() => {
    if (!expandedTagId) lastScrolledTag.current = null;
    const list = expandedTagId ? wordsByTag[expandedTagId] : undefined;
    if (expandedTagId && list && list.status !== 'loading' && wordsPanel.current && lastScrolledTag.current !== expandedTagId) {
      lastScrolledTag.current = expandedTagId;
      wordsPanel.current.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    }
  }, [expandedTagId, tags, wordsByTag]);

  async function fetchTags() {
    const request = ++tagRequest.current;
    setTagsLoading(true);
    setTagsError(false);
    try {
      const [data, links] = await Promise.all([
        fetchAllRows<Tag>((from, to) => supabase.from('tags').select('id, name')
          .order('created_at', { ascending: false }).order('id').range(from, to)),
        fetchAllRows<{ tag_id: string; card_id: string }>((from, to) => supabase.from('card_tags')
          .select('tag_id, card_id').order('tag_id').order('card_id').range(from, to)),
      ]);
      if (!mounted.current || request !== tagRequest.current) return;
      setTags(data);
      const counts: Record<string, number> = {};
      for (const row of links) counts[row.tag_id] = (counts[row.tag_id] || 0) + 1;
      setTagCounts(counts);
      setCountsKnown(true);
    } catch {
      if (mounted.current && request === tagRequest.current) setTagsError(true);
    } finally {
      if (mounted.current && request === tagRequest.current) setTagsLoading(false);
    }
  }

  async function fetchWordsForTag(tagId: string) {
    const request = (wordRequests.current[tagId] || 0) + 1;
    wordRequests.current[tagId] = request;
    setWordsByTag(prev => ({ ...prev, [tagId]: { status: 'loading', words: prev[tagId]?.words || [] } }));
    try {
      const links = await fetchAllRows<TagWordLink>(async (from, to) => {
        const result = await supabase.from('card_tags')
          .select('cards(id, original_word, translation, card_type, infinitive, past_simple, past_participle, image_color_url, lessons(title, courses(title)))')
          .eq('tag_id', tagId).order('card_id').range(from, to);
        return { data: result.data as unknown as TagWordLink[] | null, error: result.error };
      });
      if (!mounted.current || wordRequests.current[tagId] !== request) return;
      const words = wordsFromTagLinks(links);
      setWordsByTag(prev => ({ ...prev, [tagId]: { status: 'ready', words } }));
      setTagCounts(prev => ({ ...prev, [tagId]: words.length }));
    } catch {
      if (!mounted.current || wordRequests.current[tagId] !== request) return;
      setWordsByTag(prev => ({ ...prev, [tagId]: { status: 'error', words: prev[tagId]?.words || [] } }));
    }
  }

  function toggleTag(tagId: string) {
    if (expandedTagId === tagId) {
      setExpandedTagId(null);
      return;
    }
    setExpandedTagId(tagId);
    if (!wordsByTag[tagId] || wordsByTag[tagId].status === 'error') {
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

  function editTag(tag: Tag) {
    setEditingId(tag.id);
    setName(tag.name);
    setIsComposerOpen(true);
  }

  async function deleteTag(id: string) {
    if (!confirm('Видалити цей тег?')) return;
    try {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;

      wordRequests.current[id] = (wordRequests.current[id] || 0) + 1;

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
  const selectedList = expandedTagId ? wordsByTag[expandedTagId] : undefined;
  const selectedWords = selectedList?.words || [];

  return (
    <div>
      <PageHeader
        title="Теги"
        description="Натисніть тег, щоб переглянути всі його слова"
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

        {tagsLoading && <p role="status" className="mb-4 text-sm text-ink-400">Завантаження тегів…</p>}
        {tagsError && (
          <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-blush-200 bg-blush-50 p-4 text-sm text-ink-600">
            <span>Не вдалося завантажити теги. Спробуйте ще раз.</span>
            <Button type="button" variant="secondary" size="sm" onClick={fetchTags}><RefreshCw size={15} /> Повторити</Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2.5">
          {filteredTags.map(tag => {
            const isOpen = expandedTagId === tag.id;
            const count = tagCounts[tag.id] ?? 0;
            const hue = pastelFor(tag.name);

            return (
              <div key={tag.id} className={`group inline-flex items-center rounded-full border bg-white/75 py-1 pl-1.5 pr-1 shadow-sm transition ${isOpen ? `${hue.border} ring-2 ring-lavender-100` : 'border-lavender-100 hover:border-lavender-200 hover:shadow-cozy-sm'}`}>
                <button type="button" onClick={() => toggleTag(tag.id)} aria-expanded={isOpen} aria-controls={isOpen ? `tag-words-${tag.id}` : undefined} className="flex items-center gap-2 rounded-full px-2 py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender-500">
                  <span className={`h-2 w-2 rounded-full ${hue.dot}`} />
                  <span className="text-sm font-semibold text-ink">{tag.name}</span>
                  <span className="text-xs tabular-nums text-ink-400">{countsKnown || wordsByTag[tag.id]?.status === 'ready' ? count : '—'}</span>
                  <ChevronDown size={14} aria-hidden="true" className={`text-ink-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className="ml-0.5 flex items-center opacity-60 transition group-hover:opacity-100">
                  <IconButton onClick={() => editTag(tag)} title="Редагувати тег" className="p-1.5"><Pencil size={14} /></IconButton>
                  <IconButton variant="danger" onClick={() => deleteTag(tag.id)} title="Видалити тег" className="p-1.5"><Trash2 size={14} /></IconButton>
                </div>
              </div>
            );
          })}
          {!tagsLoading && !tagsError && tags.length === 0 && (
            <EmptyState icon={<TagsIcon size={28} />} title="Тегів ще немає" className="w-full" />
          )}
          {!tagsLoading && tags.length > 0 && filteredTags.length === 0 && (
            <EmptyState icon={<Search size={28} />} title="Тегів за цим запитом не знайдено" className="w-full py-10" />
          )}
        </div>

        {selectedTag && selectedHue && (
          <section ref={wordsPanel} id={`tag-words-${selectedTag.id}`} aria-label={`Слова тега «${selectedTag.name}»`} className="mt-9 scroll-mt-32 border-t border-lavender-100 pt-6 lg:scroll-mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${selectedHue.dot}`} />
                <h2 className="text-lg font-bold text-ink">{selectedTag.name}</h2>
                {(countsKnown || selectedList?.status === 'ready') && <span className="text-sm text-ink-400">{tagCounts[selectedTag.id] ?? 0} {wordsLabel(tagCounts[selectedTag.id] ?? 0)}</span>}
              </div>
              <div className="flex items-center gap-1">
                <IconButton disabled={selectedList?.status === 'loading'} onClick={() => fetchWordsForTag(selectedTag.id)} title="Оновити слова"><RefreshCw size={16} /></IconButton>
                <Button type="button" variant="secondary" size="sm" onClick={() => editTag(selectedTag)}><Pencil size={15} /> Редагувати тег</Button>
                <IconButton onClick={() => setExpandedTagId(null)} title="Закрити"><X size={18} /></IconButton>
              </div>
            </div>
            <Card className={`border-0 ${selectedHue.bg}`}>
              {selectedList?.status === 'loading' && <p role="status" className="text-sm text-ink-600">Завантаження слів…</p>}
              {selectedList?.status === 'error' && (
                <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-ink-600">
                  <span>Не вдалося завантажити слова цього тега.</span>
                  <Button type="button" variant="secondary" size="sm" onClick={() => fetchWordsForTag(selectedTag.id)}><RefreshCw size={15} /> Повторити</Button>
                </div>
              )}
              {selectedList?.status === 'ready' && selectedWords.length === 0 && <p className="text-sm text-ink-600">До цього тега ще не додано слів.</p>}
              {selectedList?.status === 'ready' && selectedWords.length > 0 && (
                <ul className="grid max-h-[32rem] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                  {selectedWords.map(card => (
                    <li key={card.id} className="flex items-start gap-3 rounded-xl border border-white/70 bg-white/85 px-3 py-3">
                      {card.image_color_url && <img src={card.image_color_url} loading="lazy" alt="" className="h-10 w-10 shrink-0 rounded-lg bg-paper-100 object-cover" />}
                      <div className="min-w-0 break-words">
                        <div className="font-semibold text-ink">{tagWordLabel(card)}</div>
                        <div className="mt-0.5 text-sm text-ink-600">{card.translation?.trim() || 'Переклад не додано'}</div>
                        <div className="mt-2 text-xs text-ink-400">{[card.lessons?.courses?.title, card.lessons?.title].filter(Boolean).join(' / ') || 'Без прив’язки до уроку'}</div>
                      </div>
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
