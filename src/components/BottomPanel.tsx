import { useRef } from 'react';
import MonacoEditor, { type BeforeMount } from '@monaco-editor/react';
import { useStore } from '../store';
import { registerTheme, THEME_NAME } from '../lib/monacoTheme';
import { saveOperationVariables } from '../lib/db';

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

const handleBeforeMount: BeforeMount = (monaco) => {
  registerTheme(monaco);
};

export function BottomPanel() {
  const variablesContent = useStore((s) => s.variablesContent);
  const setVariablesContent = useStore((s) => s.setVariablesContent);
  const currentOperationName = useStore((s) => s.currentOperationName);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(v: string | undefined) {
    const value = v ?? '{}';
    setVariablesContent(value);
    const opName = useStore.getState().currentOperationName;
    if (opName) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => { void saveOperationVariables(opName, value); }, 1000);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-8 shrink-0 items-center px-4 bg-navy-900 border-b border-navy-700">
        <span className="text-xs font-medium text-slate-400">
          {currentOperationName ? <>Variables for <em>{currentOperationName}</em></> : 'Variables'}
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          path="hex://variables"
          height="100%"
          defaultLanguage="json"
          theme={THEME_NAME}
          beforeMount={handleBeforeMount}
          value={variablesContent}
          onChange={handleChange}
          options={VARIABLES_OPTIONS}
        />
      </div>
    </div>
  );
}
