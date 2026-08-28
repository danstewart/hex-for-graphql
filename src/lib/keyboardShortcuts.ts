import type * as Monaco from 'monaco-editor';
import type { CommandPaletteMode } from '../store';

export function getCommandPaletteMode(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'key'>): CommandPaletteMode | null {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'p') return null;
  return event.shiftKey ? 'commands' : 'navigate';
}

export function registerCommandPaletteShortcuts(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  openCommandPalette: (mode: CommandPaletteMode) => void,
) {
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
    openCommandPalette('navigate');
  });
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => {
    openCommandPalette('commands');
  });
}
