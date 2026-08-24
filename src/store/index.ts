import { create } from 'zustand';
import type { DocTarget } from '../lib/graphql';
import type { FontSizePreset } from '../lib/uiScale';

export interface Operation {
  id: number;
  name: string;
  type: 'query' | 'mutation' | 'subscription';
  body: string;
  last_run_at: string | null;
}

export type CommandPaletteMode = 'navigate' | 'commands';

interface AppState {
  // Connection settings
  endpoint: string;
  headers: [string, string][];
  cookies: [string, string][];

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
  formatAllRequested: number;
  foldOperationsRequested: number;
  unfoldAllRequested: number;

  // Editor appearance
  editorFont: string;
  fontSize: FontSizePreset;
  theme: string;

  // Schema
  schemaStatus: 'none' | 'loading' | 'loaded' | 'error';
  schemaError: string | null;

  // Toasts
  toasts: { id: number; message: string }[];
  addToast: (message: string) => void;
  dismissToast: (id: number) => void;

  // Modals
  settingsOpen: boolean;
  commandPaletteOpen: boolean;
  commandPaletteMode: CommandPaletteMode;
  errorModal: { title: string; detail: string; responseBody?: string } | null;

  // Doc viewer
  docOpen: boolean;
  // Pending navigation request from the editor (ctrl/cmd+click) for DocViewer to consume.
  docTarget: DocTarget | null;

  // Sidebar
  sidebarCollapsed: boolean;

  // Setters
  setEndpoint: (v: string) => void;
  setHeaders: (v: [string, string][]) => void;
  setCookies: (v: [string, string][]) => void;
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
  requestFormatAll: () => void;
  requestFoldOperations: () => void;
  requestUnfoldAll: () => void;
  setEditorFont: (v: string) => void;
  setFontSize: (v: FontSizePreset) => void;
  setTheme: (v: string) => void;
  setSettingsOpen: (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  openCommandPalette: (mode: CommandPaletteMode) => void;
  setErrorModal: (v: { title: string; detail: string; responseBody?: string } | null) => void;
  setSchemaStatus: (status: 'none' | 'loading' | 'loaded' | 'error', error?: string) => void;
  setDocOpen: (v: boolean) => void;
  setDocTarget: (v: DocTarget | null) => void;
  setSidebarCollapsed: (v: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  endpoint: '',
  headers: [],
  cookies: [],
  operations: [],
  editorContent: '',
  variablesContent: '{}',
  operationVariables: {},
  currentOperationName: null,
  response: null,
  isExecuting: false,
  executeRequested: 0,
  formatRequested: 0,
  formatAllRequested: 0,
  foldOperationsRequested: 0,
  unfoldAllRequested: 0,
  editorFont: 'Geist Mono, monospace',
  fontSize: 'medium',
  theme: 'noir',
  schemaStatus: 'none',
  schemaError: null,
  toasts: [],
  addToast: (message) => set((s) => ({
    toasts: [...s.toasts, { id: Date.now(), message }],
  })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  settingsOpen: false,
  commandPaletteOpen: false,
  commandPaletteMode: 'navigate',
  errorModal: null,
  docOpen: false,
  docTarget: null,
  sidebarCollapsed: false,

  setEndpoint: (endpoint) => set({ endpoint }),
  setHeaders: (headers) => set({ headers }),
  setCookies: (cookies) => set({ cookies }),
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
  requestFormatAll: () => set((s) => ({ formatAllRequested: s.formatAllRequested + 1 })),
  requestFoldOperations: () => set((s) => ({ foldOperationsRequested: s.foldOperationsRequested + 1 })),
  requestUnfoldAll: () => set((s) => ({ unfoldAllRequested: s.unfoldAllRequested + 1 })),
  setEditorFont: (editorFont) => set({ editorFont }),
  setFontSize: (fontSize) => set({ fontSize }),
  setTheme: (theme) => set({ theme }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  openCommandPalette: (commandPaletteMode) => set({ commandPaletteOpen: true, commandPaletteMode }),
  setErrorModal: (errorModal) => set({ errorModal }),
  setSchemaStatus: (schemaStatus, error) => set({ schemaStatus, schemaError: error ?? null }),
  setDocOpen: (docOpen) => set({ docOpen }),
  setDocTarget: (docTarget) => set({ docTarget }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}));
