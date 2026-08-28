import { useRef, useEffect } from 'react';
import MonacoEditor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { PanelBottomClose, PanelBottomOpen } from 'lucide-react';
import { useStore } from '../store';
import { registerAllThemes, MONACO_THEME_MAP } from '../lib/monacoTheme';
import { saveOperationVariables } from '../lib/db';
import { getOperationVariablesSchema } from '../lib/graphql';
import { getBuiltSchema } from '../lib/schema';
import { FONT_SIZE_PRESETS } from '../lib/uiScale';
import { registerCommandPaletteShortcuts } from '../lib/keyboardShortcuts';

const VARIABLES_SCHEMA_URI = 'hex://variables-schema.json';

// Applies (or clears) the JSON schema Monaco validates/autocompletes the Variables editor
// against, derived from the currently active operation's variable declarations.
function applyVariablesSchema(monaco: typeof Monaco) {
  const { editorContent, currentOperationName } = useStore.getState();
  const schema = getBuiltSchema();
  const jsonSchema = schema && currentOperationName
    ? getOperationVariablesSchema(schema, editorContent, currentOperationName)
    : null;

  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    schemas: jsonSchema
      ? [{ uri: VARIABLES_SCHEMA_URI, fileMatch: ['hex://variables'], schema: jsonSchema }]
      : [],
  });
}

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
  registerAllThemes(monaco);
};

export function BottomPanel() {
  const variablesContent = useStore((s) => s.variablesContent);
  const setVariablesContent = useStore((s) => s.setVariablesContent);
  const currentOperationName = useStore((s) => s.currentOperationName);
  const editorContent = useStore((s) => s.editorContent);
  const schemaStatus = useStore((s) => s.schemaStatus);
  const theme = useStore((s) => s.theme);
  const fontSize = useStore((s) => s.fontSize);
  const variablesCollapsed = useStore((s) => s.variablesCollapsed);
  const setVariablesCollapsed = useStore((s) => s.setVariablesCollapsed);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  const handleMount: OnMount = (editor, monaco) => {
    monacoRef.current = monaco;
    applyVariablesSchema(monaco);
    registerCommandPaletteShortcuts(editor, monaco, useStore.getState().openCommandPalette);
  };

  // Recompute the variables schema whenever the operation's declared variables could have
  // changed (query text edited, a different operation selected, or the schema (re)loaded).
  useEffect(() => {
    const timer = setTimeout(() => {
      if (monacoRef.current) applyVariablesSchema(monacoRef.current);
    }, 400);
    return () => clearTimeout(timer);
  }, [editorContent, currentOperationName, schemaStatus]);

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
    <div
      className={`flex flex-col ${variablesCollapsed ? '' : 'h-full'}`}
      style={{ zoom: FONT_SIZE_PRESETS[fontSize].uiZoom }}
    >
      <div
        className={`flex h-8 shrink-0 items-center pl-4 pr-1 bg-navy-900 ${variablesCollapsed ? '' : 'border-b border-navy-700'}`}
        style={{ zoom: FONT_SIZE_PRESETS[fontSize].docsZoom / FONT_SIZE_PRESETS[fontSize].uiZoom }}
      >
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold tracking-widest uppercase text-slate-500">
          {currentOperationName
            ? <>Variables for <span className="font-mono normal-case tracking-normal text-slate-600">{currentOperationName}</span></>
            : 'Variables'}
        </span>
        <button
          type="button"
          onClick={() => setVariablesCollapsed(!variablesCollapsed)}
          title={variablesCollapsed ? 'Show variables panel' : 'Hide variables panel'}
          aria-label={variablesCollapsed ? 'Show variables panel' : 'Hide variables panel'}
          aria-expanded={!variablesCollapsed}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-navy-800 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          {variablesCollapsed ? <PanelBottomOpen size={15} /> : <PanelBottomClose size={15} />}
        </button>
      </div>
      {!variablesCollapsed && (
        <div className="flex-1 overflow-hidden">
          <MonacoEditor
            path="hex://variables"
            height="100%"
            defaultLanguage="json"
            theme={MONACO_THEME_MAP[theme] ?? 'hex-noir'}
            beforeMount={handleBeforeMount}
            onMount={handleMount}
            value={variablesContent}
            onChange={handleChange}
            options={VARIABLES_OPTIONS}
          />
        </div>
      )}
    </div>
  );
}
