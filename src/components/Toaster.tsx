import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store';

const TOAST_DURATION_MS = 5000;

function Toast({ id, message }: { id: number; message: string }) {
  const dismissToast = useStore((s) => s.dismissToast);

  useEffect(() => {
    const t = setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [id, dismissToast]);

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-navy-800 border border-red-900/50 rounded-lg shadow-lg text-sm text-red-300 max-w-sm">
      <span className="flex-1 leading-snug">{message}</span>
      <button
        onClick={() => dismissToast(id)}
        className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 mt-px"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <Toast key={t.id} id={t.id} message={t.message} />
      ))}
    </div>
  );
}
