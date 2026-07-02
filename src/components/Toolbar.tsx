import { Play, Loader2, Check, Settings as SettingsIcon } from 'lucide-react';
import { useStore } from '../store';
import { refreshSchema } from '../lib/schema';

const SCHEMA_STATUS_LABEL: Record<string, string> = {
  none: 'No Schema',
  loading: 'Loading…',
  loaded: 'Schema Loaded',
  error: 'Schema Error',
};

const SCHEMA_STATUS_CLASS: Record<string, string> = {
  none: 'text-slate-600',
  loading: 'text-yellow-400',
  loaded: 'text-green-400',
  error: 'text-red-400',
};

export function Toolbar() {
  const isExecuting = useStore((s) => s.isExecuting);
  const requestExecute = useStore((s) => s.requestExecute);
  const requestFormat = useStore((s) => s.requestFormat);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const schemaStatus = useStore((s) => s.schemaStatus);
  const schemaError = useStore((s) => s.schemaError);
  const docOpen = useStore((s) => s.docOpen);
  const setDocOpen = useStore((s) => s.setDocOpen);

  return (
    <div className="flex items-center gap-1.5 px-3 h-10 bg-navy-900 border-b border-navy-700 shrink-0 select-none">
      <button
        onClick={requestExecute}
        disabled={isExecuting}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-40 transition-all hover:shadow-[0_0_14px_rgba(139,92,246,0.45)] disabled:shadow-none"
      >
        {isExecuting ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Play size={12} fill="currentColor" />
        )}
        <span>Run</span>
        <kbd className="text-[10px] opacity-40 font-sans tracking-tight">⌘↵</kbd>
      </button>

      <div className="w-px h-4 bg-navy-700 mx-0.5" />

      <button
        onClick={requestFormat}
        className="px-2.5 py-1.5 rounded-md text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-navy-800 active:bg-navy-700 transition-colors"
      >
        Format
        <kbd className="ml-1.5 text-[10px] opacity-40 font-sans">⇧⌥F</kbd>
      </button>

      <button
        onClick={refreshSchema}
        className="px-2.5 py-1.5 rounded-md text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-navy-800 active:bg-navy-700 transition-colors"
        title={schemaError ?? undefined}
      >
        Refresh Schema
      </button>

      <span className={`flex items-center gap-1 text-xs font-medium ${SCHEMA_STATUS_CLASS[schemaStatus]}`}>
        {schemaStatus === 'loaded' && <Check size={12} />}
        {SCHEMA_STATUS_LABEL[schemaStatus]}
      </span>

      <div className="flex-1" />

      <button
        onClick={() => setDocOpen(!docOpen)}
        className={`px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
          docOpen
            ? 'bg-violet-600/30 text-violet-300 hover:bg-violet-600/40'
            : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800'
        }`}
        title="Toggle documentation panel"
      >
        Docs
      </button>

      <button
        onClick={() => setSettingsOpen(true)}
        title="Settings (⌘,)"
        className="w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-navy-800 transition-colors"
      >
        <SettingsIcon size={15} />
      </button>
    </div>
  );
}
