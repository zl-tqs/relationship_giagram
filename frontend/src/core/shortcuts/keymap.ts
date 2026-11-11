export const KEYMAP = {
  save: 'mod+s',
  saveAs: 'mod+shift+s',
  undo: 'mod+z',
  redo: 'mod+shift+z',
  newCharacter: 'mod+alt+enter',
  delete: ['delete', 'backspace'],
  search: 'mod+f',
  zoomIn: 'mod+=',
  zoomOut: ['mod+shift+minus', 'mod+minus'],
  reverse: 'r',
  selectAll: 'mod+a',
  cancel: 'escape',
} as const;
