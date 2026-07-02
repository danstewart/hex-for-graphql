import { useStore } from '../store';
import { refreshSchema } from '../lib/schema';


const SCHEMA_STATUS_LABEL: Record<string, string> = {
  none: 'No Schema',
  loading: 'Loading…',
  loaded: 'Schema Ready',
  error: 'Schema Error',
};

const SCHEMA_STATUS_CLASS: Record<string, string> = {
  none: 'text-gray-500',
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
    <div className="flex items-center gap-2 px-3 h-10 bg-gray-800 border-b border-gray-700 shrink-0 select-none">
      <button
        onClick={requestExecute}
        disabled={isExecuting}
        className="flex items-center gap-1.5 px-3 py-1 rounded text-sm bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40 font-medium transition-colors"
      >
        <span>{isExecuting ? '…' : '▶'}</span>
        <span>Run</span>
        <kbd className="text-[10px] opacity-50 font-sans">⌘↵</kbd>
      </button>

      <button
        onClick={requestFormat}
        className="px-3 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 active:bg-gray-500 font-medium transition-colors"
      >
        Format
        <kbd className="ml-1.5 text-[10px] opacity-50 font-sans">⇧⌥F</kbd>
      </button>

      <button
        onClick={refreshSchema}
        className="px-3 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 active:bg-gray-500 font-medium transition-colors"
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
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${docOpen ? 'bg-indigo-700 hover:bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
        title="Toggle documentation panel"
      >
        Docs
      </button>

      <button
        onClick={() => setSettingsOpen(true)}
        title="Settings (⌘,)"
        className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors text-base"
      >
        ⚙
      </button>
    </div>
  );
}
