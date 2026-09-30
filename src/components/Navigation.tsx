import { LayoutDashboard, CalendarDays, ClipboardList, DoorOpen, Wallet, Globe } from 'lucide-react';
import { useApp, type ViewName } from '@/context/AppContext';
import { useI18n, LANGS, type Lang } from '@/context/I18nContext';
import { useState, useRef, useEffect } from 'react';

const NAV_ITEMS: { id: ViewName; labelKey: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { id: 'schedule', labelKey: 'work_schedule', icon: ClipboardList },
  { id: 'checkout', labelKey: 'checkout', icon: DoorOpen },
  { id: 'calendar', labelKey: 'calendar', icon: CalendarDays },
  { id: 'archive', labelKey: 'archive', icon: Wallet },
];

function LangSwitcher() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all text-sm font-semibold"
      >
        <Globe size={18} />
        <span className="hidden sm:inline">{LANGS.find((l) => l.code === lang)?.label}</span>
      </button>
      {open && (
        <div className="absolute top-full mt-1 end-0 bg-white rounded-xl shadow-lg border border-slate-200 py-1 min-w-[140px] z-50 animate-slide-down">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code as Lang); setOpen(false); }}
              className={`w-full text-start px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${
                lang === l.code ? 'font-bold text-slate-900' : 'text-slate-500'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { view, setView } = useApp();
  const { t } = useI18n();

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 bg-white border-l border-slate-200 p-4">
      <div className="flex items-center gap-3 px-3 py-4 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-900 leading-tight">{t('app_title')}</h1>
          <p className="text-xs text-slate-400">إدارة الشقق والحجوزات</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 mt-4 flex-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon size={20} />
              {t(item.labelKey)}
            </button>
          );
        })}
      </nav>

      <LangSwitcher />
    </aside>
  );
}

export function BottomNav() {
  const { view, setView } = useApp();
  const { t } = useI18n();

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 px-1 py-1.5 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all ${
                active ? 'text-slate-900 bg-slate-100' : 'text-slate-400'
              }`}
            >
              <Icon size={20} />
              <span className="text-[9px] font-semibold leading-tight text-center">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { LangSwitcher };
