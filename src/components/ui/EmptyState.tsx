import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  className?: string;
}

export default function EmptyState({ icon, title, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center py-12 px-6 rounded-2xl border-2 border-dashed border-lavender-200 bg-lavender-50/40 text-ink-600 ${className}`}>
      {icon && <div className="text-lavender-300">{icon}</div>}
      <p>{title}</p>
    </div>
  );
}
