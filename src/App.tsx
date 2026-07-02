import { Component, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useStore } from './store';
import { loadSettings, loadOperations, loadEditorContent } from './lib/db';
import { refreshSchema } from './lib/schema';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { EditorPane } from './components/EditorPane';
import { BottomPanel } from './components/BottomPanel';
import { ResponsePane } from './components/ResponsePane';
import { Resizer } from './components/Resizer';
import { SettingsModal } from './components/SettingsModal';
import { DocViewer } from './components/DocViewer';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-100 p-8 gap-4">
          <p className="text-red-400 font-semibold">Something went wrong</p>
          <pre className="text-xs text-gray-400 max-w-lg whitespace-pre-wrap">
            {err.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const setEndpoint = useStore((s) => s.setEndpoint);
  const setHeaders = useStore((s) => s.setHeaders);
  const setOperations = useStore((s) => s.setOperations);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setEditorFont = useStore((s) => s.setEditorFont);
  const setEditorFontSize = useStore((s) => s.setEditorFontSize);
  const docOpen = useStore((s) => s.docOpen);

  // null = still loading from DB; string (including '') = loaded
  const [initialContent, setInitialContent] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [navigateTo, setNavigateTo] = useState<string | null>(null);

  // Pane sizes (px)
  const [sidebarWidth, setSidebarWidth] = useState(192);
  const [responseWidth, setResponseWidth] = useState(400);
  const [bottomHeight, setBottomHeight] = useState(180);
  const [docWidth, setDocWidth] = useState(300);

  useEffect(() => {
    async function boot() {
      try {
        const [settings, ops, content] = await Promise.all([
          loadSettings(),
          loadOperations(),
          loadEditorContent(),
        ]);
        setEndpoint(settings.endpoint);
        setHeaders(settings.headers);
        setEditorFont(settings.editorFont);
        setEditorFontSize(settings.editorFontSize);
        setOperations(ops);
        setInitialContent(content);
        void refreshSchema();
      } catch (err) {
        console.error('[gql-ed] boot failed:', err);
        setBootError(String(err));
        // Still show the editor — user can set endpoint via Settings
        setInitialContent('');
      }
    }
    void boot();
  }, [setEndpoint, setHeaders, setOperations, setEditorFont, setEditorFontSize]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setSettingsOpen]);

  const handleNavigate = useCallback((name: string) => {
    setNavigateTo(name);
  }, []);

  const handleNavigateHandled = useCallback(() => {
    setNavigateTo(null);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 overflow-hidden">
      <Toolbar />

      {bootError && (
        <div className="px-4 py-2 bg-red-900/40 border-b border-red-800 text-red-300 text-xs">
          DB unavailable: {bootError}. Settings won't persist.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with controlled width */}
        <div style={{ width: sidebarWidth, flexShrink: 0 }} className="overflow-hidden border-r border-gray-700">
          <Sidebar onNavigate={handleNavigate} />
        </div>

        <Resizer
          axis="x"
          size={sidebarWidth}
          min={120}
          max={480}
          onResize={setSidebarWidth}
        />

        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          {/* Request / Response panes */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            <div className="flex-1 overflow-hidden min-w-0">
              {initialContent !== null ? (
                <EditorPane
                  initialContent={initialContent}
                  navigateTo={navigateTo}
                  onNavigateHandled={handleNavigateHandled}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                  Loading…
                </div>
              )}
            </div>

            <Resizer
              axis="x"
              size={responseWidth}
              min={200}
              max={800}
              onResize={setResponseWidth}
              reverse
            />

            <div style={{ width: responseWidth, flexShrink: 0 }} className="overflow-hidden border-l border-gray-700">
              <ResponsePane />
            </div>
          </div>

          <Resizer
            axis="y"
            size={bottomHeight}
            min={60}
            max={400}
            onResize={setBottomHeight}
          />

          {/* Variables panel */}
          <div style={{ height: bottomHeight, flexShrink: 0 }} className="border-t border-gray-700 overflow-hidden">
            <BottomPanel />
          </div>
        </div>

        {/* Doc viewer (right sidebar) */}
        {docOpen && (
          <>
            <Resizer
              axis="x"
              size={docWidth}
              min={200}
              max={600}
              onResize={setDocWidth}
              reverse
            />
            <div style={{ width: docWidth, flexShrink: 0 }} className="overflow-hidden border-l border-gray-700">
              <DocViewer />
            </div>
          </>
        )}
      </div>

      <SettingsModal />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
