import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CharacterModal, GENDER_OPTIONS } from './CharacterModal';

describe('CharacterModal', () => {
  it('渲染姓名与性别必填字段', () => {
    render(<CharacterModal open onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('姓名')).toBeInTheDocument();
    expect(screen.getByText('性别')).toBeInTheDocument();
    expect(screen.getByText('形状')).toBeInTheDocument();
  });

  it('新增角色默认性别为未知', () => {
    render(<CharacterModal open onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('未知');
  });

  it('性别下拉提供男、女、未知预设', () => {
    expect(GENDER_OPTIONS.map((option) => option.value)).toEqual(['男', '女', '未知']);
  });

  it('编辑时保留已有自定义性别', () => {
    render(
      <CharacterModal
        open
        initial={{ shape: 'circle', name: '甲', gender: '精灵' }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('精灵');
  });

  it('允许输入自定义性别并提交', async () => {
    const onSubmit = vi.fn();
    render(
      <CharacterModal
        open
        initial={{ shape: 'circle', name: '甲', gender: '男' }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    const gender = screen.getByRole('combobox');
    fireEvent.change(gender, { target: { value: '精灵' } });
    fireEvent.click(screen.getByRole('button', { name: /OK|确\s*定/ }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ gender: '精灵' }));
    });
  });
});
