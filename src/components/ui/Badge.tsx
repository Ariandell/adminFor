interface PastelHue {
  bg: string;
  text: string;
  dot: string;
  border: string;
}

// Кожному тегу — свій пастельний колір за детермінованим хешем назви,
// щоб той самий тег завжди виглядав однаково (перегукується з прищепками в мобільному додатку).
const palette: PastelHue[] = [
  { bg: 'bg-lavender-100', text: 'text-lavender-700', dot: 'bg-lavender-400', border: 'border-lavender-200' },
  { bg: 'bg-mint-100', text: 'text-mint-700', dot: 'bg-mint-500', border: 'border-mint-200' },
  { bg: 'bg-peach-100', text: 'text-peach-700', dot: 'bg-peach-500', border: 'border-peach-200' },
  { bg: 'bg-butter-100', text: 'text-butter-700', dot: 'bg-butter-500', border: 'border-butter-200' },
  { bg: 'bg-blush-100', text: 'text-blush-700', dot: 'bg-blush-500', border: 'border-blush-200' },
];

export function pastelFor(seed: string): PastelHue {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

interface BadgeProps {
  label: string;
  seed?: string;
  className?: string;
}

export default function Badge({ label, seed, className = '' }: BadgeProps) {
  const hue = pastelFor(seed ?? label);
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${hue.bg} ${hue.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${hue.dot}`} />
      <span className="truncate">{label}</span>
    </span>
  );
}
