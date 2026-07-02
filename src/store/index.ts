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
  operationVariables: Record<string, string>;
  currentOperationName: string | null;
  response: string | null;
  isExecuting: boolean;

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
  setCurrentOperationName: (name: string | null) => void;
  renameCurrentOperation: (newName: string) => void;
  setOperationVariables: (v: Record<string, string>) => void;
  setResponse: (v: string | null) => void;
  setIsExecuting: (v: boolean) => void;
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
  operationVariables: {},
  currentOperationName: null,
  response: null,
  isExecuting: false,
  executeRequested: 0,
  formatRequested: 0,
  editorFont: 'Geist Mono, monospace',
  editorFontSize: 14,
  schemaStatus: 'none',
  schemaError: null,
  settingsOpen: false,
  docOpen: false,

  setEndpoint: (endpoint) => set({ endpoint }),
  setHeaders: (headers) => set({ headers }),
  setOperations: (operations) => set({ operations }),
  setEditorContent: (editorContent) => set({ editorContent }),
  setVariablesContent: (variablesContent) => set((s) => ({
    variablesContent,
    operationVariables: s.currentOperationName
      ? { ...s.operationVariables, [s.currentOperationName]: variablesContent }
      : s.operationVariables,
  })),
  setCurrentOperationName: (name) => set((s) => {
    const saved = s.currentOperationName
      ? { ...s.operationVariables, [s.currentOperationName]: s.variablesContent }
      : s.operationVariables;
    const variablesContent = (name && saved[name]) ?? '{}';
    return { currentOperationName: name, operationVariables: saved, variablesContent };
  }),
  setOperationVariables: (operationVariables) => set({ operationVariables }),
  renameCurrentOperation: (newName) => set((s) => {
    const oldName = s.currentOperationName;
    if (!oldName) return { currentOperationName: newName };
    const operationVariables = { ...s.operationVariables, [newName]: s.variablesContent };
    delete operationVariables[oldName];
    return { currentOperationName: newName, operationVariables };
  }),
  setResponse: (response) => set({ response }),
  setIsExecuting: (isExecuting) => set({ isExecuting }),
  requestExecute: () => set((s) => ({ executeRequested: s.executeRequested + 1 })),
  requestFormat: () => set((s) => ({ formatRequested: s.formatRequested + 1 })),
  setEditorFont: (editorFont) => set({ editorFont }),
  setEditorFontSize: (editorFontSize) => set({ editorFontSize }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setSchemaStatus: (schemaStatus, error) => set({ schemaStatus, schemaError: error ?? null }),
  setDocOpen: (docOpen) => set({ docOpen }),
}));
