'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const typeStyles: Record<ToastType, string> = {
  success: 'border-brand-400/50 bg-brand-400/10 text-brand-400',
  error: 'border-danger-500/50 bg-danger-500/10 text-danger-400',
  info: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
};

const typeIcons: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2717',
  info: '\u24D8',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pb-safe"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              flex items-start gap-3 rounded-sm border px-4 py-3
              animate-[slideUp_0.2s_ease-out]
              bg-surface-900
              ${typeStyles[t.type]}
            `}
            role="alert"
          >
            <span className="text-lg leading-none mt-0.5" aria-hidden="true">
              {typeIcons[t.type]}
            </span>
            <p className="text-sm flex-1 font-mono">{t.message}</p>
            <button
              onClick={() => removeToast(t.id)}
              className="text-text-muted hover:text-text-secondary ml-2"
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
