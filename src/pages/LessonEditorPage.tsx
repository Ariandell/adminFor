import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link, useBlocker } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import EditorBlock, { type EditorBlockHandle } from '../components/EditorBlock';
import { type OutputBlockData, type OutputData } from '@editorjs/editorjs';
import Select from 'react-select';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Plus, Pencil, Trash2, ImageIcon, LayoutGrid } from 'lucide-react';
import { useToast } from '../components/Toast';
import { buildCardTextFields, normalizeCardWord, parseCardText } from '../lib/cardText';
import Card, { cardClass } from '../components/ui/Card';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import EmptyState from '../components/ui/EmptyState';
import FileDropzone from '../components/ui/FileDropzone';
import Badge from '../components/ui/Badge';
import { contentWithLessonSheet, lessonSheetBlocks } from '../lib/lessonSheet';
import { youtubeVideoId } from '../lib/youtubeVideo';

type CardType = 'standard' | 'irregular_verb';

export default function LessonEditorPage() {
  const { courseId, lessonId } = useParams();
  if (!courseId) {
    return <div className="p-8 text-ink-400">Курс не знайдено. <Link to="/courses">До курсів</Link></div>;
  }
  return <OrdinaryLessonEditor key={`${courseId}/${lessonId ?? 'new'}`} />;
}

function OrdinaryLessonEditor() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState<OutputData | undefined>();
  const [initialBlocks, setInitialBlocks] = useState<OutputBlockData[]>([]);
  const editorRef = useRef<EditorBlockHandle>(null);
  const [introStory, setIntroStory] = useState('');
  const [introOutcomes, setIntroOutcomes] = useState('');
  const [introNote, setIntroNote] = useState('');

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
  const saveInProgress = useRef(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [lessonDirty, setLessonDirty] = useState(false);
  const lessonDirtyRef = useRef(false);
  const editVersion = useRef(0);
  const skipNavigationWarning = useRef(false);
  const markLessonDirty = useCallback(() => {
    editVersion.current += 1;
    lessonDirtyRef.current = true;
    setLessonDirty(true);
  }, []);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !skipNavigationWarning.current && (lessonDirtyRef.current || showCardForm) &&
    (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search)
  );

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!lessonDirtyRef.current && !showCardForm) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [showCardForm]);

  useEffect(() => {
    fetchTags();
    if (lessonId) {
      fetchLessonData();
    } else {
      supabase.from('courses').select('id').eq('id', courseId).maybeSingle().then(({ data, error }) => {
        if (error || !data) setLoadError('Курс не знайдено або недоступний.');
        setInitialDataLoaded(true);
      });
    }
  }, [courseId, lessonId]);

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
    const { data: lesson, error } = await supabase.from('lessons').select('*').eq('id', lessonId).eq('course_id', courseId).maybeSingle();
    if (error || !lesson) {
      setLoadError('Урок не належить цьому курсу або недоступний.');
      setInitialDataLoaded(true);
      return;
    }
    if (lesson) {
      setTitle(lesson.title);
      setContent(lesson.content);
      setInitialBlocks(lessonSheetBlocks(lesson.content));
      const intro = lesson.content?.introduction;
      setIntroStory(typeof intro?.story === 'string' ? intro.story : (lesson.description || ''));
      setIntroOutcomes(Array.isArray(intro?.outcomes) ? intro.outcomes.filter((item: unknown) => typeof item === 'string').join('\n') : '');
      setIntroNote(typeof intro?.note === 'string' ? intro.note : '');
    }

    await fetchCards();

    setInitialDataLoaded(true);
  }

  async function fetchCards() {
    if (!lessonId) return;
    const { data: cardsData } = await supabase.from('cards').select('*, card_tags(tags(*))').eq('lesson_id', lessonId);
    if (cardsData) {
      setCards(cardsData);
    }
  }

  async function requireEditableLesson() {
    if (!initialDataLoaded || loadError || !courseId) {
      throw new Error('Матеріал недоступний у звичайному редакторі.');
    }
    if (lessonId) {
      const { data, error } = await supabase.from('lessons').select('id').eq('id', lessonId).eq('course_id', courseId).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Урок не належить цьому курсу.');
    }
  }

  async function handleSaveLesson(e?: { preventDefault(): void }) {
    e?.preventDefault();
    if (!initialDataLoaded || loadError || saveInProgress.current) return;
    saveInProgress.current = true;
    setLoading(true);

    try {
      if (!title.trim()) {
        showToast('Вкажіть назву уроку.', 'error');
        return;
      }
      const currentEditor = await editorRef.current?.save();
      if (!currentEditor) {
        showToast('Редактор ще не готовий. Спробуйте зберегти ще раз.', 'error');
        return;
      }
      const savedVersion = editVersion.current;
      const latestBlocks = lessonSheetBlocks(currentEditor);
      if (latestBlocks.length === 0) {
        showToast('Додайте матеріал уроку перед збереженням.', 'error');
        return;
      }
      if (latestBlocks.some(block => block.type === 'youtubeEmbed' && !youtubeVideoId(String(block.data?.url ?? '')))) {
        showToast('Вкажіть коректне посилання в кожному відеоблоці.', 'error');
        return;
      }
      if (latestBlocks.some(block => block.type === 'aiBlock' &&
        (!String(block.data?.question ?? '').trim() || !String(block.data?.evaluationPrompt ?? '').trim()))) {
        showToast('Заповніть питання й промпт AI-блоку або видаліть незавершений блок.', 'error');
        return;
      }
      await requireEditableLesson();
      const lessonData = {
        course_id: courseId,
        title: title.trim(),
        content: {
          ...contentWithLessonSheet(content, latestBlocks),
          introduction: {
            story: introStory.trim(),
            outcomes: introOutcomes.split('\n').map(line => line.trim()).filter(Boolean),
            note: introNote.trim(),
          },
        },
      };
      if (lessonId) {
        const { error } = await supabase.from('lessons').update(lessonData).eq('id', lessonId).eq('course_id', courseId).select('id').single();
        if (error) throw error;
        if (editVersion.current === savedVersion) {
          lessonDirtyRef.current = false;
          setLessonDirty(false);
          showToast('Урок оновлено!', 'success');
        } else {
          showToast('Попередню версію збережено. Є нові незбережені зміни.', 'info');
        }
      } else {
        // Get next order_index
        const { count } = await supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('course_id', courseId);
        const orderIndex = (count ?? 0) + 1;

        const newLessonId = uuidv4();
        const { error } = await supabase.from('lessons').insert([{ id: newLessonId, ...lessonData, order_index: orderIndex }]);
        if (error) throw error;
        lessonDirtyRef.current = false;
        skipNavigationWarning.current = true;
        showToast('Урок створено!', 'success');
        navigate(`/courses/${courseId}/lessons/${newLessonId}`);
      }
    } catch (error: any) {
      showToast('Помилка: ' + error.message, 'error');
    } finally {
      setLoading(false);
      saveInProgress.current = false;
    }
  }

  useEffect(() => {
    const onSaveShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSaveLesson();
      }
    };
    window.addEventListener('keydown', onSaveShortcut);
    return () => window.removeEventListener('keydown', onSaveShortcut);
  });

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
      await requireEditableLesson();
      if (editingCardId && !cards.some(card => card.id === editingCardId && card.lesson_id === lessonId)) {
        throw new Error('Картка не належить цьому уроку.');
      }
      let grayUrl = null;
      let colorUrl = null;

      if (grayFile) grayUrl = await uploadImage(grayFile, `cards/gray_${Date.now()}_${grayFile.name}`);
      if (colorFile) colorUrl = await uploadImage(colorFile, `cards/color_${Date.now()}_${colorFile.name}`);

      const cardPayload: Record<string, unknown> = {
        lesson_id: lessonId,
        ...buildCardTextFields({
          cardType,
          originalWord: newCardWord,
          translation: newCardTrans,
          infinitive,
          pastSimple,
          pastParticiple,
        }),
      };
      if (grayUrl) cardPayload.image_gray_url = grayUrl;
      if (colorUrl) cardPayload.image_color_url = colorUrl;

      const cardId = editingCardId || uuidv4();
      const { error: cardError } = editingCardId
        ? await supabase.from('cards').update(cardPayload).eq('id', editingCardId).eq('lesson_id', lessonId).select('id').single()
        : await supabase.from('cards').insert([{ id: cardId, ...cardPayload, image_gray_url: grayUrl, image_color_url: colorUrl }]);

      if (cardError) throw cardError;

      const { error: clearTagsError } = await supabase.from('card_tags').delete().eq('card_id', cardId);
      if (clearTagsError) throw clearTagsError;
      if (newCardTags.length > 0) {
        const tagInserts = newCardTags.map(t => ({ card_id: cardId, tag_id: t.value }));
        const { error: tagError } = await supabase.from('card_tags').insert(tagInserts);
        if (tagError) throw tagError;
      }

      showToast(editingCardId ? 'Картку оновлено' : 'Картку додано', 'success');
      setActiveCardType(cardType);
      resetCardForm();
      await fetchCards();

    } catch (err: any) {
      showToast('Помилка: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function deleteCard(id: string) {
    if (!confirm('Видалити картку?')) return;
    try {
      await requireEditableLesson();
      if (!cards.some(card => card.id === id && card.lesson_id === lessonId)) throw new Error('Картка не належить цьому уроку.');
      const { error } = await supabase.from('cards').delete().eq('id', id).eq('lesson_id', lessonId);
      if (error) throw error;
      await fetchCards();
    } catch (error: any) {
      showToast('Помилка: ' + error.message, 'error');
    }
  }

  async function handleDeleteLesson() {
    if (!lessonId) return;
    if (!confirm(`Видалити урок «${title}» разом з його тестами та картками? Цю дію не можна скасувати.`)) return;
    setLoading(true);
    try {
      await requireEditableLesson();
      const { data: cardRows, error: cardsError } = await supabase.from('cards').select('id').eq('lesson_id', lessonId);
      if (cardsError) throw cardsError;
      const cardIds = (cardRows || []).map(c => c.id);

      if (cardIds.length > 0) {
        const { error: tagsError } = await supabase.from('card_tags').delete().in('card_id', cardIds);
        if (tagsError) throw tagsError;
        const { error: delCardsError } = await supabase.from('cards').delete().in('id', cardIds);
        if (delCardsError) throw delCardsError;
      }

      const { error } = await supabase.from('lessons').delete().eq('id', lessonId).eq('course_id', courseId);
      if (error) throw error;

      showToast('Урок видалено', 'success');
      skipNavigationWarning.current = true;
      navigate(`/courses/${courseId}`);
    } catch (error: any) {
      showToast('Помилка: ' + error.message, 'error');
      setLoading(false);
    }
  }

  if (loadError) return <div className="p-8 text-ink-400">{loadError} <Link to="/courses">До курсів</Link></div>;
  if (!initialDataLoaded) return <div className="p-8 text-ink-400">Завантаження...</div>;

  const visibleCards = cards.filter(card => (card.card_type || 'standard') === activeCardType);
  return (
    <div className="max-w-7xl mx-auto pb-20">
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) blocker.reset(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="unsaved-lesson-title" onKeyDown={event => { if (event.key === 'Escape') blocker.reset(); }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="unsaved-lesson-title" className="text-xl font-bold text-ink">Є незбережені зміни</h2>
            <p className="mt-2 text-sm text-ink-600">Якщо вийти зараз, зміни в уроці або незавершеній картці буде втрачено.</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" autoFocus onClick={() => blocker.reset()}>Продовжити редагування</Button>
              <Button type="button" onClick={() => blocker.proceed()}>Вийти без збереження</Button>
            </div>
          </div>
        </div>
      )}
      <Link to={`/courses/${courseId}`} className="inline-flex items-center text-lavender-600 hover:text-lavender-700 mb-6 font-semibold">
        <ArrowLeft size={16} className="mr-2" /> Назад до курсу
      </Link>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{lessonId ? 'Редагувати урок' : 'Створити новий урок'}</h1>
        {(lessonDirty || showCardForm) && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Незбережені зміни</span>}
      </div>

      {/* Lesson Form */}
      <Card className="mb-8">
        <div className="mb-6">
          <label className="block text-sm font-medium text-ink-600 mb-1">Назва уроку</label>
          <input required value={title} onChange={e => { setTitle(e.target.value); markLessonDirty(); }} type="text" className="w-full border border-lavender-200 rounded-lg p-2 text-lg focus:outline-none focus:ring-2 focus:ring-lavender-300" placeholder="Назва уроку..." />
        </div>

        <details className="mb-8 rounded-xl border border-lavender-200 bg-lavender-50 p-5">
          <summary className="cursor-pointer text-lg font-semibold">Збережений вступ · попередній формат</summary>
          <p className="mt-2 mb-4 text-sm text-ink-500">Ці поля зберігаються для сумісності зі старими уроками. Поточний екран читання їх не показує; основний матеріал додавайте в аркуш нижче.</p>
          <label htmlFor="intro-story" className="block text-sm font-medium mb-1">Коротка зав’язка</label>
          <textarea id="intro-story" value={introStory} onChange={e => { setIntroStory(e.target.value); markLessonDirty(); }} rows={3} className="w-full rounded-lg border border-lavender-200 bg-white p-3 mb-4" placeholder="2–3 речення про ситуацію, з якою учень навчиться справлятися." />
          <label htmlFor="intro-outcomes" className="block text-sm font-medium mb-1">Після уроку учень зможе…</label>
          <textarea id="intro-outcomes" value={introOutcomes} onChange={e => { setIntroOutcomes(e.target.value); markLessonDirty(); }} rows={3} className="w-full rounded-lg border border-lavender-200 bg-white p-3 mb-4" placeholder="Кожен результат з нового рядка. Рекомендовано 2–3 конкретні вміння." />
          <label htmlFor="intro-note" className="block text-sm font-medium mb-1">Примітка на полях · необов’язково</label>
          <textarea id="intro-note" value={introNote} onChange={e => { setIntroNote(e.target.value); markLessonDirty(); }} rows={2} className="w-full rounded-lg border border-lavender-200 bg-white p-3" placeholder="Підказка або потрібне попереднє знання." />
        </details>

        <div className="mb-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-ink">Матеріал уроку · один аркуш</h2>
            <p className="text-sm text-ink-600">Додавайте блоки в порядку читання. У застосунку урок прокручується суцільно, без меж сторінок.</p>
          </div>
          <EditorBlock ref={editorRef} initialData={{ ...content, blocks: initialBlocks }} onDirty={markLessonDirty} />
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
              <Card key={card.id} className="flex min-w-0 gap-4 p-4">
                <div className="w-16 h-16 bg-paper-100 rounded-lg overflow-hidden shrink-0">
                  {card.image_color_url ? (
                    <img src={card.image_color_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lavender-300"><ImageIcon size={20} /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="min-w-0 flex-1 break-words text-lg font-bold">
                      {activeCardType === 'irregular_verb'
                        ? [card.infinitive || card.original_word, card.past_simple, card.past_participle].filter(Boolean).join(' · ')
                        : card.original_word}
                    </h3>
                    <div className="-mt-1 -mr-1 flex shrink-0">
                      <IconButton className="p-1" title="Редагувати картку" onClick={() => openCardEditor(card)}><Pencil size={16} /></IconButton>
                      <IconButton variant="danger" className="p-1" title="Видалити картку" onClick={() => deleteCard(card.id)}><Trash2 size={16} /></IconButton>
                    </div>
                  </div>
                  <p className="break-words text-sm text-ink-600">{card.translation}</p>
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
