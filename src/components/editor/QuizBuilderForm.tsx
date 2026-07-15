import React, { useState, useCallback } from 'react';
import {
  Trash2, Plus, X, ArrowUp, ArrowDown,
  Circle, CheckSquare, Pencil, ListOrdered, ArrowLeftRight,
} from 'lucide-react';

/* ─────────── Types ─────────── */
enum QuestionType {
  SINGLE_CHOICE = 'single_choice',
  MULTIPLE_CHOICE = 'multiple_choice',
  TEXT_INPUT = 'text_input',
  ORDERING = 'ordering',
  MATCHING = 'matching',
}

const questionTypeLabels: Record<QuestionType, string> = {
  [QuestionType.SINGLE_CHOICE]: 'Одна правильна відповідь',
  [QuestionType.MULTIPLE_CHOICE]: 'Кілька правильних відповідей',
  [QuestionType.TEXT_INPUT]: 'Текстова відповідь',
  [QuestionType.ORDERING]: 'Впорядкування',
  [QuestionType.MATCHING]: 'Зіставлення',
};

const questionTypeIcons: Record<QuestionType, React.ComponentType<{ size?: number }>> = {
  [QuestionType.SINGLE_CHOICE]: Circle,
  [QuestionType.MULTIPLE_CHOICE]: CheckSquare,
  [QuestionType.TEXT_INPUT]: Pencil,
  [QuestionType.ORDERING]: ListOrdered,
  [QuestionType.MATCHING]: ArrowLeftRight,
};

function TypeIcon({ type, size = 14 }: { type: QuestionType; size?: number }) {
  const Icon = questionTypeIcons[type];
  return <Icon size={size} />;
}

interface Answer { text: string }
interface OrderItem { text: string; order: number }
interface MatchPair { left: string; right: string }
interface TextAnswer { value: string }

interface BaseQuestion {
  id: string;
  text: string;
  type: QuestionType;
}

interface SingleChoiceQ extends BaseQuestion {
  type: QuestionType.SINGLE_CHOICE;
  answers: Answer[];
  correctAnswerIndex: number;
}

interface MultipleChoiceQ extends BaseQuestion {
  type: QuestionType.MULTIPLE_CHOICE;
  answers: Answer[];
  correctAnswers: number[];
}

interface TextInputQ extends BaseQuestion {
  type: QuestionType.TEXT_INPUT;
  correctAnswers: TextAnswer[];
  caseSensitive: boolean;
}

interface OrderingQ extends BaseQuestion {
  type: QuestionType.ORDERING;
  items: OrderItem[];
}

interface MatchingQ extends BaseQuestion {
  type: QuestionType.MATCHING;
  pairs: MatchPair[];
}

type Question = SingleChoiceQ | MultipleChoiceQ | TextInputQ | OrderingQ | MatchingQ;

export interface QuizData {
  title: string;
  questions: Question[];
}

/* ─────────── Helpers ─────────── */
let _idCounter = 0;
function uid() { return `q_${Date.now()}_${++_idCounter}`; }

function createDefaultQuestion(type: QuestionType): Question {
  const base = { id: uid(), text: '' };
  switch (type) {
    case QuestionType.SINGLE_CHOICE:
      return { ...base, type, answers: [{ text: '' }, { text: '' }], correctAnswerIndex: -1 };
    case QuestionType.MULTIPLE_CHOICE:
      return { ...base, type, answers: [{ text: '' }, { text: '' }], correctAnswers: [] };
    case QuestionType.TEXT_INPUT:
      return { ...base, type, correctAnswers: [{ value: '' }], caseSensitive: false };
    case QuestionType.ORDERING:
      return { ...base, type, items: [{ text: '', order: 1 }, { text: '', order: 2 }, { text: '', order: 3 }] };
    case QuestionType.MATCHING:
      return { ...base, type, pairs: [{ left: '', right: '' }, { left: '', right: '' }] };
  }
}

/* ─────────── Styles (inline objects for Editor.js compatibility) ─────────── */
const S = {
  card: { border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.06)' } as React.CSSProperties,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 } as React.CSSProperties,
  badge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', fontWeight: 700, fontSize: 14, marginRight: 12, flexShrink: 0 } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 } as React.CSSProperties,
  input: { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
  textarea: { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, minHeight: 70, resize: 'vertical' as const, outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
  select: { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, background: '#fff', outline: 'none' } as React.CSSProperties,
  btnOutline: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13 } as React.CSSProperties,
  iconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', borderRadius: 6 } as React.CSSProperties,
  iconBtnDanger: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', borderRadius: 6 } as React.CSSProperties,
  row: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } as React.CSSProperties,
  addBtnArea: { padding: 16, border: '2px dashed #d1d5db', borderRadius: 12, background: '#f9fafb', display: 'flex', flexWrap: 'wrap' as const, gap: 8 } as React.CSSProperties,
  quizHeader: { background: 'linear-gradient(135deg, #eff6ff, #f5f3ff)', padding: 20, borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 20 } as React.CSSProperties,
};

/* ─────────── Question renderers ─────────── */

function SingleChoiceEditor({ q, onChange }: { q: SingleChoiceQ; onChange: (q: SingleChoiceQ) => void }) {
  return (
    <div>
      <label style={S.label}>Варіанти відповідей</label>
      {q.answers.map((a, i) => (
        <div key={i} style={S.row}>
          <input type="radio" name={`sc_${q.id}`} checked={q.correctAnswerIndex === i}
            onChange={() => onChange({ ...q, correctAnswerIndex: i })} />
          <input style={{ ...S.input, flex: 1 }} value={a.text} placeholder={`Варіант ${i + 1}`}
            onChange={e => { const ans = [...q.answers]; ans[i] = { text: e.target.value }; onChange({ ...q, answers: ans }); }} />
          {q.answers.length > 2 && (
            <button type="button" style={S.iconBtnDanger} title="Видалити варіант" onClick={() => { const ans = q.answers.filter((_, idx) => idx !== i); onChange({ ...q, answers: ans }); }}><X size={16} /></button>
          )}
        </div>
      ))}
      <button type="button" style={S.btnOutline} onClick={() => onChange({ ...q, answers: [...q.answers, { text: '' }] })}><Plus size={14} /> Додати варіант</button>
    </div>
  );
}

function MultipleChoiceEditor({ q, onChange }: { q: MultipleChoiceQ; onChange: (q: MultipleChoiceQ) => void }) {
  return (
    <div>
      <label style={S.label}>Варіанти відповідей (можна вибрати кілька)</label>
      {q.answers.map((a, i) => (
        <div key={i} style={S.row}>
          <input type="checkbox" checked={q.correctAnswers.includes(i)}
            onChange={e => {
              const ca = e.target.checked ? [...q.correctAnswers, i].sort() : q.correctAnswers.filter(v => v !== i);
              onChange({ ...q, correctAnswers: ca });
            }} />
          <input style={{ ...S.input, flex: 1 }} value={a.text} placeholder={`Варіант ${i + 1}`}
            onChange={e => { const ans = [...q.answers]; ans[i] = { text: e.target.value }; onChange({ ...q, answers: ans }); }} />
          {q.answers.length > 2 && (
            <button type="button" style={S.iconBtnDanger} title="Видалити варіант" onClick={() => { const ans = q.answers.filter((_, idx) => idx !== i); onChange({ ...q, answers: ans }); }}><X size={16} /></button>
          )}
        </div>
      ))}
      <button type="button" style={S.btnOutline} onClick={() => onChange({ ...q, answers: [...q.answers, { text: '' }] })}><Plus size={14} /> Додати варіант</button>
    </div>
  );
}

function TextInputEditor({ q, onChange }: { q: TextInputQ; onChange: (q: TextInputQ) => void }) {
  return (
    <div>
      <div style={{ ...S.row, marginBottom: 12 }}>
        <input type="checkbox" checked={q.caseSensitive}
          onChange={e => onChange({ ...q, caseSensitive: e.target.checked })} />
        <span style={{ fontSize: 14, color: '#374151' }}>Враховувати регістр букв (A ≠ a)</span>
      </div>
      <label style={S.label}>Правильні відповіді</label>
      {q.correctAnswers.map((a, i) => (
        <div key={i} style={S.row}>
          <input style={{ ...S.input, flex: 1 }} value={a.value} placeholder={`Правильна відповідь ${i + 1}`}
            onChange={e => { const ca = [...q.correctAnswers]; ca[i] = { value: e.target.value }; onChange({ ...q, correctAnswers: ca }); }} />
          {q.correctAnswers.length > 1 && (
            <button type="button" style={S.iconBtnDanger} title="Видалити відповідь" onClick={() => { const ca = q.correctAnswers.filter((_, idx) => idx !== i); onChange({ ...q, correctAnswers: ca }); }}><X size={16} /></button>
          )}
        </div>
      ))}
      <button type="button" style={S.btnOutline} onClick={() => onChange({ ...q, correctAnswers: [...q.correctAnswers, { value: '' }] })}><Plus size={14} /> Додати варіант відповіді</button>
    </div>
  );
}

function OrderingEditor({ q, onChange }: { q: OrderingQ; onChange: (q: OrderingQ) => void }) {
  const move = (from: number, to: number) => {
    const items = [...q.items];
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    onChange({ ...q, items: items.map((it, i) => ({ ...it, order: i + 1 })) });
  };
  return (
    <div>
      <label style={S.label}>Елементи в правильному порядку</label>
      {q.items.map((item, i) => (
        <div key={i} style={{ ...S.row, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', marginBottom: 6 }}>
          <span style={{ ...S.badge, width: 28, height: 28, fontSize: 13 }}>{i + 1}</span>
          <input style={{ ...S.input, flex: 1 }} value={item.text} placeholder={`Елемент ${i + 1}`}
            onChange={e => { const items = [...q.items]; items[i] = { ...items[i], text: e.target.value }; onChange({ ...q, items }); }} />
          <button type="button" style={S.iconBtn} title="Вгору" disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp size={16} /></button>
          <button type="button" style={S.iconBtn} title="Вниз" disabled={i === q.items.length - 1} onClick={() => move(i, i + 1)}><ArrowDown size={16} /></button>
          {q.items.length > 3 && (
            <button type="button" style={S.iconBtnDanger} title="Видалити елемент" onClick={() => { const items = q.items.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, order: idx + 1 })); onChange({ ...q, items }); }}><X size={16} /></button>
          )}
        </div>
      ))}
      <button type="button" style={S.btnOutline} onClick={() => onChange({ ...q, items: [...q.items, { text: '', order: q.items.length + 1 }] })}><Plus size={14} /> Додати елемент</button>
    </div>
  );
}

function MatchingEditor({ q, onChange }: { q: MatchingQ; onChange: (q: MatchingQ) => void }) {
  return (
    <div>
      <label style={S.label}>Пари для зіставлення</label>
      {q.pairs.map((pair, i) => (
        <div key={i} style={{ ...S.grid2, marginBottom: 8, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}>
          <div>
            <label style={{ ...S.label, fontSize: 12 }}>Лівий елемент</label>
            <input style={S.input} value={pair.left} placeholder="Наприклад: Apple"
              onChange={e => { const pairs = [...q.pairs]; pairs[i] = { ...pairs[i], left: e.target.value }; onChange({ ...q, pairs }); }} />
          </div>
          <div style={{ position: 'relative' }}>
            <label style={{ ...S.label, fontSize: 12 }}>Правий елемент</label>
            <input style={S.input} value={pair.right} placeholder="Наприклад: Яблуко"
              onChange={e => { const pairs = [...q.pairs]; pairs[i] = { ...pairs[i], right: e.target.value }; onChange({ ...q, pairs }); }} />
            {q.pairs.length > 2 && (
              <button type="button" style={{ ...S.iconBtnDanger, position: 'absolute', top: 0, right: 0 }} title="Видалити пару"
                onClick={() => { const pairs = q.pairs.filter((_, idx) => idx !== i); onChange({ ...q, pairs }); }}><X size={16} /></button>
            )}
          </div>
        </div>
      ))}
      <button type="button" style={S.btnOutline} onClick={() => onChange({ ...q, pairs: [...q.pairs, { left: '', right: '' }] })}><Plus size={14} /> Додати пару</button>
    </div>
  );
}

/* ─────────── Main Component ─────────── */

interface QuizBuilderProps {
  initialData?: QuizData;
  onChange: (data: QuizData) => void;
  onDelete?: () => void;
}

export function QuizBuilderForm({ initialData, onChange, onDelete }: QuizBuilderProps) {
  const [quiz, setQuiz] = useState<QuizData>(() => {
    if (initialData && initialData.questions && initialData.questions.length > 0) {
      return initialData;
    }
    return { title: '', questions: [createDefaultQuestion(QuestionType.SINGLE_CHOICE)] };
  });

  const propagate = useCallback((updated: QuizData) => {
    setQuiz(updated);
    onChange(updated);
  }, [onChange]);

  const updateQuestion = useCallback((index: number, q: Question) => {
    const newQuiz = { ...quiz, questions: quiz.questions.map((old, i) => i === index ? q : old) };
    propagate(newQuiz);
  }, [quiz, propagate]);

  const addQuestion = useCallback((type: QuestionType) => {
    propagate({ ...quiz, questions: [...quiz.questions, createDefaultQuestion(type)] });
  }, [quiz, propagate]);

  const removeQuestion = useCallback((index: number) => {
    if (quiz.questions.length <= 1) return;
    propagate({ ...quiz, questions: quiz.questions.filter((_, i) => i !== index) });
  }, [quiz, propagate]);

  const moveQuestion = useCallback((from: number, to: number) => {
    if (to < 0 || to >= quiz.questions.length) return;
    const qs = [...quiz.questions];
    const [item] = qs.splice(from, 1);
    qs.splice(to, 0, item);
    propagate({ ...quiz, questions: qs });
  }, [quiz, propagate]);

  const changeQuestionType = useCallback((index: number, newType: QuestionType) => {
    const old = quiz.questions[index];
    const newQ = { ...createDefaultQuestion(newType), id: old.id, text: old.text };
    updateQuestion(index, newQ);
  }, [quiz, updateQuestion]);

  return (
    <div>
      {/* Quiz header */}
      <div style={{ ...S.quizHeader, position: 'relative' }}>
        {onDelete && (
          <button type="button" onClick={onDelete} title="Видалити тест"
            style={{ ...S.iconBtn, position: 'absolute', top: 10, right: 10 }}
            onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; }}
            onMouseOut={e => { e.currentTarget.style.color = '#9ca3af'; }}>
            <Trash2 size={16} />
          </button>
        )}
        <div style={{ paddingRight: onDelete ? 28 : 0 }}>
          <label style={S.label}>Назва тесту</label>
          <input style={S.input} value={quiz.title} placeholder="Наприклад: Тест на знання Present Simple"
            onChange={e => propagate({ ...quiz, title: e.target.value })} />
        </div>
      </div>

      {/* Questions */}
      {quiz.questions.map((q, qIndex) => (
        <div key={q.id} style={S.card}>
          <div style={S.header}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={S.badge}>{qIndex + 1}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>Питання {qIndex + 1}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280' }}>
                  <TypeIcon type={q.type} /> {questionTypeLabels[q.type]}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              <button type="button" style={S.iconBtn} title="Вгору" disabled={qIndex === 0} onClick={() => moveQuestion(qIndex, qIndex - 1)}><ArrowUp size={16} /></button>
              <button type="button" style={S.iconBtn} title="Вниз" disabled={qIndex === quiz.questions.length - 1} onClick={() => moveQuestion(qIndex, qIndex + 1)}><ArrowDown size={16} /></button>
              <button type="button" style={S.iconBtnDanger} title="Видалити питання" disabled={quiz.questions.length <= 1} onClick={() => removeQuestion(qIndex)}><Trash2 size={16} /></button>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>Тип питання</label>
            <select style={S.select} value={q.type} onChange={e => changeQuestionType(qIndex, e.target.value as QuestionType)}>
              {Object.entries(questionTypeLabels).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>Текст питання</label>
            <textarea style={S.textarea} value={q.text} placeholder="Введіть текст питання..."
              onChange={e => updateQuestion(qIndex, { ...q, text: e.target.value } as Question)} />
          </div>

          {q.type === QuestionType.SINGLE_CHOICE && <SingleChoiceEditor q={q} onChange={updated => updateQuestion(qIndex, updated)} />}
          {q.type === QuestionType.MULTIPLE_CHOICE && <MultipleChoiceEditor q={q} onChange={updated => updateQuestion(qIndex, updated)} />}
          {q.type === QuestionType.TEXT_INPUT && <TextInputEditor q={q} onChange={updated => updateQuestion(qIndex, updated)} />}
          {q.type === QuestionType.ORDERING && <OrderingEditor q={q} onChange={updated => updateQuestion(qIndex, updated)} />}
          {q.type === QuestionType.MATCHING && <MatchingEditor q={q} onChange={updated => updateQuestion(qIndex, updated)} />}
        </div>
      ))}

      {/* Add question buttons */}
      <div style={S.addBtnArea}>
        <span style={{ width: '100%', fontSize: 13, color: '#6b7280', marginBottom: 4 }}>Додати нове питання:</span>
        {Object.entries(questionTypeLabels).map(([type, label]) => (
          <button key={type} type="button" style={S.btnOutline} onClick={() => addQuestion(type as QuestionType)}>
            <TypeIcon type={type as QuestionType} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}
