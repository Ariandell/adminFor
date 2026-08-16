import { Link, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, Tags, Sparkles, LayoutDashboard, CreditCard, ClipboardCheck, Trophy, Palette, BadgePercent, Megaphone, WalletCards } from 'lucide-react';

const navGroups = [
  { label: 'Робота', items: [
    { name: 'Огляд', path: '/', icon: LayoutDashboard },
    { name: 'Курси', path: '/courses', icon: BookOpen },
    { name: 'Картки', path: '/cards', icon: CreditCard },
    { name: 'Теги', path: '/tags', icon: Tags },
    { name: 'Домашні завдання', path: '/homework', icon: ClipboardCheck },
  ]},
  { label: 'Мотивація', items: [
    { name: 'Досягнення', path: '/achievements', icon: Trophy },
    { name: 'Аватари й рамки', path: '/cosmetics', icon: Palette },
  ]},
  { label: 'Монетизація', items: [
    { name: 'Тарифи', path: '/subscriptions', icon: WalletCards },
    { name: 'Промокоди', path: '/promo-codes', icon: BadgePercent },
    { name: 'Джерела трафіку', path: '/sources', icon: Megaphone },
  ]},
];

export default function Layout() {
  const location = useLocation();
  return <div className="min-h-screen flex flex-col lg:flex-row font-sans text-ink bg-paper">
    <div className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-lavender-100">
      <div className="px-4 py-3 flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-lavender-500 text-white flex items-center justify-center"><Sparkles size={16} /></div><span className="font-extrabold">EnglishAdmin</span></div>
      <div className="flex gap-1 overflow-x-auto px-3 pb-3">{navGroups.flatMap(group => group.items).map(item => { const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)); const Icon = item.icon; return <Link key={item.path} to={item.path} className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${active ? 'bg-lavender-500 text-white' : 'bg-paper-100 text-ink-600'}`}><Icon size={15} />{item.name}</Link>; })}</div>
    </div>
    <aside className="hidden lg:flex w-72 shrink-0 bg-white/95 border-r border-lavender-100 flex-col sticky top-0 h-screen overflow-y-auto">
      <div className="p-6 border-b border-lavender-100"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-lavender-500 text-white flex items-center justify-center shadow-cozy"><Sparkles size={20} /></div><div><h1 className="text-lg font-extrabold leading-tight">EnglishAdmin</h1><p className="text-xs text-ink-400">Панель керування</p></div></div></div>
      <nav className="flex-1 p-4 space-y-6">{navGroups.map(group => <div key={group.label}><p className="px-3 mb-2 text-[11px] font-extrabold uppercase tracking-widest text-ink-400">{group.label}</p><div className="space-y-1">{group.items.map(item => { const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)); const Icon = item.icon; return <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition ${active ? 'bg-lavender-500 text-white shadow-cozy' : 'text-ink-600 hover:bg-paper-100'}`}><Icon size={18} />{item.name}</Link>; })}</div></div>)}</nav>
      <div className="p-5 text-xs text-ink-400 border-t border-lavender-100">EnglishAdmin · контент і продукт</div>
    </aside>
    <main className="flex-1 min-w-0 overflow-auto p-6 xl:p-9"><div className="max-w-7xl mx-auto"><Outlet /></div></main>
  </div>;
}
