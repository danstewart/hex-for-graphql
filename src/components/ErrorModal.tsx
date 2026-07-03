import type { ReactNode } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface Props {
  title: string;
  detail: string;
  responseBody?: string;
  onClose: () => void;
  actions?: ReactNode;
}

export function ErrorModal({ title, detail, responseBody, onClose, actions }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-navy-900 rounded-xl p-6 w-[560px] shadow-2xl border border-red-900/40 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <h2 className="text-base font-semibold text-red-400">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <pre className="text-xs text-slate-300 bg-navy-950 border border-navy-700 rounded-md p-4 whitespace-pre-wrap break-words font-mono shrink-0">
          {detail}
        </pre>

        {responseBody !== undefined && (
          <details className="mt-3 group shrink-0">
            <summary className="text-xs text-slate-500 cursor-pointer select-none hover:text-slate-400 transition-colors list-none flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              Response body
            </summary>
            <pre className="mt-2 text-xs text-slate-300 bg-navy-950 border border-navy-700 rounded-md p-4 whitespace-pre-wrap break-words font-mono overflow-y-auto max-h-64">
              {responseBody}
            </pre>
          </details>
        )}

        <div className="flex justify-end gap-2 mt-5 shrink-0">
          {actions}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
