import { Link, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, Tags, GraduationCap } from 'lucide-react';

export default function Layout() {
  const location = useLocation();

  const navItems = [
    { name: 'Курси', path: '/', icon: BookOpen },
    { name: 'Теги', path: '/tags', icon: Tags },
  ];

  return (
    <div className="min-h-screen bg-background flex font-sans text-foreground antialiased">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border bg-card/70 backdrop-blur-xl flex flex-col fixed inset-y-0 left-0">
        <div className="h-20 flex items-center gap-3 px-6">
          <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center">
            <GraduationCap size={20} className="text-background" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Академія</span>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] transition-all duration-200 ${
                  isActive
                    ? 'bg-accent text-accent-foreground font-medium shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon size={19} strokeWidth={2} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-5 text-xs text-muted-foreground">
          Панель керування
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 overflow-auto">
        <div className="max-w-5xl mx-auto px-8 py-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
