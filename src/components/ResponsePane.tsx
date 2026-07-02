import MonacoEditor from '@monaco-editor/react';
import { useStore } from '../store';

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

export function ResponsePane() {
  const response = useStore((s) => s.response);
  const isExecuting = useStore((s) => s.isExecuting);

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-8 shrink-0 items-center px-4 bg-gray-800 border-b border-gray-700">
        <span className="text-xs font-medium text-gray-400">
          Response
          {isExecuting && <span className="ml-1.5 text-indigo-400">●</span>}
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          path="gql-ed://response"
          height="100%"
          defaultLanguage="json"
          theme="vs-dark"
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
