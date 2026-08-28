import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { useStore } from '../store';
import { saveSettings } from '../lib/db';
import { refreshSchema } from '../lib/schema';
import { FONT_SIZE_PRESETS, type FontSizePreset } from '../lib/uiScale';
import { APP_THEMES, type ThemeId } from '../lib/themes';

const FONT_CANDIDATES = [
  'Monaco',
  'Menlo',
  'SF Mono',
  'JetBrains Mono',
  'Fira Code',
  'Fira Mono',
  'Cascadia Code',
  'Cascadia Mono',
  'Consolas',
  'Courier New',
  'Source Code Pro',
  'IBM Plex Mono',
  'Hack',
  'Inconsolata',
  'Maple Mono',
  'Maple Mono NF',
  'Roboto Mono',
  'Ubuntu Mono',
];

function domFontInstalled(name: string): boolean {
  const span = document.createElement('span');
  Object.assign(span.style, {
    position: 'fixed',
    top: '-9999px',
    fontSize: '200px',
    whiteSpace: 'nowrap',
  });
  span.textContent = 'mmmmmmmmmmlli';
  document.body.appendChild(span);

  const measure = (family: string) => {
    span.style.fontFamily = family;
    return span.getBoundingClientRect().width;
  };

  // Compare against three generic families so a font that happens to match
  // the system `monospace` alias (e.g. Monaco = system monospace) is still
  // detected via the serif or sans-serif comparison.
  const refs = ['monospace', 'serif', 'sans-serif'];
  const baselines = refs.map(r => measure(r));
  const installed = refs.some((r, i) => measure(`"${name}", ${r}`) !== baselines[i]);

  document.body.removeChild(span);
  return installed;
}

function detectInstalledFonts(candidates: string[]): string[] {
  return candidates.filter(domFontInstalled);
}

export function SettingsModal() {
  const settingsOpen = useStore((s) => s.settingsOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const storeEndpoint = useStore((s) => s.endpoint);
  const storeHeaders = useStore((s) => s.headers);
  const storeCookies = useStore((s) => s.cookies);
  const setEndpoint = useStore((s) => s.setEndpoint);
  const setHeaders = useStore((s) => s.setHeaders);
  const setCookies = useStore((s) => s.setCookies);
  const storeEditorFont = useStore((s) => s.editorFont);
  const storeFontSize = useStore((s) => s.fontSize);
  const setEditorFont = useStore((s) => s.setEditorFont);
  const setFontSize = useStore((s) => s.setFontSize);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  const [endpoint, setLocalEndpoint] = useState('');
  const [headers, setLocalHeaders] = useState<[string, string][]>([]);
  const [cookies, setLocalCookies] = useState<[string, string][]>([]);
  const [editorFont, setLocalEditorFont] = useState('');
  const [fontSize, setLocalFontSize] = useState<FontSizePreset>('medium');
  const [installedFonts, setInstalledFonts] = useState<string[]>([]);

  // Sync local state when modal opens
  useEffect(() => {
    if (!settingsOpen) return;
    setLocalEndpoint(storeEndpoint);
    setLocalHeaders(storeHeaders.length > 0 ? storeHeaders : [['', '']]);
    setLocalCookies(storeCookies.length > 0 ? storeCookies : [['', '']]);
    setLocalEditorFont(storeEditorFont);
    setLocalFontSize(storeFontSize);
    setInstalledFonts(detectInstalledFonts(FONT_CANDIDATES));
  }, [settingsOpen, storeEndpoint, storeHeaders, storeCookies, storeEditorFont, storeFontSize]);

  const cleanHeaders = headers.filter(([k]) => k.trim() !== '');
  const cleanCookies = cookies.filter(([name]) => name.trim() !== '');
  const schemaSettingsChanged = endpoint !== storeEndpoint
    || JSON.stringify(cleanHeaders) !== JSON.stringify(storeHeaders)
    || JSON.stringify(cleanCookies) !== JSON.stringify(storeCookies);

  async function handleSave() {
    const fontValue = editorFont.trim() || 'Geist Mono, monospace';
    setEndpoint(endpoint);
    setHeaders(cleanHeaders);
    setCookies(cleanCookies);
    setEditorFont(fontValue);
    setFontSize(fontSize);
    try {
      await saveSettings(endpoint, cleanHeaders, cleanCookies, fontValue, fontSize, theme);
    } catch (err) {
      useStore.getState().addToast(`Settings saved in memory but failed to persist: ${String(err)}`);
    }
    setSettingsOpen(false);
    if (schemaSettingsChanged) void refreshSchema();
  }

  function addHeader() {
    setLocalHeaders((h) => [...h, ['', '']]);
  }

  function removeHeader(i: number) {
    setLocalHeaders((h) => h.filter((_, j) => j !== i));
  }

  function updateHeader(i: number, field: 0 | 1, val: string) {
    setLocalHeaders((h) =>
      h.map((pair, j): [string, string] =>
        j === i ? (field === 0 ? [val, pair[1]] : [pair[0], val]) : pair,
      ),
    );
  }

  function addCookie() {
    setLocalCookies((c) => [...c, ['', '']]);
  }

  function removeCookie(i: number) {
    setLocalCookies((c) => c.filter((_, j) => j !== i));
  }

  function updateCookie(i: number, field: 0 | 1, val: string) {
    setLocalCookies((c) =>
      c.map((pair, j): [string, string] =>
        j === i ? (field === 0 ? [val, pair[1]] : [pair[0], val]) : pair,
      ),
    );
  }

  function applyFontSuggestion(name: string) {
    setLocalEditorFont(`${name}, monospace`);
  }

  function handleThemeChange(id: ThemeId) {
    setTheme(id);
  }

  if (!settingsOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={() => setSettingsOpen(false)}
    >
      <div
        className="bg-navy-900 rounded-xl p-6 w-[520px] shadow-2xl border border-navy-700 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-5">Settings</h2>

        {/* Connection */}
        <label className="block mb-1 text-xs text-slate-400 uppercase tracking-wider">
          GraphQL Endpoint
        </label>
        <input
          type="url"
          value={endpoint}
          onChange={(e) => setLocalEndpoint(e.target.value)}
          placeholder="https://api.example.com/graphql"
          className="w-full bg-navy-950 border border-navy-700 rounded-md px-3 py-2 text-sm mb-5 focus:outline-none focus:border-accent placeholder-slate-600"
          autoFocus
        />

        <label className="block mb-2 text-xs text-slate-400 uppercase tracking-wider">
          Headers
        </label>
        <div className="space-y-2 mb-2">
          {headers.map(([key, value], i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={key}
                onChange={(e) => updateHeader(i, 0, e.target.value)}
                placeholder="Key"
                className="flex-1 bg-navy-950 border border-navy-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent placeholder-slate-600"
              />
              <input
                value={value}
                onChange={(e) => updateHeader(i, 1, e.target.value)}
                placeholder="Value"
                className="flex-1 bg-navy-950 border border-navy-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent placeholder-slate-600"
              />
              <button
                onClick={() => removeHeader(i)}
                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-danger transition-colors shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addHeader}
          className="text-xs text-accent hover:text-accent-hover transition-colors mb-6"
        >
          + Add header
        </button>

        <label className="block mb-2 text-xs text-slate-400 uppercase tracking-wider">
          Cookies
        </label>
        <div className="space-y-2 mb-2">
          {cookies.map(([name, value], i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={name}
                onChange={(e) => updateCookie(i, 0, e.target.value)}
                placeholder="Name"
                className="flex-1 bg-navy-950 border border-navy-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent placeholder-slate-600"
              />
              <input
                value={value}
                onChange={(e) => updateCookie(i, 1, e.target.value)}
                placeholder="Value"
                className="flex-1 bg-navy-950 border border-navy-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent placeholder-slate-600"
              />
              <button
                onClick={() => removeCookie(i)}
                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-danger transition-colors shrink-0"
                aria-label={`Remove cookie ${name || i + 1}`}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addCookie}
          className="text-xs text-accent hover:text-accent-hover transition-colors mb-6"
        >
          + Add cookie
        </button>

        {/* Theme */}
        <div className="border-t border-navy-700 pt-5 mb-6">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Theme</p>
          <div className="grid grid-cols-4 gap-3">
            {APP_THEMES.map((t) => {
              const active = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleThemeChange(t.id)}
                  title={`${t.label} · ${t.family}`}
                  className={`flex flex-col items-center gap-2 p-2 rounded-lg border transition-colors ${
                    active
                      ? 'border-accent bg-accent-soft'
                      : 'border-navy-700 hover:border-navy-600'
                  }`}
                >
                  <div className="flex rounded overflow-hidden w-16 h-8 relative ring-1 ring-inset ring-white/10">
                    {t.swatches.map((c) => (
                      <div key={c} style={{ background: c }} className="flex-1" />
                    ))}
                    {active && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check size={14} className="text-accent" />
                      </div>
                    )}
                  </div>
                  <span className={`text-xs ${active ? 'text-accent' : 'text-slate-500'}`}>
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor appearance */}
        <div className="border-t border-navy-700 pt-5 mb-6">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-4">Editor</p>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block mb-1 text-xs text-slate-500">Font Family</label>
              <input
                type="text"
                value={editorFont}
                onChange={(e) => setLocalEditorFont(e.target.value)}
                placeholder="Geist Mono, monospace"
                className="w-full bg-navy-950 border border-navy-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent placeholder-slate-600"
                style={{ fontFamily: editorFont || undefined }}
              />
              {installedFonts.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
                  {installedFonts.map((f) => (
                    <button
                      key={f}
                      onClick={() => applyFontSuggestion(f)}
                      className="text-[11px] text-slate-500 hover:text-accent transition-colors"
                      style={{ fontFamily: `${f}, monospace` }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-52 shrink-0">
              <label className="block mb-1 text-xs text-slate-500">UI Size</label>
              <div className="flex gap-1 bg-navy-950 border border-navy-700 rounded-md p-1">
                {(Object.keys(FONT_SIZE_PRESETS) as FontSizePreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLocalFontSize(preset)}
                    className={`flex-1 rounded px-1.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      fontSize === preset
                        ? 'bg-accent text-accent-foreground'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800'
                    }`}
                  >
                    {FONT_SIZE_PRESETS[preset].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div
            className="mt-3 px-3 py-2 bg-navy-950 rounded-md border border-navy-700 text-slate-400"
            style={{ fontFamily: editorFont || 'Geist Mono, monospace', fontSize: FONT_SIZE_PRESETS[fontSize].editor }}
          >
            query GetUser($id: ID!) &#123; user(id: $id) &#123; name &#125; &#125;
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-navy-700">
          <button
            onClick={() => setSettingsOpen(false)}
            className="px-4 py-2 rounded-md text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md text-sm text-accent-foreground bg-accent hover:bg-accent-hover font-medium transition-colors"
          >
            {schemaSettingsChanged ? 'Save & Refresh Schema' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
