import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import EditorBlock from '../components/EditorBlock';
import { type OutputData } from '@editorjs/editorjs';
import Select from 'react-select';
import { ArrowLeft, Plus, Trash2, ImageIcon } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function LessonEditorPage() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState<OutputData | undefined>();

  // Cards state
  const [cards, setCards] = useState<any[]>([]);
  const [tagsOptions, setTagsOptions] = useState<any[]>([]);

  // New Card Form
  const [showCardForm, setShowCardForm] = useState(false);
  const [newCardWord, setNewCardWord] = useState('');
  const [newCardTrans, setNewCardTrans] = useState('');
  const [newCardTags, setNewCardTags] = useState<any[]>([]);
  const [grayFile, setGrayFile] = useState<File | null>(null);
  const [colorFile, setColorFile] = useState<File | null>(null);

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
        showToast('Урок оновлено', 'success');
      } else {
        // Get next order_index
        const { count } = await supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('course_id', courseId);
        const orderIndex = (count ?? 0) + 1;

        const { data, error } = await supabase.from('lessons').insert([{ ...lessonData, order_index: orderIndex }]).select().single();
        if (error) throw error;
        showToast('Урок створено', 'success');
        navigate(`/courses/${courseId}/lessons/${data.id}`);
      }
    } catch (error: any) {
      showToast(error.message, 'error');
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

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonId) {
      showToast('Спершу збережіть урок', 'info');
      return;
    }
    setLoading(true);
    try {
      let grayUrl = null;
      let colorUrl = null;

      if (grayFile) grayUrl = await uploadImage(grayFile, `cards/gray_${Date.now()}_${grayFile.name}`);
      if (colorFile) colorUrl = await uploadImage(colorFile, `cards/color_${Date.now()}_${colorFile.name}`);

      const { data: newCard, error: cardError } = await supabase.from('cards').insert([{
        lesson_id: lessonId,
        original_word: newCardWord,
        translation: newCardTrans,
        image_gray_url: grayUrl,
        image_color_url: colorUrl
      }]).select().single();

      if (cardError) throw cardError;

      if (newCardTags.length > 0) {
        const tagInserts = newCardTags.map(t => ({ card_id: newCard.id, tag_id: t.value }));
        const { error: tagError } = await supabase.from('card_tags').insert(tagInserts);
        if (tagError) throw tagError;
      }

      setShowCardForm(false);
      setNewCardWord('');
      setNewCardTrans('');
      setNewCardTags([]);
      setGrayFile(null);
      setColorFile(null);
      fetchLessonData();

    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function deleteCard(id: string) {
    if (!confirm('Видалити картку?')) return;
    await supabase.from('cards').delete().eq('id', id);
    fetchLessonData();
  }

  if (!initialDataLoaded) return <div className="text-muted-foreground py-8">Завантаження…</div>;

  const inputClass =
    'w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground/70 transition';
  const labelClass = 'block text-[13px] font-medium text-muted-foreground mb-1.5';
  const fileClass =
    'w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-card file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-border/60 file:transition';

  return (
    <div className="pb-20">
      <Link to={`/courses/${courseId}`} className="inline-flex items-center text-[15px] text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft size={17} className="mr-1.5" /> До курсу
      </Link>

      <header className="mb-8">
        <h1 className="text-[34px] font-semibold tracking-tight leading-tight">
          {lessonId ? 'Редагування уроку' : 'Новий урок'}
        </h1>
      </header>

      {/* Lesson Form */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-8">
        <div className="mb-6">
          <label className={labelClass}>Назва уроку</label>
          <input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full rounded-xl border border-input bg-card px-4 py-3 text-lg font-medium text-foreground placeholder:text-muted-foreground/70 transition" placeholder="Введіть назву" />
        </div>

        <div className="mb-6">
          <label className={labelClass}>Контент</label>
          <p className="text-xs text-muted-foreground mb-3">
            Додавайте блоки через «+» або «/»: текст, заголовок, список, зображення, аудіо, відео чи тест.
          </p>
          <div className="rounded-xl border border-border bg-muted/40 px-2 py-1">
            <EditorBlock initialData={content} onChange={setContent} />
          </div>
        </div>

        <button
          disabled={loading}
          onClick={handleSaveLesson}
          className="bg-accent text-accent-foreground px-6 py-3 rounded-xl font-medium hover:bg-accent-hover active:scale-[0.99] disabled:opacity-50 transition-all duration-200"
        >
          {loading ? 'Збереження…' : 'Зберегти урок'}
        </button>
      </div>

      {/* Cards Section */}
      {lessonId && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-semibold tracking-tight">Картки</h2>
              <span className="text-sm text-muted-foreground">{cards.length}</span>
            </div>
            <button
              onClick={() => setShowCardForm(!showCardForm)}
              className="bg-foreground text-background px-4 py-2.5 rounded-xl text-[15px] font-medium hover:opacity-90 active:scale-[0.98] transition-all duration-200 flex items-center"
            >
              <Plus size={18} className="mr-1.5" /> Нова картка
            </button>
          </div>

          {showCardForm && (
            <form onSubmit={handleAddCard} className="bg-card p-6 rounded-2xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Слово</label>
                  <input required value={newCardWord} onChange={e => setNewCardWord(e.target.value)} type="text" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Переклад</label>
                  <input required value={newCardTrans} onChange={e => setNewCardTrans(e.target.value)} type="text" className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Теги</label>
                <Select
                  isMulti
                  options={tagsOptions}
                  value={newCardTags}
                  onChange={(val) => setNewCardTags(val as any[])}
                  placeholder="Оберіть теги"
                  classNamePrefix="select"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Сіре зображення</label>
                  <input type="file" accept="image/*" onChange={e => setGrayFile(e.target.files?.[0] || null)} className={fileClass} />
                </div>
                <div>
                  <label className={labelClass}>Кольорове зображення</label>
                  <input type="file" accept="image/*" onChange={e => setColorFile(e.target.files?.[0] || null)} className={fileClass} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCardForm(false)} className="px-4 py-2.5 text-[15px] text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors">Скасувати</button>
                <button disabled={loading} type="submit" className="bg-accent text-accent-foreground px-5 py-2.5 rounded-xl text-[15px] font-medium hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 transition-all duration-200">
                  {loading ? 'Збереження…' : 'Зберегти'}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cards.map(card => (
              <div key={card.id} className="bg-card p-4 rounded-2xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex gap-4">
                <div className="w-16 h-16 bg-muted rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                  {card.image_color_url ? (
                    <img src={card.image_color_url || "/placeholder.svg"} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={20} className="text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold text-[16px] tracking-tight truncate">{card.original_word}</h3>
                    <button onClick={() => deleteCard(card.id)} className="text-muted-foreground/60 hover:text-destructive shrink-0 transition-colors" aria-label="Видалити картку">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-muted-foreground text-sm">{card.translation}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {card.card_tags?.map((ct: any) => (
                      <span key={ct.tags?.id} className="text-xs bg-accent-soft text-accent px-2.5 py-0.5 rounded-full font-medium">
                        {ct.tags?.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {cards.length === 0 && !showCardForm && (
              <p className="text-muted-foreground text-sm py-16 col-span-2 text-center border border-dashed border-border rounded-2xl">Карток ще немає</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
