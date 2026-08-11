import { useState, useCallback, createContext, useContext } from 'react';

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

  const iconMap: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  };

  const colorMap: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
    success: { bg: 'bg-mint-50',     border: 'border-mint-200',     text: 'text-mint-700',     icon: 'bg-mint-500' },
    error:   { bg: 'bg-blush-50',    border: 'border-blush-200',    text: 'text-blush-700',    icon: 'bg-blush-500' },
    info:    { bg: 'bg-lavender-50', border: 'border-lavender-200', text: 'text-lavender-700', icon: 'bg-lavender-500' },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none" style={{ maxWidth: 420 }}>
        {toasts.map(toast => {
          const c = colorMap[toast.type];
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg ${c.bg} ${c.border} animate-slide-in`}
              style={{ animation: 'slideIn 0.3s ease-out' }}
            >
              <span className={`flex-shrink-0 w-6 h-6 rounded-full ${c.icon} text-white flex items-center justify-center text-sm font-bold mt-0.5`}>
                {iconMap[toast.type]}
              </span>
              <p className={`text-sm font-medium ${c.text} flex-1`}>{toast.message}</p>
              <button
                onClick={() => dismiss(toast.id)}
                className={`flex-shrink-0 ${c.text} opacity-50 hover:opacity-100 transition-opacity text-lg leading-none mt-0.5`}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
