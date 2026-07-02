import MonacoEditor, { type BeforeMount } from '@monaco-editor/react';
import { useStore } from '../store';
import { registerTheme, THEME_NAME } from '../lib/monacoTheme';

const RESPONSE_OPTIONS = {
  minimap: { enabled: false },
  lineNumbers: 'off' as const,
  fontSize: 13,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  padding: { top: 6 },
  readOnly: true,
  folding: true,
  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
};

const handleBeforeMount: BeforeMount = (monaco) => {
  registerTheme(monaco);
};

export function ResponsePane() {
  const response = useStore((s) => s.response);
  const isExecuting = useStore((s) => s.isExecuting);

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-8 shrink-0 items-center px-4 bg-navy-900 border-b border-navy-700">
        <span className="text-xs font-medium text-slate-400">
          Response
          {isExecuting && <span className="ml-1.5 text-violet-400">●</span>}
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          path="hex://response"
          height="100%"
          defaultLanguage="json"
          theme={THEME_NAME}
          beforeMount={handleBeforeMount}
          value={
            isExecuting
              ? '// Executing…'
              : (response ?? '// Response will appear here after you run an operation.')
          }
          options={RESPONSE_OPTIONS}
        />
      </div>
    </div>
  );
}
