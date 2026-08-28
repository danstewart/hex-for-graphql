import { useEffect, useState } from 'react';
import {
  Play,
  Loader2,
  Check,
  X,
  Search,
  Settings as SettingsIcon,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useStore } from '../store';
import { refreshSchema } from '../lib/schema';
import { FONT_SIZE_PRESETS } from '../lib/uiScale';

const SCHEMA_STATUS_LABEL: Record<string, string> = {
  none: 'No Schema',
  loading: 'Loading…',
  loaded: 'Schema Loaded',
  error: 'Schema Error',
};

const SCHEMA_STATUS_CLASS: Record<string, string> = {
  none: 'text-slate-600',
  loading: 'text-warning',
  loaded: 'text-success',
  error: 'text-danger',
};

export function Toolbar() {
  const isExecuting = useStore((s) => s.isExecuting);
  const requestExecute = useStore((s) => s.requestExecute);
  const requestFormat = useStore((s) => s.requestFormat);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const openCommandPalette = useStore((s) => s.openCommandPalette);
  const schemaStatus = useStore((s) => s.schemaStatus);
  const schemaError = useStore((s) => s.schemaError);
  const setErrorModal = useStore((s) => s.setErrorModal);
  const docOpen = useStore((s) => s.docOpen);
  const setDocOpen = useStore((s) => s.setDocOpen);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useStore((s) => s.setSidebarCollapsed);
  const fontSize = useStore((s) => s.fontSize);
  const [showLoaded, setShowLoaded] = useState(false);
  const [loadedVisible, setLoadedVisible] = useState(false);

  useEffect(() => {
    if (schemaStatus !== 'loaded') {
      setShowLoaded(false);
      setLoadedVisible(false);
      return;
    }

    setShowLoaded(true);
    setLoadedVisible(true);
    const fadeTimer = window.setTimeout(() => setLoadedVisible(false), 4500);
    const hideTimer = window.setTimeout(() => setShowLoaded(false), 5000);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [schemaStatus]);

  return (
    <div
      className="flex items-center gap-1.5 px-3 h-10 bg-navy-900 border-b border-navy-700 shrink-0 select-none"
      style={{ zoom: FONT_SIZE_PRESETS[fontSize].uiZoom }}
    >
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        className="w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-navy-800 transition-colors shrink-0"
      >
        {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
      </button>

      <div className="w-px h-4 bg-navy-700 mx-0.5" />

      <button
        onClick={requestExecute}
        disabled={isExecuting}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium text-accent-foreground bg-accent hover:bg-accent-hover active:bg-accent-active disabled:opacity-40 transition-all hover:shadow-[0_0_14px_var(--accent-glow)] disabled:shadow-none"
      >
        {isExecuting ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Play size={12} fill="currentColor" />
        )}
        <span>Run</span>
        <kbd className="text-[10px] opacity-40 font-sans tracking-tight">⌘↵</kbd>
      </button>

      <div className="w-px h-4 bg-navy-700 mx-0.5" />

      <button
        onClick={requestFormat}
        className="px-2.5 py-1.5 rounded-md text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-navy-800 active:bg-navy-700 transition-colors"
      >
        Format
        <kbd className="ml-1.5 text-[10px] opacity-40 font-sans">⇧⌥F</kbd>
      </button>

      <button
        onClick={refreshSchema}
        className="px-2.5 py-1.5 rounded-md text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-navy-800 active:bg-navy-700 transition-colors"
      >
        Refresh Schema
      </button>

      {schemaStatus === 'error' ? (
        <button
          onClick={() => setErrorModal({ title: 'Schema Error', detail: schemaError ?? '' })}
          className={`flex items-center gap-1 text-xs font-medium ${SCHEMA_STATUS_CLASS.error} hover:text-danger-hover transition-colors`}
        >
          <X size={12} />
          {SCHEMA_STATUS_LABEL.error}
        </button>
      ) : schemaStatus === 'loading' ? (
        <span className={`flex items-center gap-1 text-xs font-medium ${SCHEMA_STATUS_CLASS.loading}`}>
          <Loader2 size={12} className="animate-spin" />
          {SCHEMA_STATUS_LABEL.loading}
        </span>
      ) : schemaStatus === 'loaded' ? (
        showLoaded && (
          <span className={`flex items-center gap-1 text-xs font-medium transition-opacity duration-500 ${SCHEMA_STATUS_CLASS.loaded} ${loadedVisible ? 'opacity-100' : 'opacity-0'}`}>
            <Check size={12} />
            {SCHEMA_STATUS_LABEL.loaded}
          </span>
        )
      ) : (
        <span className={`flex items-center gap-1 text-xs font-medium ${SCHEMA_STATUS_CLASS.none}`}>
          {SCHEMA_STATUS_LABEL.none}
        </span>
      )}

      <div className="flex-1" />

      <button
        onClick={() => openCommandPalette('navigate')}
        title="Quick Open (⌘P)"
        className="w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-navy-800 transition-colors"
      >
        <Search size={15} />
      </button>

      <button
        onClick={() => setDocOpen(!docOpen)}
        className={`px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
          docOpen
            ? 'bg-accent-soft text-accent hover:bg-accent-soft-hover'
            : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800'
        }`}
        title="Toggle documentation panel"
      >
        Docs
      </button>

      <button
        onClick={() => setSettingsOpen(true)}
        title="Settings (⌘,)"
        className="w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-navy-800 transition-colors"
      >
        <SettingsIcon size={15} />
      </button>
    </div>
  );
}
