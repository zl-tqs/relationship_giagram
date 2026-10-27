import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CharacterModal } from './CharacterModal';

describe('CharacterModal', () => {
  it('渲染姓名与性别必填字段', () => {
    render(<CharacterModal open onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('姓名')).toBeInTheDocument();
    expect(screen.getByText('性别')).toBeInTheDocument();
    expect(screen.getByText('形状')).toBeInTheDocument();
  });
});
