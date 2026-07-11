import { useState, useCallback, createContext, useContext } from 'react';
import { Check, X, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const iconMap: Record<ToastType, React.ReactNode> = {
    success: <Check size={14} strokeWidth={3} />,
    error: <X size={14} strokeWidth={3} />,
    info: <Info size={14} strokeWidth={3} />,
  };

  const iconBg: Record<ToastType, string> = {
    success: 'bg-success',
    error: 'bg-destructive',
    info: 'bg-accent',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none" style={{ maxWidth: 380 }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 pl-3 pr-4 py-3 rounded-2xl border border-border bg-card/90 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.14)]"
            style={{ animation: 'slideIn 0.28s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <span className={`flex-shrink-0 w-6 h-6 rounded-full ${iconBg[toast.type]} text-white flex items-center justify-center`}>
              {iconMap[toast.type]}
            </span>
            <p className="text-[14px] font-medium text-foreground flex-1 leading-snug">{toast.message}</p>
            <button
              onClick={() => dismiss(toast.id)}
              className="flex-shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
              aria-label="Закрити"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
