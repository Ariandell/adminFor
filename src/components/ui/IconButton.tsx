import type { ButtonHTMLAttributes } from 'react';

type Variant = 'default' | 'danger' | 'primary';

const variants: Record<Variant, string> = {
  default: 'text-ink-400 hover:text-lavender-600 hover:bg-lavender-50',
  danger: 'text-ink-400 hover:text-blush-600 hover:bg-blush-50',
  primary: 'text-lavender-500 hover:text-lavender-700 hover:bg-lavender-50',
};

export function iconButtonClass(variant: Variant = 'default', className = '') {
  return `inline-flex items-center justify-center p-2 rounded-lg transition ${variants[variant]} ${className}`.trim();
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export default function IconButton({ variant = 'default', className = '', ...props }: IconButtonProps) {
  return <button className={iconButtonClass(variant, className)} {...props} />;
}
