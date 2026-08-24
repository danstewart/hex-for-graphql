import { Component, useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useStore } from './store';
import { loadSettings, loadOperations, loadEditorContent, loadAllOperationVariables, loadLayout, saveLayout } from './lib/db';
import { refreshSchema } from './lib/schema';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { EditorPane } from './components/EditorPane';
import { BottomPanel } from './components/BottomPanel';
import { ResponsePane } from './components/ResponsePane';
import { Resizer } from './components/Resizer';
import { SettingsModal } from './components/SettingsModal';
import { DocViewer } from './components/DocViewer';
import { CommandPalette } from './components/CommandPalette';
import { ErrorModal } from './components/ErrorModal';
import { Toaster } from './components/Toaster';
import { normalizeThemeId } from './lib/themes';

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
        <div className="h-screen flex flex-col items-center justify-center bg-navy-950 text-slate-100 p-8 gap-4">
          <p className="text-danger font-semibold">Something went wrong</p>
          <pre className="text-xs text-slate-400 max-w-lg whitespace-pre-wrap">
            {err.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded bg-navy-800 hover:bg-navy-700 text-sm"
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
  const setCookies = useStore((s) => s.setCookies);
  const setOperations = useStore((s) => s.setOperations);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const openCommandPalette = useStore((s) => s.openCommandPalette);
  const errorModal = useStore((s) => s.errorModal);
  const setErrorModal = useStore((s) => s.setErrorModal);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const setEditorFont = useStore((s) => s.setEditorFont);
  const setFontSize = useStore((s) => s.setFontSize);
  const setOperationVariables = useStore((s) => s.setOperationVariables);
  const docOpen = useStore((s) => s.docOpen);
  const setDocOpen = useStore((s) => s.setDocOpen);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useStore((s) => s.setSidebarCollapsed);
  const variablesCollapsed = useStore((s) => s.variablesCollapsed);
  const setVariablesCollapsed = useStore((s) => s.setVariablesCollapsed);

  // null = still loading from DB; string (including '') = loaded
  const [initialContent, setInitialContent] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [navigateTo, setNavigateTo] = useState<string | null>(null);

  // Pane sizes (px) — hydrated from the DB once boot() resolves; see layoutLoadedRef below.
  const [sidebarWidth, setSidebarWidth] = useState(192);
  const [bottomHeight, setBottomHeight] = useState(180);
  const [docWidth, setDocWidth] = useState(300);
  // Guards the layout-persistence effect from firing (and clobbering saved values)
  // before the DB-loaded layout has actually been applied to state.
  const layoutLoadedRef = useRef(false);

  // Request/response split tracked as a fraction so it stays proportional
  // when the container resizes (e.g. docs panel opens/closes).
  const centerRef = useRef<HTMLDivElement>(null);
  const [centerWidth, setCenterWidth] = useState(0);
  const [responseFraction, setResponseFraction] = useState(0.45);
  // A hardcoded response max (e.g. 800) put an effective floor under the editor's width
  // equal to centerWidth - 800 — on a typical window that's a few hundred px the editor
  // could never shrink past. Derive the cap from centerWidth instead so the editor can
  // always be dragged down to EDITOR_MIN_WIDTH regardless of how wide the window is.
  const EDITOR_MIN_WIDTH = 100;
  const responseMax = centerWidth > 0 ? Math.max(200, centerWidth - EDITOR_MIN_WIDTH) : 800;
  const responseWidth = centerWidth > 0
    ? Math.max(200, Math.min(responseMax, Math.round(centerWidth * responseFraction)))
    : 400;

  useLayoutEffect(() => {
    const el = centerRef.current;
    if (!el) return;
    setCenterWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => setCenterWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Synchronously snap centerWidth when docs panel opens/closes so responseWidth
  // is correct on the very first paint after the transition.
  useLayoutEffect(() => {
    const el = centerRef.current;
    if (el) setCenterWidth(el.clientWidth);
  }, [docOpen]);

  const handleResponseResize = useCallback((px: number) => {
    if (centerWidth > 0) setResponseFraction(px / centerWidth);
  }, [centerWidth]);

  useEffect(() => {
    async function boot() {
      const [settingsResult, opsResult, contentResult, opVarsResult, layoutResult] = await Promise.allSettled([
        loadSettings(),
        loadOperations(),
        loadEditorContent(),
        loadAllOperationVariables(),
        loadLayout(),
      ]);

      const failures: string[] = [];
      const check = <T,>(result: PromiseSettledResult<T>, name: string, fallback: T): T => {
        if (result.status === 'rejected') {
          console.error(`[hex] boot: ${name} failed`, result.reason);
          failures.push(name);
          return fallback;
        }
        return result.value;
      };

      const defaultSettings = { endpoint: '', headers: [] as [string,string][], cookies: [] as [string,string][], editorFont: 'Geist Mono, monospace', fontSize: 'medium' as const, theme: 'noir' };
      const defaultLayout = { sidebarWidth: 192, bottomHeight: 180, docWidth: 300, responseFraction: 0.45, docOpen: false, sidebarCollapsed: false, variablesCollapsed: false };
      const settings = check(settingsResult, 'settings', defaultSettings);
      const ops      = check(opsResult,      'operations', []);
      const content  = check(contentResult,  'editor content', '');
      const opVars   = check(opVarsResult,   'variables', {});
      const layout   = check(layoutResult,   'layout', defaultLayout);

      setEndpoint(settings.endpoint);
      setHeaders(settings.headers);
      setCookies(settings.cookies);
      setEditorFont(settings.editorFont);
      setFontSize(settings.fontSize);
      setTheme(normalizeThemeId(settings.theme));
      setOperations(ops);
      setOperationVariables(opVars);
      setInitialContent(content);
      setSidebarWidth(layout.sidebarWidth);
      setBottomHeight(layout.bottomHeight);
      setDocWidth(layout.docWidth);
      setResponseFraction(layout.responseFraction);
      setDocOpen(layout.docOpen);
      setSidebarCollapsed(layout.sidebarCollapsed);
      setVariablesCollapsed(layout.variablesCollapsed);
      layoutLoadedRef.current = true;

      if (failures.length > 0) {
        setBootError(`Failed to load: ${failures.join(', ')}`);
      }

      void refreshSchema();
    }
    void boot();
  }, [setEndpoint, setHeaders, setCookies, setOperations, setEditorFont, setFontSize, setOperationVariables, setTheme, setDocOpen, setSidebarCollapsed, setVariablesCollapsed]);

  // Persist pane sizes and open/collapsed panel states, debounced,
  // once the initial layout has actually been hydrated from the DB (otherwise the
  // pre-load defaults would immediately overwrite whatever was saved before this run).
  useEffect(() => {
    if (!layoutLoadedRef.current) return;
    const timer = setTimeout(() => {
      void saveLayout({ sidebarWidth, bottomHeight, docWidth, responseFraction, docOpen, sidebarCollapsed, variablesCollapsed });
    }, 500);
    return () => clearTimeout(timer);
  }, [sidebarWidth, bottomHeight, docWidth, responseFraction, docOpen, sidebarCollapsed, variablesCollapsed]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        openCommandPalette(e.shiftKey ? 'commands' : 'navigate');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setSettingsOpen, openCommandPalette]);

  const handleNavigate = useCallback((name: string) => {
    setNavigateTo(name);
  }, []);

  const handleNavigateHandled = useCallback(() => {
    setNavigateTo(null);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-navy-950 text-slate-100 overflow-hidden">
      <Toolbar />

      {bootError && (
        <div className="px-4 py-2 bg-danger-surface border-b border-danger-border text-danger text-xs">
          DB unavailable: {bootError}. Changes may not persist this session.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with controlled width */}
        {!sidebarCollapsed && (
          <>
            <div style={{ width: sidebarWidth, flexShrink: 0 }} className="overflow-hidden border-r border-navy-700">
              <Sidebar onNavigate={handleNavigate} />
            </div>

            <Resizer
              axis="x"
              size={sidebarWidth}
              min={120}
              max={480}
              onResize={setSidebarWidth}
            />
          </>
        )}

        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          {/* Request / Response panes */}
          <div ref={centerRef} className="flex flex-1 overflow-hidden min-h-0">
            <div className="flex-1 overflow-hidden min-w-0">
              {initialContent !== null ? (
                <EditorPane
                  initialContent={initialContent}
                  navigateTo={navigateTo}
                  onNavigateHandled={handleNavigateHandled}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-600 text-sm">
                  Loading…
                </div>
              )}
            </div>

            <Resizer
              axis="x"
              size={responseWidth}
              min={200}
              max={responseMax}
              onResize={handleResponseResize}
              reverse
            />

            <div style={{ width: responseWidth, flexShrink: 0 }} className="overflow-hidden border-l border-navy-700">
              <ResponsePane />
            </div>
          </div>

          {!variablesCollapsed && (
            <>
              <Resizer
                axis="y"
                size={bottomHeight}
                min={60}
                max={400}
                onResize={setBottomHeight}
              />

              {/* Variables panel */}
              <div style={{ height: bottomHeight, flexShrink: 0 }} className="border-t border-navy-700 overflow-hidden">
                <BottomPanel />
              </div>
            </>
          )}
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
            <div style={{ width: docWidth, flexShrink: 0 }} className="overflow-hidden border-l border-navy-700">
              <DocViewer />
            </div>
          </>
        )}
      </div>

      <SettingsModal />
      <CommandPalette onNavigateOperation={handleNavigate} />
      <Toaster />
      {errorModal && (
        <ErrorModal
          title={errorModal.title}
          detail={errorModal.detail}
          responseBody={errorModal.responseBody}
          onClose={() => setErrorModal(null)}
          actions={
            <button
              onClick={() => { setErrorModal(null); setSettingsOpen(true); }}
              className="px-4 py-2 rounded-md text-sm bg-navy-800 hover:bg-navy-700 text-slate-300 transition-colors"
            >
              Open Settings
            </button>
          }
        />
      )}
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
