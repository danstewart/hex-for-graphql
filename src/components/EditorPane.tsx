import { useEffect, useRef, useMemo } from 'react';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useStore } from '../store';
import { runOperation } from '../lib/actions';
import { findOperationLine, findOperationAtLine, formatOperationAtLine } from '../lib/graphql';
import { saveEditorContent } from '../lib/db';
import { setMonacoInstance } from '../lib/schema';

interface Props {
  initialContent: string;
  navigateTo: string | null;
  onNavigateHandled: () => void;
}

const BASE_EDITOR_OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  wordWrap: 'off',
  automaticLayout: true,
  padding: { top: 8 },
  renderLineHighlight: 'gutter',
  folding: true,
  quickSuggestions: { other: true, comments: false, strings: true },
  quickSuggestionsDelay: 0,
  acceptSuggestionOnEnter: 'smart',
  suggestOnTriggerCharacters: true,
  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
};

export function EditorPane({ initialContent, navigateTo, onNavigateHandled }: Props) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const contentRef = useRef(initialContent);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const operations = useStore((s) => s.operations);
  const setEditorContent = useStore((s) => s.setEditorContent);
  const executeRequested = useStore((s) => s.executeRequested);
  const formatRequested = useStore((s) => s.formatRequested);
  const editorFont = useStore((s) => s.editorFont);
  const editorFontSize = useStore((s) => s.editorFontSize);

  const editorOptions = useMemo(() => ({
    ...BASE_EDITOR_OPTIONS,
    fontFamily: editorFont,
    fontSize: editorFontSize,
  }), [editorFont, editorFontSize]);

  // Run operation (triggered from toolbar or ⌘↵ outside the editor focus)
  useEffect(() => {
    if (executeRequested === 0) return;
    const editor = editorRef.current;
    if (!editor) return;
    const content = editor.getValue();
    const line = editor.getPosition()?.lineNumber ?? 1;
    void runOperation(content, line);
  }, [executeRequested]);

  // Format the operation at the cursor (triggered from toolbar button)
  useEffect(() => {
    if (formatRequested === 0) return;
    const editor = editorRef.current;
    if (!editor) return;
    const line = editor.getPosition()?.lineNumber ?? 1;
    const result = formatOperationAtLine(editor.getValue(), line);
    if (!result) return;
    const model = editor.getModel();
    if (!model) return;
    model.pushEditOperations(
      [],
      [
        {
          range: {
            startLineNumber: result.startLine,
            startColumn: 1,
            endLineNumber: result.endLine,
            endColumn: model.getLineMaxColumn(result.endLine),
          },
          text: result.formatted,
        },
      ],
      () => null,
    );
  }, [formatRequested]);

  // Navigate to operation when sidebar item is clicked
  useEffect(() => {
    if (!navigateTo) return;
    const editor = editorRef.current;
    if (!editor) return;
    let line = findOperationLine(editor.getValue(), navigateTo);
    if (line == null) {
      const op = operations.find((o) => o.name === navigateTo);
      if (op) {
        const current = editor.getValue();
        const trimmed = current.trimEnd();
        const newContent = trimmed ? trimmed + '\n\n' + op.body : op.body;
        editor.setValue(newContent);
        contentRef.current = newContent;
        setEditorContent(newContent);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => { void saveEditorContent(newContent); }, 1000);
        line = findOperationLine(newContent, navigateTo);
      }
    }
    if (line != null) {
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    }
    onNavigateHandled();
  }, [navigateTo, onNavigateHandled, operations, setEditorContent]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    const model = editor.getModel();
    console.log('[gql-ed] EditorPane mounted, model URI:', model?.uri.toString(), 'language:', model?.getLanguageId());
    console.log('[gql-ed] monaco.languages.graphql:', (monaco.languages as unknown as Record<string, unknown>)['graphql']);

    // Give the schema module access to the Monaco instance so it can register
    // the in-process completion provider.
    setMonacoInstance(monaco);

    // Ctrl+. forces the suggestion popup (mirrors VS Code muscle memory)
    editor.addCommand(monaco.KeyMod.WinCtrl | monaco.KeyCode.Period, () => {
      editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
    });

    // ⌘↵ runs the operation at the cursor
    editor.addAction({
      id: 'gql-ed.run',
      label: 'Run GraphQL Operation',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: (ed) => {
        const content = ed.getValue();
        const line = ed.getPosition()?.lineNumber ?? 1;
        void runOperation(content, line);
      },
    });

    // Update window title to reflect the operation at cursor
    editor.onDidChangeCursorPosition(() => {
      const pos = editor.getPosition();
      if (!pos) return;
      const opName = findOperationAtLine(editor.getValue(), pos.lineNumber);
      document.title = opName ? `gql-ed — ${opName}` : 'gql-ed';
    });

    if (initialContent) {
      editor.setValue(initialContent);
      contentRef.current = initialContent;
    }
  };

  function handleChange(value: string | undefined) {
    const v = value ?? '';
    contentRef.current = v;
    setEditorContent(v);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveEditorContent(v);
    }, 1000);
  }

  return (
    <MonacoEditor
      path="gql-ed://operation.graphql"
      height="100%"
      defaultLanguage="graphql"
      theme="vs-dark"
      defaultValue=""
      options={editorOptions}
      onMount={handleMount}
      onChange={handleChange}
      loading={
        <div className="h-full flex items-center justify-center text-gray-600 text-sm">
          Loading editor…
        </div>
      }
    />
  );
}
