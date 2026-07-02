import MonacoEditor from '@monaco-editor/react';
import { useStore } from '../store';

const VARIABLES_OPTIONS = {
  minimap: { enabled: false },
  lineNumbers: 'off' as const,
  fontSize: 13,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  padding: { top: 6 },
  folding: false,
  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
};

export function BottomPanel() {
  const variablesContent = useStore((s) => s.variablesContent);
  const setVariablesContent = useStore((s) => s.setVariablesContent);

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-8 shrink-0 items-center px-4 bg-gray-800 border-b border-gray-700">
        <span className="text-xs font-medium text-gray-400">Variables</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          path="hex://variables"
          height="100%"
          defaultLanguage="json"
          theme="vs-dark"
          value={variablesContent}
          onChange={(v) => setVariablesContent(v ?? '{}')}
          options={VARIABLES_OPTIONS}
        />
      </div>
    </div>
  );
}
