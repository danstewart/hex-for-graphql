import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { saveSettings } from '../lib/db';
import { refreshSchema } from '../lib/schema';

export function SettingsModal() {
  const settingsOpen = useStore((s) => s.settingsOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const storeEndpoint = useStore((s) => s.endpoint);
  const storeHeaders = useStore((s) => s.headers);
  const setEndpoint = useStore((s) => s.setEndpoint);
  const setHeaders = useStore((s) => s.setHeaders);

  const [endpoint, setLocalEndpoint] = useState('');
  const [headers, setLocalHeaders] = useState<[string, string][]>([]);

  // Sync local state when modal opens
  useEffect(() => {
    if (!settingsOpen) return;
    setLocalEndpoint(storeEndpoint);
    setLocalHeaders(storeHeaders.length > 0 ? storeHeaders : [['', '']]);
  }, [settingsOpen, storeEndpoint, storeHeaders]);

  async function handleSave() {
    const cleanHeaders = headers.filter(([k]) => k.trim() !== '');
    setEndpoint(endpoint);
    setHeaders(cleanHeaders);
    await saveSettings(endpoint, cleanHeaders);
    setSettingsOpen(false);
    // Schema refresh is async — kick it off and don't await
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

  if (!settingsOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={() => setSettingsOpen(false)}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 w-[520px] shadow-2xl border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-5">Settings</h2>

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
