import { Link, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, Tags, Sparkles } from 'lucide-react';

export default function Layout() {
  const location = useLocation();

  const navItems = [
    { name: 'Курси', path: '/', icon: BookOpen },
    { name: 'Теги', path: '/tags', icon: Tags },
  ];

  return (
    <div className="min-h-screen flex font-sans text-ink bg-paper">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-lavender-100 flex flex-col">
        <div className="p-6 border-b border-lavender-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lavender-100 text-lavender-600 flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold text-lavender-600 leading-tight truncate">EnglishAdmin</h1>
              <p className="text-xs text-ink-400">Панель керування</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors ${
                  isActive ? 'bg-lavender-100 text-lavender-700' : 'text-ink-600 hover:bg-paper-100'
                }`}
              >
                <Icon size={19} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-6 text-xs text-ink-400 border-t border-lavender-100">
          EnglishAdmin · курси, уроки та слова
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
