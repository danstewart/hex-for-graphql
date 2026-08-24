import type { Monaco } from '@monaco-editor/react';
import type { ThemeId } from './themes';

interface MonacoThemeConfig {
  name: string;
  base: 'vs' | 'vs-dark';
  background: string;
  foreground: string;
  surface: string;
  border: string;
  muted: string;
  subtle: string;
  accent: string;
  accentHover: string;
  keyword: string;
  type: string;
  variable: string;
  string: string;
  number: string;
  jsonKeyword: string;
  scrollbar: 'light' | 'dark';
}

const THEME_CONFIGS: Record<ThemeId, MonacoThemeConfig> = {
  noir: {
    name: 'hex-noir',
    base: 'vs-dark',
    background: '#06060f',
    foreground: '#e2e8f0',
    surface: '#13132b',
    border: '#1e1e3a',
    muted: '#5d7086',
    subtle: '#94a3b8',
    accent: '#7c3aed',
    accentHover: '#a78bfa',
    keyword: '#a78bfa',
    type: '#e879f9',
    variable: '#fde047',
    string: '#6ee7b7',
    number: '#fb923c',
    jsonKeyword: '#f472b6',
    scrollbar: 'light',
  },
  graphite: {
    name: 'hex-graphite',
    base: 'vs-dark',
    background: '#0c0c0d',
    foreground: '#e4e4e7',
    surface: '#1e1e20',
    border: '#2a2a2e',
    muted: '#71717a',
    subtle: '#a1a1aa',
    accent: '#3b82f6',
    accentHover: '#60a5fa',
    keyword: '#60a5fa',
    type: '#c084fc',
    variable: '#facc15',
    string: '#4ade80',
    number: '#fb923c',
    jsonKeyword: '#f472b6',
    scrollbar: 'light',
  },
  mocha: {
    name: 'hex-mocha',
    base: 'vs-dark',
    background: '#0e0c0a',
    foreground: '#e6d5c3',
    surface: '#252019',
    border: '#332b23',
    muted: '#6f5f51',
    subtle: '#ad9884',
    accent: '#d08770',
    accentHover: '#e0a088',
    keyword: '#b48ead',
    type: '#81a1c1',
    variable: '#ebcb8b',
    string: '#a3be8c',
    number: '#d08770',
    jsonKeyword: '#d8a1b9',
    scrollbar: 'light',
  },
  light: {
    name: 'hex-light',
    base: 'vs',
    background: '#faf9f7',
    foreground: '#1c1917',
    surface: '#ece8e3',
    border: '#d5cfc8',
    muted: '#948e88',
    subtle: '#78716c',
    accent: '#6d28d9',
    accentHover: '#7c3aed',
    keyword: '#6d28d9',
    type: '#a21caf',
    variable: '#92400e',
    string: '#115e59',
    number: '#9a3412',
    jsonKeyword: '#9d174d',
    scrollbar: 'dark',
  },
  dracula: {
    name: 'hex-dracula',
    base: 'vs-dark',
    background: '#191a21',
    foreground: '#f8f8f2',
    surface: '#282a36',
    border: '#44475a',
    muted: '#6272a4',
    subtle: '#b8b8b2',
    accent: '#ff79c6',
    accentHover: '#ff92df',
    keyword: '#ff79c6',
    type: '#bd93f9',
    variable: '#f1fa8c',
    string: '#50fa7b',
    number: '#ffb86c',
    jsonKeyword: '#8be9fd',
    scrollbar: 'light',
  },
  nord: {
    name: 'hex-nord',
    base: 'vs-dark',
    background: '#242933',
    foreground: '#d8dee9',
    surface: '#3b4252',
    border: '#434c5e',
    muted: '#748196',
    subtle: '#b6c1d4',
    accent: '#88c0d0',
    accentHover: '#8fbcbb',
    keyword: '#81a1c1',
    type: '#b48ead',
    variable: '#ebcb8b',
    string: '#a3be8c',
    number: '#d08770',
    jsonKeyword: '#8fbcbb',
    scrollbar: 'light',
  },
  'solarized-dark': {
    name: 'hex-solarized-dark',
    base: 'vs-dark',
    background: '#00212b',
    foreground: '#eee8d5',
    surface: '#073642',
    border: '#164b56',
    muted: '#657b83',
    subtle: '#93a1a1',
    accent: '#268bd2',
    accentHover: '#4aa3df',
    keyword: '#b589d6',
    type: '#2aa8e8',
    variable: '#d3a400',
    string: '#9fb000',
    number: '#e87929',
    jsonKeyword: '#d65d9e',
    scrollbar: 'light',
  },
  'tokyo-night': {
    name: 'hex-tokyo-night',
    base: 'vs-dark',
    background: '#16161e',
    foreground: '#c0caf5',
    surface: '#24283b',
    border: '#343b58',
    muted: '#565f89',
    subtle: '#787c99',
    accent: '#7aa2f7',
    accentHover: '#8db0ff',
    keyword: '#bb9af7',
    type: '#7dcfff',
    variable: '#e0af68',
    string: '#9ece6a',
    number: '#ff9e64',
    jsonKeyword: '#ff7ab2',
    scrollbar: 'light',
  },
};

export const MONACO_THEME_MAP: Record<ThemeId, string> = Object.fromEntries(
  Object.entries(THEME_CONFIGS).map(([id, theme]) => [id, theme.name]),
) as Record<ThemeId, string>;

function alpha(color: string, opacity: string): string {
  return `${color}${opacity}`;
}

function syntaxRules(theme: MonacoThemeConfig) {
  const shared = [
    { token: 'keyword.gql', foreground: theme.keyword.slice(1) },
    { token: 'type.gql', foreground: theme.type.slice(1) },
    { token: 'variable.gql', foreground: theme.variable.slice(1) },
    { token: 'string.gql', foreground: theme.string.slice(1) },
    { token: 'number.gql', foreground: theme.number.slice(1) },
    { token: 'comment.gql', foreground: theme.muted.slice(1), fontStyle: 'italic' },
    { token: 'operator.gql', foreground: theme.subtle.slice(1) },
    { token: 'delimiter.gql', foreground: theme.subtle.slice(1) },
    { token: 'string.key.json', foreground: theme.keyword.slice(1) },
    { token: 'string.value.json', foreground: theme.string.slice(1) },
    { token: 'number.json', foreground: theme.number.slice(1) },
    { token: 'keyword.json', foreground: theme.jsonKeyword.slice(1) },
    { token: 'delimiter.array.json', foreground: theme.subtle.slice(1) },
    { token: 'delimiter.bracket.json', foreground: theme.subtle.slice(1) },
    { token: 'delimiter.colon.json', foreground: theme.subtle.slice(1) },
    { token: 'delimiter.comma.json', foreground: theme.subtle.slice(1) },
  ];

  return [
    ...shared,
    { token: 'keyword', foreground: theme.keyword.slice(1) },
    { token: 'string', foreground: theme.string.slice(1) },
    { token: 'number', foreground: theme.number.slice(1) },
    { token: 'comment', foreground: theme.muted.slice(1), fontStyle: 'italic' },
    { token: 'variable', foreground: theme.variable.slice(1) },
    { token: 'type', foreground: theme.type.slice(1) },
    { token: 'operator', foreground: theme.subtle.slice(1) },
    { token: 'delimiter', foreground: theme.subtle.slice(1) },
  ];
}

export function registerAllThemes(monaco: Monaco) {
  Object.values(THEME_CONFIGS).forEach((theme) => {
    const scrollbarBase = theme.scrollbar === 'dark' ? '#000000' : '#ffffff';

    monaco.editor.defineTheme(theme.name, {
      base: theme.base,
      inherit: true,
      rules: syntaxRules(theme),
      colors: {
        'editor.background': theme.background,
        'editor.foreground': theme.foreground,
        'editor.lineHighlightBackground': theme.surface,
        'editor.selectionBackground': alpha(theme.accent, '66'),
        'editor.inactiveSelectionBackground': alpha(theme.accent, '33'),
        'editor.selectionHighlightBackground': alpha(theme.accent, '3d'),
        'editor.wordHighlightBackground': alpha(theme.accent, '2e'),
        'editor.findMatchBackground': alpha(theme.accent, '59'),
        'editor.findMatchHighlightBackground': alpha(theme.accent, '30'),
        'editorLineNumber.foreground': theme.muted,
        'editorLineNumber.activeForeground': theme.subtle,
        'editorCursor.foreground': theme.accentHover,
        'editorIndentGuide.background1': theme.border,
        'editorIndentGuide.activeBackground1': theme.muted,
        'editorBracketMatch.background': alpha(theme.accent, '3d'),
        'editorBracketMatch.border': theme.accent,
        'editorSuggestWidget.background': theme.background,
        'editorSuggestWidget.border': theme.border,
        'editorSuggestWidget.foreground': theme.foreground,
        'editorSuggestWidget.selectedBackground': theme.surface,
        'editorSuggestWidget.selectedForeground': theme.foreground,
        'editorSuggestWidget.highlightForeground': theme.accent,
        'editorSuggestWidget.focusHighlightForeground': theme.accentHover,
        'editorHoverWidget.background': theme.background,
        'editorHoverWidget.border': theme.border,
        'editorHoverWidget.foreground': theme.foreground,
        'scrollbarSlider.background': alpha(scrollbarBase, '18'),
        'scrollbarSlider.hoverBackground': alpha(scrollbarBase, '28'),
        'scrollbarSlider.activeBackground': alpha(scrollbarBase, '38'),
        'editorGutter.background': theme.background,
        'editorOverviewRuler.border': theme.border,
        'editorOverviewRuler.findMatchForeground': theme.accent,
      },
    });
  });
}
