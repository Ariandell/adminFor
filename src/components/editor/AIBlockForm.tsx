import { useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';

export interface AIBlockData {
  question: string;
  evaluationPrompt: string;
}

interface AIBlockFormProps {
  data: AIBlockData;
  onChange: (data: AIBlockData) => void;
  onDelete?: () => void;
}

const styles = {
  wrapper: {
    overflow: 'hidden',
    border: '1px solid #d8cef6',
    borderRadius: 16,
    background: 'linear-gradient(145deg, #ffffff 0%, #f7f4ff 100%)',
    boxShadow: '0 8px 24px rgba(105, 82, 160, 0.09)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 18px',
    borderBottom: '1px solid #e8e1f7',
    background: 'linear-gradient(135deg, #eee8ff 0%, #e2f8f3 100%)',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    color: '#3f355c',
    fontSize: 15,
    fontWeight: 700,
  },
  body: { display: 'grid', gap: 16, padding: 18 },
  label: {
    display: 'block',
    marginBottom: 6,
    color: '#4b5563',
    fontSize: 13,
    fontWeight: 700,
  },
  textarea: {
    width: '100%',
    minHeight: 92,
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
    border: '1px solid #d6d3e1',
    borderRadius: 10,
    padding: '10px 12px',
    background: '#fff',
    color: '#18272c',
    fontFamily: 'inherit',
    fontSize: 14,
    lineHeight: 1.5,
    outline: 'none',
  },
  deleteButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    border: 0,
    borderRadius: 8,
    background: 'transparent',
    color: '#8c829c',
    cursor: 'pointer',
  },
};

export function AIBlockForm({ data, onChange, onDelete }: AIBlockFormProps) {
  const [draft, setDraft] = useState<AIBlockData>(data);

  const update = (next: AIBlockData) => {
    setDraft(next);
    onChange(next);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div style={styles.title}><Sparkles size={18} /> AI-блок</div>
        {onDelete && (
          <button type="button" style={styles.deleteButton} title="Видалити AI-блок" onClick={onDelete}>
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div style={styles.body}>
        <label>
          <span style={styles.label}>Питання для студента</span>
          <textarea
            required
            style={styles.textarea}
            value={draft.question}
            placeholder="Введіть питання..."
            onChange={event => update({ ...draft, question: event.target.value })}
          />
        </label>

        <label>
          <span style={styles.label}>Промпт перевірки</span>
          <textarea
            required
            style={{ ...styles.textarea, minHeight: 128 }}
            value={draft.evaluationPrompt}
            placeholder="Опишіть критерії правильної відповіді..."
            onChange={event => update({ ...draft, evaluationPrompt: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
