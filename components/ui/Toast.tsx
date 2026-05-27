import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useToastStore } from '../../store';

const borderColorMap: Record<string, string> = {
  success: 'border-l-green-500',
  error: 'border-l-red-500',
  info: 'border-l-blue-500',
  warning: 'border-l-amber-500',
};

const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            bg-slate-800 border-l-4 ${borderColorMap[toast.type] || 'border-l-blue-500'}
            rounded-lg shadow-lg px-4 py-3 flex items-start gap-3
            animate-[slideInRight_0.3s_ease-out]
          `}
        >
          <p className="text-sm text-slate-100 flex-1">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-slate-200 flex-shrink-0"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
