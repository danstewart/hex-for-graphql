import { useEffect, useRef, useMemo } from 'react';
import MonacoEditor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { registerAllThemes, MONACO_THEME_MAP } from '../lib/monacoTheme';
import { FONT_SIZE_PRESETS } from '../lib/uiScale';
import { useStore } from '../store';
import { runOperation } from '../lib/actions';
import { findOperationLine, findOperationAtLine, formatOperationAtLine, resolveDocTarget } from '../lib/graphql';
import { saveEditorContent, renameOperationVariables } from '../lib/db';
import { setMonacoInstance, getBuiltSchema } from '../lib/schema';

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
  fixedOverflowWidgets: true,
};

export function EditorPane({ initialContent, navigateTo, onNavigateHandled }: Props) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef(initialContent);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeOpRef = useRef<{ name: string | null; startLine: number | null }>({ name: null, startLine: null });
  const modKeyRef = useRef(false);
  const hoverDecorationsRef = useRef<string[]>([]);

  const operations = useStore((s) => s.operations);
  const setEditorContent = useStore((s) => s.setEditorContent);
  const executeRequested = useStore((s) => s.executeRequested);
  const formatRequested = useStore((s) => s.formatRequested);
  const editorFont = useStore((s) => s.editorFont);
  const fontSize = useStore((s) => s.fontSize);
  const editorFontSize = FONT_SIZE_PRESETS[fontSize].editor;
  const theme = useStore((s) => s.theme);
  const setDocOpen = useStore((s) => s.setDocOpen);
  const setDocTarget = useStore((s) => s.setDocTarget);

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

  // Track ctrl/cmd key state so the mousemove handler in handleMount knows whether to
  // show the "jump to docs" hover affordance; clear any leftover decoration on key-up.
  useEffect(() => {
    function onKeyChange(e: KeyboardEvent) {
      const isMod = e.ctrlKey || e.metaKey;
      if (modKeyRef.current === isMod) return;
      modKeyRef.current = isMod;
      if (!isMod) {
        const editor = editorRef.current;
        if (editor) hoverDecorationsRef.current = editor.deltaDecorations(hoverDecorationsRef.current, []);
      }
    }
    window.addEventListener('keydown', onKeyChange);
    window.addEventListener('keyup', onKeyChange);
    return () => {
      window.removeEventListener('keydown', onKeyChange);
      window.removeEventListener('keyup', onKeyChange);
    };
  }, []);

  // Explicitly re-layout on container resize rather than relying solely on Monaco's
  // built-in `automaticLayout` polling — in the Tauri desktop webview that polling can
  // miss rapid pane-resize drags, leaving the editor visually stuck at its old width.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => editorRef.current?.layout());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleBeforeMount: BeforeMount = (monaco) => {
    registerAllThemes(monaco);
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    const model = editor.getModel();
    console.log('[hex] EditorPane mounted, model URI:', model?.uri.toString(), 'language:', model?.getLanguageId());
    console.log('[hex] monaco.languages.graphql:', (monaco.languages as unknown as Record<string, unknown>)['graphql']);

    // Give the schema module access to the Monaco instance so it can register
    // the in-process completion provider.
    setMonacoInstance(monaco);

    // Ctrl+. forces the suggestion popup (mirrors VS Code muscle memory)
    editor.addCommand(monaco.KeyMod.WinCtrl | monaco.KeyCode.Period, () => {
      editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
    });

    // ⌘P opens the command palette.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
      useStore.getState().setCommandPaletteOpen(true);
    });

    // ⌘↵ runs the operation at the cursor.
    // addCommand takes exclusive ownership of the keybinding, preventing Monaco's
    // built-in "insert line below" from firing first and moving the cursor.
    editor.addAction({
      id: 'hex.run',
      label: 'Run GraphQL Operation',
      run: (ed) => {
        const content = ed.getValue();
        const line = ed.getPosition()?.lineNumber ?? 1;
        void runOperation(content, line);
      },
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      const content = editor.getValue();
      const line = editor.getPosition()?.lineNumber ?? 1;
      void runOperation(content, line);
    });

    // Ctrl/Cmd+click a field or type name to jump to its entry in the docs panel.
    editor.onMouseDown((e) => {
      if (!(e.event.ctrlKey || e.event.metaKey)) return;
      const position = e.target.position;
      if (!position) return;
      const schema = getBuiltSchema();
      if (!schema) return;
      const target = resolveDocTarget(schema, editor.getValue(), editor.getModel()!.getOffsetAt(position));
      if (!target) return;
      e.event.preventDefault();
      setDocOpen(true);
      setDocTarget(target);
    });

    // Underline the token under the cursor while ctrl/cmd is held, so the click target
    // is discoverable — mirrors the "go to definition" hover affordance in code editors.
    editor.onMouseMove((e) => {
      if (!modKeyRef.current) return;
      const position = e.target.position;
      const model = editor.getModel();
      const schema = getBuiltSchema();
      const word = position ? model?.getWordAtPosition(position) : null;
      const target = position && model && schema
        ? resolveDocTarget(schema, editor.getValue(), model.getOffsetAt(position))
        : null;
      hoverDecorationsRef.current = editor.deltaDecorations(
        hoverDecorationsRef.current,
        target && word && position
          ? [{
              range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
              options: { inlineClassName: 'hex-doc-link' },
            }]
          : [],
      );
    });

    editor.onMouseLeave(() => {
      hoverDecorationsRef.current = editor.deltaDecorations(hoverDecorationsRef.current, []);
    });

    // Update window title and variables pane when cursor moves to a different operation
    editor.onDidChangeCursorPosition(() => {
      const pos = editor.getPosition();
      if (!pos) return;
      const content = editor.getValue();
      const opName = findOperationAtLine(content, pos.lineNumber);
      document.title = opName ? `Hex — ${opName}` : 'Hex';
      if (opName !== activeOpRef.current.name) {
        const opInfo = opName ? formatOperationAtLine(content, pos.lineNumber) : null;
        const newStartLine = opInfo?.startLine ?? null;
        const store = useStore.getState();
        if (opName && newStartLine !== null && newStartLine === activeOpRef.current.startLine) {
          // Same position, name changed — rename, carry variables over
          const oldName = activeOpRef.current.name;
          store.renameCurrentOperation(opName);
          if (oldName) void renameOperationVariables(oldName, opName);
        } else {
          store.setCurrentOperationName(opName);
        }
        activeOpRef.current = { name: opName, startLine: newStartLine };
      }
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
    <div className="flex flex-col h-full">
      <div
        className="flex h-8 shrink-0 items-center px-4 bg-navy-900 border-b border-navy-700"
        style={{ zoom: FONT_SIZE_PRESETS[fontSize].docsZoom }}
      >
        <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-500">Request</span>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden">
        <MonacoEditor
          path="hex://operation.graphql"
          height="100%"
          defaultLanguage="graphql"
          theme={MONACO_THEME_MAP[theme] ?? 'hex-noir'}
          defaultValue=""
          options={editorOptions}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          onChange={handleChange}
          loading={
            <div className="h-full flex items-center justify-center text-slate-600 text-sm">
              Loading editor…
            </div>
          }
        />
      </div>
    </div>
  );
}
