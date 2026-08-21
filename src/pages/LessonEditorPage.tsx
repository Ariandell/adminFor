import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import EditorBlock from '../components/EditorBlock';
import { type OutputData } from '@editorjs/editorjs';
import Select from 'react-select';
import { ArrowLeft, Plus, Pencil, Trash2, ImageIcon, LayoutGrid } from 'lucide-react';
import { useToast } from '../components/Toast';
import { cardTranslation, normalizeCardWord, parseCardText } from '../lib/cardText';
import Card, { cardClass } from '../components/ui/Card';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import EmptyState from '../components/ui/EmptyState';
import FileDropzone from '../components/ui/FileDropzone';
import Badge from '../components/ui/Badge';

type CardType = 'standard' | 'irregular_verb';

export default function LessonEditorPage() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState<OutputData | undefined>();

  // Cards state
  const [cards, setCards] = useState<any[]>([]);
  const [tagsOptions, setTagsOptions] = useState<any[]>([]);
  const [activeCardType, setActiveCardType] = useState<CardType>('standard');

  // New Card Form
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardType, setCardType] = useState<CardType>('standard');
  const [newCardWord, setNewCardWord] = useState('');
  const [infinitive, setInfinitive] = useState('');
  const [pastSimple, setPastSimple] = useState('');
  const [pastParticiple, setPastParticiple] = useState('');
  const [newCardTrans, setNewCardTrans] = useState('');
  const [duplicateCard, setDuplicateCard] = useState<any>(null);
  const [newCardTags, setNewCardTags] = useState<any[]>([]);
  const [grayFile, setGrayFile] = useState<File | null>(null);
  const [colorFile, setColorFile] = useState<File | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  useEffect(() => {
    fetchTags();
    if (lessonId) {
      fetchLessonData();
    } else {
      setInitialDataLoaded(true);
    }
  }, [lessonId]);

  useEffect(() => {
    const word = parseCardText(cardType === 'irregular_verb' ? infinitive : newCardWord).word;
    if (word.length < 2) { setDuplicateCard(null); return; }
    const timer = window.setTimeout(async () => {
      const { data } = await supabase
        .from('cards')
        .select('id, card_type, original_word, infinitive, translation, lessons(title, courses(title))')
        .ilike('original_word', `${word}%`)
        .limit(20);
      setDuplicateCard((data || []).find((card: any) =>
        card.id !== editingCardId &&
        (card.card_type || 'standard') === cardType &&
        normalizeCardWord(card.infinitive || card.original_word) === normalizeCardWord(word)
      ) || null);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [newCardWord, infinitive, cardType, editingCardId]);

  async function fetchTags() {
    const { data } = await supabase.from('tags').select('*');
    if (data) {
      setTagsOptions(data.map(t => ({ value: t.id, label: t.name })));
    }
  }

  async function fetchLessonData() {
    const { data: lesson } = await supabase.from('lessons').select('*').eq('id', lessonId).single();
    if (lesson) {
      setTitle(lesson.title);
      setContent(lesson.content);
    }

    const { data: cardsData } = await supabase.from('cards').select('*, card_tags(tags(*))').eq('lesson_id', lessonId);
    if (cardsData) {
      setCards(cardsData);
    }

    setInitialDataLoaded(true);
  }

  async function handleSaveLesson(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const lessonData = {
        course_id: courseId,
        title,
        content,
      };

      if (lessonId) {
        const { error } = await supabase.from('lessons').update(lessonData).eq('id', lessonId);
        if (error) throw error;
        showToast('Урок оновлено!', 'success');
      } else {
        // Get next order_index
        const { count } = await supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('course_id', courseId);
        const orderIndex = (count ?? 0) + 1;

        const { data, error } = await supabase.from('lessons').insert([{ ...lessonData, order_index: orderIndex }]).select().single();
        if (error) throw error;
        showToast('Урок створено!', 'success');
        navigate(`/courses/${courseId}/lessons/${data.id}`);
      }
    } catch (error: any) {
      showToast('Помилка: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function uploadImage(file: File, path: string) {
    const { error } = await supabase.storage.from('course-images').upload(path, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('course-images').getPublicUrl(path);
    return publicUrl;
  }

  function resetCardForm() {
    setShowCardForm(false);
    setEditingCardId(null);
    setNewCardWord('');
    setInfinitive('');
    setPastSimple('');
    setPastParticiple('');
    setNewCardTrans('');
    setNewCardTags([]);
    setGrayFile(null);
    setColorFile(null);
  }

  function openCardEditor(card: any) {
    const type = (card.card_type || 'standard') as CardType;
    setEditingCardId(card.id);
    setCardType(type);
    setActiveCardType(type);
    setNewCardWord(card.original_word || '');
    setInfinitive(card.infinitive || card.original_word || '');
    setPastSimple(card.past_simple || '');
    setPastParticiple(card.past_participle || '');
    setNewCardTrans(card.translation || '');
    setNewCardTags((card.card_tags || []).filter((link: any) => link.tags).map((link: any) => ({ value: link.tags.id, label: link.tags.name })));
    setGrayFile(null);
    setColorFile(null);
    setShowCardForm(true);
  }

  async function handleSaveCard(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonId) {
      showToast('Спочатку збережіть урок, щоб додавати картки!', 'info');
      return;
    }
    setLoading(true);
    try {
      let grayUrl = null;
      let colorUrl = null;

      if (grayFile) grayUrl = await uploadImage(grayFile, `cards/gray_${Date.now()}_${grayFile.name}`);
      if (colorFile) colorUrl = await uploadImage(colorFile, `cards/color_${Date.now()}_${colorFile.name}`);

      const cardPayload: Record<string, unknown> = {
        lesson_id: lessonId,
        card_type: cardType,
        original_word: parseCardText(cardType === 'irregular_verb' ? infinitive : newCardWord).word,
        translation: cardTranslation(cardType === 'irregular_verb' ? infinitive : newCardWord, newCardTrans),
        infinitive: cardType === 'irregular_verb' ? parseCardText(infinitive).word : null,
        past_simple: cardType === 'irregular_verb' ? parseCardText(pastSimple).word : null,
        past_participle: cardType === 'irregular_verb' ? parseCardText(pastParticiple).word : null,
      };
      if (grayUrl) cardPayload.image_gray_url = grayUrl;
      if (colorUrl) cardPayload.image_color_url = colorUrl;

      const { data: savedCard, error: cardError } = editingCardId
        ? await supabase.from('cards').update(cardPayload).eq('id', editingCardId).select().single()
        : await supabase.from('cards').insert([{ ...cardPayload, image_gray_url: grayUrl, image_color_url: colorUrl }]).select().single();

      if (cardError) throw cardError;

      const { error: clearTagsError } = await supabase.from('card_tags').delete().eq('card_id', savedCard.id);
      if (clearTagsError) throw clearTagsError;
      if (newCardTags.length > 0) {
        const tagInserts = newCardTags.map(t => ({ card_id: savedCard.id, tag_id: t.value }));
        const { error: tagError } = await supabase.from('card_tags').insert(tagInserts);
        if (tagError) throw tagError;
      }

      showToast(editingCardId ? 'Картку оновлено' : 'Картку додано', 'success');
      setActiveCardType(cardType);
      resetCardForm();
      fetchLessonData();

    } catch (err: any) {
      showToast('Помилка: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function deleteCard(id: string) {
    if (!confirm('Видалити картку?')) return;
    await supabase.from('cards').delete().eq('id', id);
    fetchLessonData();
  }

  async function handleDeleteLesson() {
    if (!lessonId) return;
    if (!confirm(`Видалити урок «${title}» разом з його тестами та картками? Цю дію не можна скасувати.`)) return;
    setLoading(true);
    try {
      const { data: cardRows, error: cardsError } = await supabase.from('cards').select('id').eq('lesson_id', lessonId);
      if (cardsError) throw cardsError;
      const cardIds = (cardRows || []).map(c => c.id);

      if (cardIds.length > 0) {
        const { error: tagsError } = await supabase.from('card_tags').delete().in('card_id', cardIds);
        if (tagsError) throw tagsError;
        const { error: delCardsError } = await supabase.from('cards').delete().in('id', cardIds);
        if (delCardsError) throw delCardsError;
      }

      const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
      if (error) throw error;

      showToast('Урок видалено', 'success');
      navigate(`/courses/${courseId}`);
    } catch (error: any) {
      showToast('Помилка: ' + error.message, 'error');
      setLoading(false);
    }
  }

  if (!initialDataLoaded) return <div className="p-8 text-ink-400">Завантаження...</div>;

  const visibleCards = cards.filter(card => (card.card_type || 'standard') === activeCardType);

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <Link to={`/courses/${courseId}`} className="inline-flex items-center text-lavender-600 hover:text-lavender-700 mb-6 font-semibold">
        <ArrowLeft size={16} className="mr-2" /> Назад до курсу
      </Link>

      <h1 className="text-3xl font-bold mb-8">{lessonId ? 'Редагувати урок' : 'Створити новий урок'}</h1>

      {/* Lesson Form */}
      <Card className="mb-8">
        <div className="mb-6">
          <label className="block text-sm font-medium text-ink-600 mb-1">Назва уроку</label>
          <input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full border border-lavender-200 rounded-lg p-2 text-lg focus:outline-none focus:ring-2 focus:ring-lavender-300" placeholder="Назва уроку..." />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-ink-600 mb-2">Контент уроку</label>
          <EditorBlock initialData={content} onChange={setContent} />
        </div>

        <div className="flex justify-between items-center">
          <Button disabled={loading} onClick={handleSaveLesson}>
            {loading ? 'Збереження...' : 'Зберегти урок'}
          </Button>
          {lessonId && (
            <IconButton variant="danger" disabled={loading} onClick={handleDeleteLesson} title="Видалити урок">
              <Trash2 size={18} />
            </IconButton>
          )}
        </div>
      </Card>

      {/* Cards Section */}
      {lessonId && (
        <div>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Картки</h2>
              <div className="mt-3 inline-flex rounded-xl border border-lavender-100 bg-white p-1">
                <button type="button" onClick={() => { resetCardForm(); setActiveCardType('standard'); }} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${activeCardType === 'standard' ? 'bg-lavender-100 text-lavender-700' : 'text-ink-400 hover:text-ink'}`}>Звичайні слова</button>
                <button type="button" onClick={() => { resetCardForm(); setActiveCardType('irregular_verb'); }} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${activeCardType === 'irregular_verb' ? 'bg-lavender-100 text-lavender-700' : 'text-ink-400 hover:text-ink'}`}>Неправильні дієслова</button>
              </div>
            </div>
            <Button size="sm" onClick={() => { resetCardForm(); setCardType(activeCardType); setShowCardForm(true); }}>
              <Plus size={18} /> {activeCardType === 'irregular_verb' ? 'Додати дієслово' : 'Додати слово'}
            </Button>
          </div>

          {showCardForm && (
            <form onSubmit={handleSaveCard} className={cardClass('accent', 'mb-8 space-y-4')}>
              <h3 className="text-lg font-bold">{editingCardId ? 'Редагування' : 'Нова картка'} · {cardType === 'irregular_verb' ? 'Неправильне дієслово' : 'Звичайне слово'}</h3>
              {cardType === 'standard' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="mb-1 block text-sm font-medium text-ink-600">Оригінал слова</label><input required value={newCardWord} onChange={e => setNewCardWord(e.target.value)} type="text" className="field" /></div>
                  <div><label className="mb-1 block text-sm font-medium text-ink-600">Переклад</label><input value={newCardTrans} onChange={e => setNewCardTrans(e.target.value)} type="text" placeholder="Переклад або залиште порожнім, якщо він у дужках" className="field" /></div>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div><label className="mb-1 block text-sm font-medium text-ink-600">Infinitive</label><input required value={infinitive} onChange={e => setInfinitive(e.target.value)} placeholder="go" className="field" /></div>
                    <div><label className="mb-1 block text-sm font-medium text-ink-600">Past Simple</label><input required value={pastSimple} onChange={e => setPastSimple(e.target.value)} placeholder="went" className="field" /></div>
                    <div><label className="mb-1 block text-sm font-medium text-ink-600">Past Participle</label><input required value={pastParticiple} onChange={e => setPastParticiple(e.target.value)} placeholder="gone" className="field" /></div>
                  </div>
                  <div><label className="mb-1 block text-sm font-medium text-ink-600">Переклад</label><input value={newCardTrans} onChange={e => setNewCardTrans(e.target.value)} type="text" placeholder="Переклад" className="field" /></div>
                </>
              )}

              {duplicateCard && <div className="rounded-xl border border-butter-200 bg-butter-100 px-4 py-3 text-sm text-butter-700"><strong>Схожа картка вже є:</strong> {duplicateCard.original_word} — {duplicateCard.translation}<span className="block text-xs mt-1">{duplicateCard.lessons?.courses?.title} · {duplicateCard.lessons?.title}</span></div>}

              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1">Теги</label>
                <Select
                  isMulti
                  options={tagsOptions}
                  value={newCardTags}
                  onChange={(val) => setNewCardTags(val as any[])}
                  placeholder="Оберіть теги..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <FileDropzone label="Чорно-біле фото" file={grayFile} onChange={setGrayFile} />
                <FileDropzone label="Кольорове фото" file={colorFile} onChange={setColorFile} />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button type="button" variant="ghost" onClick={resetCardForm}>Скасувати</Button>
                <Button disabled={loading} type="submit">
                  {loading ? 'Збереження...' : editingCardId ? 'Зберегти зміни' : 'Зберегти картку'}
                </Button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleCards.map(card => (
              <Card key={card.id} className="p-4 flex gap-4">
                <div className="w-16 h-16 bg-paper-100 rounded-lg overflow-hidden shrink-0">
                  {card.image_color_url ? (
                    <img src={card.image_color_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lavender-300"><ImageIcon size={20} /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-lg font-bold">
                      {activeCardType === 'irregular_verb'
                        ? [card.infinitive || card.original_word, card.past_simple, card.past_participle].filter(Boolean).join(' · ')
                        : card.original_word}
                    </h3>
                    <div className="-mt-1 -mr-1 flex shrink-0">
                      <IconButton className="p-1" title="Редагувати картку" onClick={() => openCardEditor(card)}><Pencil size={16} /></IconButton>
                      <IconButton variant="danger" className="p-1" title="Видалити картку" onClick={() => deleteCard(card.id)}><Trash2 size={16} /></IconButton>
                    </div>
                  </div>
                  <p className="text-ink-600 text-sm">{card.translation}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {card.card_tags?.map((ct: any) => (
                      ct.tags && <Badge key={ct.tags.id} label={ct.tags.name} />
                    ))}
                  </div>
                </div>
              </Card>
            ))}
            {visibleCards.length === 0 && !showCardForm && (
              <div className="sm:col-span-2 lg:col-span-3">
                <EmptyState icon={<LayoutGrid size={28} />} title={activeCardType === 'irregular_verb' ? 'Неправильних дієслів ще немає' : 'Картки ще не додано'} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
