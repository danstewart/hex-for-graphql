export const APP_THEMES = [
  {
    id: 'noir',
    label: 'Noir',
    family: 'Hex',
    swatches: ['#06060f', '#13132b', '#7c3aed'],
  },
  {
    id: 'graphite',
    label: 'Graphite',
    family: 'Hex',
    swatches: ['#0c0c0d', '#1e1e20', '#3b82f6'],
  },
  {
    id: 'mocha',
    label: 'Mocha',
    family: 'Hex',
    swatches: ['#0e0c0a', '#252019', '#d08770'],
  },
  {
    id: 'light',
    label: 'Dawn',
    family: 'Hex',
    swatches: ['#faf9f7', '#ece8e3', '#6d28d9'],
  },
  {
    id: 'dracula',
    label: 'Dracula',
    family: 'IDE inspired',
    swatches: ['#191a21', '#282a36', '#ff79c6'],
  },
  {
    id: 'nord',
    label: 'Nord',
    family: 'IDE inspired',
    swatches: ['#242933', '#2e3440', '#88c0d0'],
  },
  {
    id: 'solarized-dark',
    label: 'Solarized',
    family: 'IDE inspired',
    swatches: ['#00212b', '#073642', '#268bd2'],
  },
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    family: 'IDE inspired',
    swatches: ['#16161e', '#1a1b26', '#7aa2f7'],
  },
] as const;

export type ThemeId = (typeof APP_THEMES)[number]['id'];

const THEME_IDS = new Set<string>(APP_THEMES.map((theme) => theme.id));

export function normalizeThemeId(theme: string): ThemeId {
  return THEME_IDS.has(theme) ? theme as ThemeId : 'noir';
}
