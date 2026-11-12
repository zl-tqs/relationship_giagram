import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { useHotkeys } from 'react-hotkeys-hook';
import { KEYMAP } from './keymap';

function Probe({ onFire, hotkey }: { onFire: () => void; hotkey: string }) {
  useHotkeys(hotkey, onFire, { preventDefault: true });
  return null;
}

describe('快捷键组合', () => {
  it('Ctrl+Shift+S 触发创建快照', () => {
    const onFire = vi.fn();
    render(<Probe hotkey={KEYMAP.createSnapshot} onFire={onFire} />);

    fireEvent.keyDown(document, {
      key: 'S',
      code: 'KeyS',
      ctrlKey: true,
      shiftKey: true,
    });

    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Alt+S 触发另存为', () => {
    const onFire = vi.fn();
    render(<Probe hotkey={KEYMAP.saveAs} onFire={onFire} />);

    fireEvent.keyDown(document, {
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
      altKey: true,
    });

    expect(onFire).toHaveBeenCalledTimes(1);
  });
});
