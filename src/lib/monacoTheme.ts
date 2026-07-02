import type { Monaco } from '@monaco-editor/react';

export const THEME_NAME = 'hex-dark';

export function registerTheme(monaco: Monaco) {
  monaco.editor.defineTheme(THEME_NAME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      // GraphQL
      { token: 'keyword.gql',   foreground: 'a78bfa' }, // violet-400 — query, mutation, fragment…
      { token: 'type.gql',      foreground: 'e879f9' }, // fuchsia-400 — type names
      { token: 'variable.gql',  foreground: 'fde047' }, // yellow-300 — $variables
      { token: 'string.gql',    foreground: '6ee7b7' }, // emerald-300
      { token: 'number.gql',    foreground: 'fb923c' }, // orange-400
      { token: 'comment.gql',   foreground: '4a4a72', fontStyle: 'italic' },
      { token: 'operator.gql',  foreground: '94a3b8' }, // slate-400
      { token: 'delimiter.gql', foreground: '94a3b8' },

      // JSON (variables / response panes)
      { token: 'string.key.json',   foreground: 'a78bfa' }, // violet — keys
      { token: 'string.value.json', foreground: '6ee7b7' }, // emerald — string values
      { token: 'number.json',       foreground: 'fb923c' }, // orange
      { token: 'keyword.json',      foreground: 'f472b6' }, // pink-400 — true/false/null
      { token: 'delimiter.array.json',  foreground: '94a3b8' },
      { token: 'delimiter.bracket.json', foreground: '94a3b8' },
      { token: 'delimiter.colon.json',   foreground: '94a3b8' },
      { token: 'delimiter.comma.json',   foreground: '94a3b8' },

      // Generic fallbacks
      { token: 'keyword',   foreground: 'a78bfa' },
      { token: 'string',    foreground: '6ee7b7' },
      { token: 'number',    foreground: 'fb923c' },
      { token: 'comment',   foreground: '4a4a72', fontStyle: 'italic' },
      { token: 'variable',  foreground: 'fde047' },
      { token: 'type',      foreground: 'e879f9' },
      { token: 'operator',  foreground: '94a3b8' },
      { token: 'delimiter', foreground: '94a3b8' },
    ],
    colors: {
      // Editor canvas
      'editor.background':              '#0c0c1d',
      'editor.foreground':              '#e2e8f0',
      'editor.lineHighlightBackground': '#13132a',
      'editor.selectionBackground':     '#3d2d7a80',
      'editor.inactiveSelectionBackground': '#3d2d7a40',
      'editor.selectionHighlightBackground': '#3d2d7a50',
      'editor.wordHighlightBackground': '#2d1f5e80',
      'editor.findMatchBackground':     '#7c3aed50',
      'editor.findMatchHighlightBackground': '#7c3aed30',

      // Line numbers
      'editorLineNumber.foreground':       '#2e2e5a',
      'editorLineNumber.activeForeground': '#7c7cbc',

      // Cursor
      'editorCursor.foreground': '#a78bfa',

      // Indent guides
      'editorIndentGuide.background1':       '#1c1c38',
      'editorIndentGuide.activeBackground1': '#3d3d6b',

      // Bracket matching
      'editorBracketMatch.background': '#3d2d7a50',
      'editorBracketMatch.border':     '#7c3aed',

      // Suggest / autocomplete widget
      'editorSuggestWidget.background':          '#0c0c1d',
      'editorSuggestWidget.border':              '#1c1c38',
      'editorSuggestWidget.foreground':          '#e2e8f0',
      'editorSuggestWidget.selectedBackground':  '#1c1c38',
      'editorSuggestWidget.selectedForeground':  '#f0f0ff',
      'editorSuggestWidget.highlightForeground': '#a78bfa',
      'editorSuggestWidget.focusHighlightForeground': '#c084fc',

      // Hover widget
      'editorHoverWidget.background': '#0c0c1d',
      'editorHoverWidget.border':     '#1c1c38',
      'editorHoverWidget.foreground': '#e2e8f0',

      // Scrollbars
      'scrollbarSlider.background':       '#ffffff18',
      'scrollbarSlider.hoverBackground':  '#ffffff28',
      'scrollbarSlider.activeBackground': '#ffffff38',

      // Gutter / overview ruler
      'editorGutter.background':            '#0c0c1d',
      'editorOverviewRuler.border':         '#1c1c38',
      'editorOverviewRuler.findMatchForeground': '#7c3aed',
    },
  });
}
