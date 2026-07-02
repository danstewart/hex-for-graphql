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
};

const RESPONSE_OPTIONS = {
  minimap: { enabled: false },
  lineNumbers: 'off' as const,
  fontSize: 13,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  padding: { top: 6 },
  readOnly: true,
  folding: true,
};

export function BottomPanel() {
  const activeBottomPanel = useStore((s) => s.activeBottomPanel);
  const setActiveBottomPanel = useStore((s) => s.setActiveBottomPanel);
  const variablesContent = useStore((s) => s.variablesContent);
  const setVariablesContent = useStore((s) => s.setVariablesContent);
  const response = useStore((s) => s.response);
  const isExecuting = useStore((s) => s.isExecuting);

  const tabs = ['variables', 'response'] as const;

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex h-8 shrink-0 bg-gray-800 border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveBottomPanel(tab)}
            className={[
              'px-4 text-xs font-medium capitalize transition-colors',
              activeBottomPanel === tab
                ? 'border-b-2 border-indigo-400 text-white'
                : 'text-gray-400 hover:text-gray-200',
            ].join(' ')}
          >
            {tab}
            {tab === 'response' && isExecuting && (
              <span className="ml-1.5 text-indigo-400">●</span>
            )}
          </button>
        ))}
      </div>

      {/* Both editors stay mounted; only one is visible at a time.
          Unique `path` props guarantee separate Monaco models so content
          never bleeds between the two panels on tab switches. */}
      <div className="flex-1 overflow-hidden relative">
        <div className={activeBottomPanel === 'variables' ? 'absolute inset-0' : 'absolute inset-0 invisible'}>
          <MonacoEditor
            path="gql-ed://variables"
            height="100%"
            defaultLanguage="json"
            theme="vs-dark"
            value={variablesContent}
            onChange={(v) => setVariablesContent(v ?? '{}')}
            options={VARIABLES_OPTIONS}
          />
        </div>
        <div className={activeBottomPanel === 'response' ? 'absolute inset-0' : 'absolute inset-0 invisible'}>
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
    </div>
  );
}
