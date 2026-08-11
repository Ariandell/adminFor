import type { HTMLAttributes } from 'react';

type Tone = 'default' | 'accent';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
}

const tones: Record<Tone, string> = {
  default: 'bg-white border-lavender-100',
  accent: 'bg-lavender-50 border-lavender-200',
};

export function cardClass(tone: Tone = 'default', className = '') {
  return `rounded-2xl border shadow-cozy p-6 ${tones[tone]} ${className}`.trim();
}

export default function Card({ tone = 'default', className = '', ...props }: CardProps) {
  return <div className={cardClass(tone, className)} {...props} />;
}
