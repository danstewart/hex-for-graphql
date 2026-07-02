import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { saveSettings } from '../lib/db';
import { refreshSchema } from '../lib/schema';

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
  const setEndpoint = useStore((s) => s.setEndpoint);
  const setHeaders = useStore((s) => s.setHeaders);
  const storeEditorFont = useStore((s) => s.editorFont);
  const storeEditorFontSize = useStore((s) => s.editorFontSize);
  const setEditorFont = useStore((s) => s.setEditorFont);
  const setEditorFontSize = useStore((s) => s.setEditorFontSize);

  const [endpoint, setLocalEndpoint] = useState('');
  const [headers, setLocalHeaders] = useState<[string, string][]>([]);
  const [editorFont, setLocalEditorFont] = useState('');
  const [editorFontSize, setLocalEditorFontSize] = useState(14);
  const [installedFonts, setInstalledFonts] = useState<string[]>([]);

  // Sync local state when modal opens
  useEffect(() => {
    if (!settingsOpen) return;
    setLocalEndpoint(storeEndpoint);
    setLocalHeaders(storeHeaders.length > 0 ? storeHeaders : [['', '']]);
    setLocalEditorFont(storeEditorFont);
    setLocalEditorFontSize(storeEditorFontSize);
    setInstalledFonts(detectInstalledFonts(FONT_CANDIDATES));
  }, [settingsOpen, storeEndpoint, storeHeaders, storeEditorFont, storeEditorFontSize]);

  async function handleSave() {
    const cleanHeaders = headers.filter(([k]) => k.trim() !== '');
    const clampedSize = Math.max(8, Math.min(32, editorFontSize));
    const fontValue = editorFont.trim() || 'Monaco, monospace';
    setEndpoint(endpoint);
    setHeaders(cleanHeaders);
    setEditorFont(fontValue);
    setEditorFontSize(clampedSize);
    await saveSettings(endpoint, cleanHeaders, fontValue, clampedSize);
    setSettingsOpen(false);
    void refreshSchema();
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

  function applyFontSuggestion(name: string) {
    setLocalEditorFont(`${name}, monospace`);
  }

  if (!settingsOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={() => setSettingsOpen(false)}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 w-[520px] shadow-2xl border border-gray-700 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-5">Settings</h2>

        {/* Connection */}
        <label className="block mb-1 text-xs text-gray-400 uppercase tracking-wider">
          GraphQL Endpoint
        </label>
        <input
          type="url"
          value={endpoint}
          onChange={(e) => setLocalEndpoint(e.target.value)}
          placeholder="https://api.example.com/graphql"
          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm mb-5 focus:outline-none focus:border-indigo-500 placeholder-gray-600"
          autoFocus
        />

        <label className="block mb-2 text-xs text-gray-400 uppercase tracking-wider">
          Headers
        </label>
        <div className="space-y-2 mb-2">
          {headers.map(([key, value], i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={key}
                onChange={(e) => updateHeader(i, 0, e.target.value)}
                placeholder="Key"
                className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500 placeholder-gray-600"
              />
              <input
                value={value}
                onChange={(e) => updateHeader(i, 1, e.target.value)}
                placeholder="Value"
                className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500 placeholder-gray-600"
              />
              <button
                onClick={() => removeHeader(i)}
                className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addHeader}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors mb-6"
        >
          + Add header
        </button>

        {/* Editor appearance */}
        <div className="border-t border-gray-700 pt-5 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">Editor</p>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block mb-1 text-xs text-gray-500">Font Family</label>
              <input
                type="text"
                value={editorFont}
                onChange={(e) => setLocalEditorFont(e.target.value)}
                placeholder="Monaco, monospace"
                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 placeholder-gray-600"
                style={{ fontFamily: editorFont || undefined }}
              />
              {installedFonts.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
                  {installedFonts.map((f) => (
                    <button
                      key={f}
                      onClick={() => applyFontSuggestion(f)}
                      className="text-[11px] text-gray-500 hover:text-indigo-400 transition-colors"
                      style={{ fontFamily: `${f}, monospace` }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-24 shrink-0">
              <label className="block mb-1 text-xs text-gray-500">Font Size</label>
              <input
                type="number"
                value={editorFontSize}
                onChange={(e) => setLocalEditorFontSize(Number(e.target.value))}
                min={8}
                max={32}
                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Preview */}
          <div
            className="mt-3 px-3 py-2 bg-gray-900 rounded border border-gray-700 text-gray-400"
            style={{ fontFamily: editorFont || 'Monaco, monospace', fontSize: editorFontSize }}
          >
            query GetUser($id: ID!) &#123; user(id: $id) &#123; name &#125; &#125;
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-700">
          <button
            onClick={() => setSettingsOpen(false)}
            className="px-4 py-2 rounded text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded text-sm bg-indigo-600 hover:bg-indigo-500 font-medium transition-colors"
          >
            Save &amp; Refresh Schema
          </button>
        </div>
      </div>
    </div>
  );
}
