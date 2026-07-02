import { useStore } from '../store';
import { refreshSchema } from '../lib/schema';


const SCHEMA_STATUS_LABEL: Record<string, string> = {
  none: 'No Schema',
  loading: 'Loading…',
  loaded: '✓',
  error: 'Schema Error',
};

const SCHEMA_STATUS_CLASS: Record<string, string> = {
  none: 'text-slate-500',
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
    <div className="flex items-center gap-2 px-3 h-10 bg-navy-900 border-b border-navy-700 shrink-0 select-none">
      <button
        onClick={requestExecute}
        disabled={isExecuting}
        className="flex items-center gap-1.5 px-3 py-1 rounded text-sm bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-40 font-medium transition-colors"
      >
        <span>{isExecuting ? '…' : '▶'}</span>
        <span>Run</span>
        <kbd className="text-[10px] opacity-50 font-sans">⌘↵</kbd>
      </button>

      <button
        onClick={requestFormat}
        className="px-3 py-1 rounded text-sm bg-navy-800 hover:bg-navy-700 active:bg-navy-600 font-medium transition-colors"
      >
        Format
        <kbd className="ml-1.5 text-[10px] opacity-50 font-sans">⇧⌥F</kbd>
      </button>

      <button
        onClick={refreshSchema}
        className="px-3 py-1 rounded text-sm bg-navy-800 hover:bg-navy-700 active:bg-navy-600 font-medium transition-colors"
        title={schemaError ?? undefined}
      >
        Refresh Schema
      </button>

      <span className={`text-xs font-medium ${SCHEMA_STATUS_CLASS[schemaStatus]}`}>
        {SCHEMA_STATUS_LABEL[schemaStatus]}
      </span>

      <div className="flex-1" />

      <button
        onClick={() => setDocOpen(!docOpen)}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${docOpen ? 'bg-violet-700 hover:bg-violet-600 text-white' : 'bg-navy-800 hover:bg-navy-700 text-slate-200'}`}
        title="Toggle documentation panel"
      >
        Docs
      </button>

      <button
        onClick={() => setSettingsOpen(true)}
        title="Settings (⌘,)"
        className="w-8 h-8 flex items-center justify-center rounded text-slate-400 hover:text-slate-100 hover:bg-navy-800 transition-colors text-base"
      >
        ⚙
      </button>
    </div>
  );
}
