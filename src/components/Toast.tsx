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
    success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', icon: 'bg-emerald-500' },
    error:   { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-800',     icon: 'bg-red-500' },
    info:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-800',    icon: 'bg-blue-500' },
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
