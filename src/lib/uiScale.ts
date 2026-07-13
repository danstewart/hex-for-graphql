export type FontSizePreset = 'small' | 'medium' | 'large';

export const FONT_SIZE_PRESETS: Record<FontSizePreset, { label: string; editor: number; uiZoom: number }> = {
  small: { label: 'Small', editor: 12, uiZoom: 0.875 },
  medium: { label: 'Medium', editor: 14, uiZoom: 1 },
  large: { label: 'Large', editor: 17, uiZoom: 1.15 },
};

export function isFontSizePreset(v: string): v is FontSizePreset {
  return v === 'small' || v === 'medium' || v === 'large';
}

/** Maps a legacy numeric editor font size (px) to the closest preset, for migrating old settings. */
export function fontSizeFromLegacyPx(px: number): FontSizePreset {
  if (px <= 12) return 'small';
  if (px <= 15) return 'medium';
  return 'large';
}
