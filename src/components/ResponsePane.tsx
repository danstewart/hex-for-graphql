import MonacoEditor, { type BeforeMount } from '@monaco-editor/react';
import { useStore } from '../store';
import { registerAllThemes, MONACO_THEME_MAP } from '../lib/monacoTheme';
import { FONT_SIZE_PRESETS } from '../lib/uiScale';

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
  registerAllThemes(monaco);
};

export function ResponsePane() {
  const response = useStore((s) => s.response);
  const isExecuting = useStore((s) => s.isExecuting);
  const theme = useStore((s) => s.theme);
  const fontSize = useStore((s) => s.fontSize);

  return (
    <div className="flex flex-col h-full" style={{ zoom: FONT_SIZE_PRESETS[fontSize].uiZoom }}>
      <div className="flex h-8 shrink-0 items-center px-4 bg-navy-900 border-b border-navy-700">
        <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-500">
          Response
          {isExecuting && (
            <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse align-middle" />
          )}
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          path="hex://response"
          height="100%"
          defaultLanguage="json"
          theme={MONACO_THEME_MAP[theme] ?? 'hex-noir'}
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
