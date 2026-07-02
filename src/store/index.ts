import { create } from 'zustand';

export interface Operation {
  id: number;
  name: string;
  type: 'query' | 'mutation' | 'subscription';
  body: string;
  last_run_at: string | null;
}

interface AppState {
  // Connection settings
  endpoint: string;
  headers: [string, string][];

  // Sidebar
  operations: Operation[];

  // Editor
  editorContent: string;

  // Bottom panels
  variablesContent: string;
  response: string | null;
  isExecuting: boolean;
  activeBottomPanel: 'variables' | 'response';

  // Signals (incrementing counter pattern — avoids re-render storms from boolean flips)
  executeRequested: number;
  formatRequested: number;

  // Editor appearance
  editorFont: string;
  editorFontSize: number;

  // Schema
  schemaStatus: 'none' | 'loading' | 'loaded' | 'error';
  schemaError: string | null;

  // Modals
  settingsOpen: boolean;

  // Doc viewer
  docOpen: boolean;

  // Setters
  setEndpoint: (v: string) => void;
  setHeaders: (v: [string, string][]) => void;
  setOperations: (v: Operation[]) => void;
  setEditorContent: (v: string) => void;
  setVariablesContent: (v: string) => void;
  setResponse: (v: string | null) => void;
  setIsExecuting: (v: boolean) => void;
  setActiveBottomPanel: (v: 'variables' | 'response') => void;
  requestExecute: () => void;
  requestFormat: () => void;
  setEditorFont: (v: string) => void;
  setEditorFontSize: (v: number) => void;
  setSettingsOpen: (v: boolean) => void;
  setSchemaStatus: (status: 'none' | 'loading' | 'loaded' | 'error', error?: string) => void;
  setDocOpen: (v: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  endpoint: '',
  headers: [],
  operations: [],
  editorContent: '',
  variablesContent: '{}',
  response: null,
  isExecuting: false,
  activeBottomPanel: 'variables',
  executeRequested: 0,
  formatRequested: 0,
  editorFont: 'Monaco, monospace',
  editorFontSize: 14,
  schemaStatus: 'none',
  schemaError: null,
  settingsOpen: false,
  docOpen: false,

  setEndpoint: (endpoint) => set({ endpoint }),
  setHeaders: (headers) => set({ headers }),
  setOperations: (operations) => set({ operations }),
  setEditorContent: (editorContent) => set({ editorContent }),
  setVariablesContent: (variablesContent) => set({ variablesContent }),
  setResponse: (response) => set({ response }),
  setIsExecuting: (isExecuting) => set({ isExecuting }),
  setActiveBottomPanel: (activeBottomPanel) => set({ activeBottomPanel }),
  requestExecute: () => set((s) => ({ executeRequested: s.executeRequested + 1 })),
  requestFormat: () => set((s) => ({ formatRequested: s.formatRequested + 1 })),
  setEditorFont: (editorFont) => set({ editorFont }),
  setEditorFontSize: (editorFontSize) => set({ editorFontSize }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setSchemaStatus: (schemaStatus, error) => set({ schemaStatus, schemaError: error ?? null }),
  setDocOpen: (docOpen) => set({ docOpen }),
}));
