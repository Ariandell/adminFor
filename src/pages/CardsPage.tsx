import { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { Search, Plus, Pencil, Trash2, AlertTriangle, CreditCard } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import { cardTranslation, normalizeCardWord, parseCardText } from '../lib/cardText';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
type CardType = 'standard' | 'irregular_verb';

const emptyForm = { id: '', card_type: 'standard' as CardType, level: 'A1', original_word: '', translation: '', transcription: '', example: '', infinitive: '', past_simple: '', past_participle: '' };

export default function CardsPage() {
  const { showToast } = useToast();
  const [cards, setCards] = useState<any[]>([]);
  const [tagsOptions, setTagsOptions] = useState<any[]>([]);
  const [formTags, setFormTags] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<CardType>('standard');
  const [level, setLevel] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);

  async function fetchCards() {
    const { data, error } = await supabase.from('cards').select('*, lessons(title, courses(title)), card_tags(tags(id, name))').order('created_at', { ascending: false });
    if (error) showToast('Не вдалося завантажити картки: ' + error.message, 'error');
    else {
      const rows = data || [];
      setCards(rows);
      setSchemaReady(rows.length === 0 || Object.prototype.hasOwnProperty.call(rows[0], 'card_type'));
    }
  }
  async function fetchTags() {
    const { data, error } = await supabase.from('tags').select('id, name').order('name');
    if (error) showToast('Не вдалося завантажити теги: ' + error.message, 'error');
    else setTagsOptions((data || []).map(tag => ({ value: tag.id, label: tag.name })));
  }
  useEffect(() => { fetchCards(); fetchTags(); }, []);

  const duplicate = useMemo(() => {
    const rawWord = form.card_type === 'irregular_verb' ? form.infinitive : form.original_word;
    const needle = normalizeCardWord(rawWord);
    if (!needle) return null;
    return cards.find(card => card.id !== form.id &&
      (card.card_type || 'standard') === form.card_type &&
      normalizeCardWord(String(form.card_type === 'irregular_verb' ? (card.infinitive || card.original_word) : card.original_word)) === needle &&
      (card.level || 'A1') === form.level);
  }, [cards, form]);

  const filtered = useMemo(() => cards.filter(card => {
    const cardType = card.card_type || 'standard';
    const text = `${card.original_word || ''} ${card.translation || ''} ${card.infinitive || ''} ${card.past_simple || ''} ${card.past_participle || ''}`.toLocaleLowerCase();
    return cardType === type && (level === 'all' || (card.level || 'A1') === level) && text.includes(search.toLocaleLowerCase());
  }), [cards, type, level, search]);

  function openNew() { setForm({ ...emptyForm, card_type: type, level: level === 'all' ? 'A1' : level }); setFormTags([]); setShowForm(true); }
  function openEdit(card: any) {
    setForm({ ...emptyForm, ...card, card_type: card.card_type || 'standard', level: card.level || 'A1' });
    setFormTags((card.card_tags || []).filter((link: any) => link.tags).map((link: any) => ({ value: link.tags.id, label: link.tags.name })));
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (duplicate) return;
    setLoading(true);
    const payload = {
      card_type: form.card_type, level: form.level,
      original_word: parseCardText(form.card_type === 'irregular_verb' ? form.infinitive : form.original_word).word,
      translation: cardTranslation(form.card_type === 'irregular_verb' ? form.infinitive : form.original_word, form.translation),
      transcription: form.transcription || null, example: form.example || null,
      infinitive: form.card_type === 'irregular_verb' ? parseCardText(form.infinitive).word : null,
      past_simple: form.card_type === 'irregular_verb' ? parseCardText(form.past_simple).word : null,
      past_participle: form.card_type === 'irregular_verb' ? parseCardText(form.past_participle).word : null,
    };
    const query = form.id
      ? supabase.from('cards').update(payload).eq('id', form.id).select('id').single()
      : supabase.from('cards').insert([payload]).select('id').single();
    const { data: savedCard, error } = await query;
    if (error) { setLoading(false); showToast(error.message.includes('column') ? 'Спочатку застосуйте міграцію Supabase з репозиторію.' : error.message, 'error'); return; }

    const cardId = savedCard?.id || form.id;
    const { error: removeTagsError } = await supabase.from('card_tags').delete().eq('card_id', cardId);
    if (removeTagsError) { setLoading(false); showToast('Картку збережено, але теги не оновлено: ' + removeTagsError.message, 'error'); return; }
    if (formTags.length > 0) {
      const { error: addTagsError } = await supabase.from('card_tags').insert(formTags.map(tag => ({ card_id: cardId, tag_id: tag.value })));
      if (addTagsError) { setLoading(false); showToast('Картку збережено, але теги не оновлено: ' + addTagsError.message, 'error'); return; }
    }
    setLoading(false);
    showToast(form.id ? 'Картку оновлено' : 'Картку додано', 'success');
    setShowForm(false); setForm(emptyForm); setFormTags([]); fetchCards();
  }

  async function remove(card: any) {
    if (!confirm(`Видалити «${card.original_word}»?`)) return;
    const { error } = await supabase.from('cards').delete().eq('id', card.id);
    if (error) showToast(error.message, 'error'); else { showToast('Картку видалено', 'success'); fetchCards(); }
  }

  return (
    <div>
      <PageHeader title="Картки" actions={<Button onClick={openNew}><Plus size={18} />Додати картку</Button>} />
      {!schemaReady && <div className="mb-5 flex items-center gap-3 rounded-xl border border-butter-200 bg-butter-100 px-4 py-3 text-sm text-butter-700"><AlertTriangle size={18} />Для рівнів і неправильних дієслів застосуйте міграцію <code>supabase/migrations/202608160001_content_admin.sql</code>.</div>}
      <div className="flex flex-col lg:flex-row gap-3 mb-5">
        <div className="inline-flex rounded-xl bg-white border border-lavender-100 p-1">
          <button onClick={() => setType('standard')} className={`px-4 py-2 rounded-lg text-sm font-bold ${type === 'standard' ? 'bg-lavender-100 text-lavender-700' : 'text-ink-400'}`}>Звичайні</button>
          <button onClick={() => setType('irregular_verb')} className={`px-4 py-2 rounded-lg text-sm font-bold ${type === 'irregular_verb' ? 'bg-lavender-100 text-lavender-700' : 'text-ink-400'}`}>Неправильні дієслова</button>
        </div>
        <div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-lavender-100 bg-white outline-none focus:ring-2 focus:ring-lavender-200" /></div>
        <select value={level} onChange={e => setLevel(e.target.value)} className="rounded-xl border border-lavender-100 bg-white px-4 py-2.5 outline-none"><option value="all">Усі рівні</option>{LEVELS.map(x => <option key={x}>{x}</option>)}</select>
      </div>

      {showForm && <Card tone="accent" className="mb-5"><form onSubmit={save} className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{form.id ? 'Редагування картки' : 'Нова картка'}</h2><button type="button" onClick={() => setShowForm(false)} className="text-ink-400">Закрити</button></div>
        <div className="grid md:grid-cols-3 gap-3"><select value={form.card_type} onChange={e => setForm({ ...form, card_type: e.target.value as CardType })} className="field"><option value="standard">Звичайна картка</option><option value="irregular_verb">Неправильне дієслово</option></select><select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} className="field">{LEVELS.map(x => <option key={x}>{x}</option>)}</select><input value={form.translation} onChange={e => setForm({ ...form, translation: e.target.value })} placeholder="Переклад (необов'язково)" className="field" /></div>
        {form.card_type === 'standard' ? <input required value={form.original_word} onChange={e => setForm({ ...form, original_word: e.target.value })} placeholder="Англійське слово або фраза, наприклад book (бук)" className="field" /> : <div className="grid md:grid-cols-3 gap-3"><input required value={form.infinitive} onChange={e => setForm({ ...form, infinitive: e.target.value })} placeholder="Infinitive" className="field" /><input required value={form.past_simple} onChange={e => setForm({ ...form, past_simple: e.target.value })} placeholder="Past Simple" className="field" /><input required value={form.past_participle} onChange={e => setForm({ ...form, past_participle: e.target.value })} placeholder="Past Participle" className="field" /></div>}
        <div className="grid md:grid-cols-2 gap-3"><input value={form.transcription} onChange={e => setForm({ ...form, transcription: e.target.value })} placeholder="Транскрипція" className="field" /><input value={form.example} onChange={e => setForm({ ...form, example: e.target.value })} placeholder="Приклад речення" className="field" /></div>
        <div><label className="mb-1 block text-sm font-medium text-ink-600">Теги</label><Select isMulti options={tagsOptions} value={formTags} onChange={value => setFormTags(value as any[])} placeholder="Оберіть один або кілька тегів" noOptionsMessage={() => 'Тегів не знайдено'} /></div>
        {duplicate && <div className="rounded-xl bg-blush-100 border border-blush-200 p-3 text-sm text-blush-700"><strong>Дублікат:</strong> {duplicate.original_word} — {duplicate.translation} · {duplicate.level || 'A1'}</div>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Скасувати</Button><Button disabled={loading || !!duplicate} type="submit">Зберегти</Button></div>
      </form></Card>}

      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 ? <EmptyState icon={<CreditCard size={28} />} title="Карток не знайдено" /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-paper-100 text-left text-ink-400"><tr><th className="px-5 py-3">Картка</th>{type === 'irregular_verb' && <><th className="px-5 py-3">Past Simple</th><th className="px-5 py-3">Past Participle</th></>}<th className="px-5 py-3">Переклад</th><th className="px-5 py-3">Теги</th><th className="px-5 py-3">Рівень</th><th className="px-5 py-3">Урок</th><th /></tr></thead><tbody className="divide-y divide-lavender-100">{filtered.map(card => <tr key={card.id} className="hover:bg-lavender-50/50"><td className="px-5 py-4 font-bold">{card.infinitive || card.original_word}</td>{type === 'irregular_verb' && <><td className="px-5 py-4">{card.past_simple || '—'}</td><td className="px-5 py-4">{card.past_participle || '—'}</td></>}<td className="px-5 py-4 text-ink-600">{card.translation}</td><td className="px-5 py-4"><div className="flex min-w-36 flex-wrap gap-1">{card.card_tags?.map((link: any) => link.tags && <Badge key={link.tags.id} label={link.tags.name} />)}</div></td><td className="px-5 py-4"><Badge label={card.level || 'A1'} seed={card.level || 'A1'} /></td><td className="px-5 py-4 text-ink-400">{card.lessons?.title || '—'}</td><td className="px-4 py-3"><div className="flex justify-end"><IconButton onClick={() => openEdit(card)}><Pencil size={16} /></IconButton><IconButton variant="danger" onClick={() => remove(card)}><Trash2 size={16} /></IconButton></div></td></tr>)}</tbody></table></div>}
      </Card>
    </div>
  );
}
