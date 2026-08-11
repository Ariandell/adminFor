import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

const base = 'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary: 'bg-lavender-500 text-white hover:bg-lavender-600 shadow-cozy',
  secondary: 'bg-white text-ink border border-lavender-200 hover:bg-lavender-50',
  ghost: 'bg-transparent text-ink-600 hover:bg-paper-100',
  danger: 'bg-blush-500 text-white hover:bg-blush-600 shadow-cozy',
};

const sizes: Record<Size, string> = {
  md: 'px-6 py-3 text-base',
  sm: 'px-4 py-2 text-sm',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', ...props }, ref) => (
    <button ref={ref} className={buttonClass(variant, size, className)} {...props} />
  )
);
Button.displayName = 'Button';

export default Button;
