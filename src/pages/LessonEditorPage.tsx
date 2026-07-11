import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import EditorBlock from '../components/EditorBlock';
import { type OutputData } from '@editorjs/editorjs';
import Select from 'react-select';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
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

  async function handleAddCard(e: React.FormEvent) {
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

  if (!initialDataLoaded) return <div className="p-8">Завантаження...</div>;

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <Link to={`/courses/${courseId}`} className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6 font-medium">
        <ArrowLeft size={16} className="mr-2" /> Назад до курсу
      </Link>

      <h1 className="text-3xl font-bold mb-8">{lessonId ? 'Редагувати урок' : 'Створити новий урок'}</h1>

      {/* Lesson Form */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Назва уроку</label>
          <input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full border rounded-lg p-2 text-lg" placeholder="Назва уроку..." />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Контент уроку</label>
          <p className="text-xs text-gray-400 mb-3">
            Використовуйте «+» або «/» щоб додати блоки: текст, заголовок, список, цитату, зображення, аудіо, YouTube відео, тест та інше.
          </p>
          <EditorBlock initialData={content} onChange={setContent} />
        </div>

        <button disabled={loading} onClick={handleSaveLesson}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition text-lg">
          {loading ? 'Збереження...' : 'Зберегти урок'}
        </button>
      </div>

      {/* Cards Section */}
      {lessonId && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Картки (Слова)</h2>
            <button onClick={() => setShowCardForm(!showCardForm)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center">
              <Plus size={18} className="mr-2" /> Додати картку
            </button>
          </div>

          {showCardForm && (
            <form onSubmit={handleAddCard} className="bg-green-50 p-6 rounded-2xl border border-green-200 mb-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Оригінал слова</label>
                  <input required value={newCardWord} onChange={e => setNewCardWord(e.target.value)} type="text" className="w-full border rounded-lg p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Переклад</label>
                  <input required value={newCardTrans} onChange={e => setNewCardTrans(e.target.value)} type="text" className="w-full border rounded-lg p-2" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Теги</label>
                <Select
                  isMulti
                  options={tagsOptions}
                  value={newCardTags}
                  onChange={(val) => setNewCardTags(val as any[])}
                  placeholder="Оберіть теги..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Сіре фото (Gray)</label>
                  <input type="file" accept="image/*" onChange={e => setGrayFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Кольорове фото (Color)</label>
                  <input type="file" accept="image/*" onChange={e => setColorFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowCardForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Скасувати</button>
                <button disabled={loading} type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50">
                  {loading ? 'Збереження...' : 'Зберегти картку'}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.map(card => (
              <div key={card.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                  {card.image_color_url ? (
                    <img src={card.image_color_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No img</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h3 className="font-bold text-lg">{card.original_word}</h3>
                    <button onClick={() => deleteCard(card.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-gray-600 text-sm">{card.translation}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {card.card_tags?.map((ct: any) => (
                      <span key={ct.tags?.id} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
                        {ct.tags?.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {cards.length === 0 && !showCardForm && (
              <p className="text-gray-500 text-sm py-4 col-span-2 text-center border-2 border-dashed rounded-xl p-8">Картки ще не додано</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
