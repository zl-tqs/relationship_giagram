import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShortcutHelpModal } from './ShortcutHelpModal';

describe('ShortcutHelpModal', () => {
  it('按作用域展示快捷键', () => {
    render(<ShortcutHelpModal open onClose={vi.fn()} />);
    expect(screen.getByText('快捷键')).toBeInTheDocument();
    expect(screen.getByText('文件')).toBeInTheDocument();
    expect(screen.getByText('编辑')).toBeInTheDocument();
    expect(screen.getByText('画布')).toBeInTheDocument();
    expect(screen.getByText('Ctrl/Cmd + S')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
  });
});
