import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CreditCard, GraduationCap, Tags, Trophy, ArrowUpRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';

type Stat = { label: string; value: number | string; icon: typeof BookOpen; tone: string; href: string };

export default function DashboardPage() {
  const [counts, setCounts] = useState({ courses: 0, lessons: 0, cards: 0, tags: 0, achievements: 0 });

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('courses').select('*', { count: 'exact', head: true }),
      supabase.from('lessons').select('*', { count: 'exact', head: true }),
      supabase.from('cards').select('*', { count: 'exact', head: true }),
      supabase.from('tags').select('*', { count: 'exact', head: true }),
      supabase.from('achievements').select('*', { count: 'exact', head: true }),
    ]).then(([courses, lessons, cards, tags, achievements]) => {
      if (active) setCounts({
        courses: courses.count ?? 0,
        lessons: lessons.count ?? 0,
        cards: cards.count ?? 0,
        tags: tags.count ?? 0,
        achievements: achievements.count ?? 0,
      });
    });
    return () => { active = false; };
  }, []);

  const stats: Stat[] = [
    { label: 'Курси', value: counts.courses, icon: BookOpen, tone: 'bg-lavender-100 text-lavender-700', href: '/courses' },
    { label: 'Уроки', value: counts.lessons, icon: GraduationCap, tone: 'bg-mint-100 text-mint-700', href: '/courses' },
    { label: 'Картки', value: counts.cards, icon: CreditCard, tone: 'bg-peach-100 text-peach-700', href: '/cards' },
    { label: 'Теги', value: counts.tags, icon: Tags, tone: 'bg-butter-100 text-butter-700', href: '/tags' },
    { label: 'Досягнення', value: counts.achievements, icon: Trophy, tone: 'bg-blush-100 text-blush-700', href: '/achievements' },
  ];

  return (
    <div>
      <PageHeader title="Огляд" />
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {stats.map(({ label, value, icon: Icon, tone, href }) => (
          <Link key={label} to={href}>
            <Card className="p-5 group hover:-translate-y-0.5 hover:shadow-cozy-lg transition">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}><Icon size={20} /></div>
              <div className="mt-5 flex items-end justify-between">
                <div><p className="text-3xl font-extrabold">{value}</p><p className="text-sm text-ink-400">{label}</p></div>
                <ArrowUpRight size={18} className="text-ink-400 group-hover:text-lavender-600 transition" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-5 mt-6">
        <Card>
          <h2 className="text-lg font-bold">Контент</h2>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Link to="/courses" className="rounded-xl border border-lavender-100 p-4 hover:bg-lavender-50 transition"><BookOpen size={19} className="text-lavender-600" /><span className="block mt-2 font-semibold">Курси й уроки</span></Link>
            <Link to="/cards" className="rounded-xl border border-lavender-100 p-4 hover:bg-lavender-50 transition"><CreditCard size={19} className="text-lavender-600" /><span className="block mt-2 font-semibold">Словник карток</span></Link>
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Монетизація</h2>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Link to="/subscriptions" className="rounded-xl border border-lavender-100 p-4 hover:bg-lavender-50 transition"><CreditCard size={19} className="text-lavender-600" /><span className="block mt-2 font-semibold">Тарифи</span></Link>
            <Link to="/promo-codes" className="rounded-xl border border-lavender-100 p-4 hover:bg-lavender-50 transition"><Tags size={19} className="text-lavender-600" /><span className="block mt-2 font-semibold">Промокоди</span></Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
