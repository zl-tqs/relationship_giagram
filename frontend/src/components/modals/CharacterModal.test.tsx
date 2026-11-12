import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  MAX_CUSTOM_GENDERS,
  addCustomGender,
  buildGenderOptions,
  loadCustomGenders,
} from '../../core/character/genders';
import { CharacterModal } from './CharacterModal';

describe('CharacterModal', () => {
  beforeEach(() => localStorage.clear());

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

  it('性别下拉提供男、女、未知预设且未知在最后', () => {
    expect(buildGenderOptions([]).map((option) => option.value)).toEqual(['男', '女', '未知']);
  });

  it('可将当前自定义性别保存为预设', async () => {
    render(<CharacterModal open onClose={vi.fn()} onSubmit={vi.fn()} />);
    const gender = screen.getByRole('combobox');
    fireEvent.change(gender, { target: { value: '精灵' } });
    fireEvent.click(screen.getByRole('button', { name: '保存为预设' }));

    await waitFor(() => {
      expect(loadCustomGenders('anonymous')).toEqual(['精灵']);
    });
  });

  it(`达到 ${MAX_CUSTOM_GENDERS} 个后提示上限`, async () => {
    for (let index = 1; index <= MAX_CUSTOM_GENDERS; index += 1) {
      addCustomGender('anonymous', `自定义${index}`);
    }
    render(<CharacterModal open onClose={vi.fn()} onSubmit={vi.fn()} />);
    const gender = screen.getByRole('combobox');
    fireEvent.change(gender, { target: { value: '第八个' } });
    fireEvent.click(screen.getByRole('button', { name: '保存为预设' }));

    expect(
      await screen.findByText(new RegExp(`最多保存 ${MAX_CUSTOM_GENDERS} 个自定义性别`)),
    ).toBeInTheDocument();
    expect(loadCustomGenders('anonymous')).toHaveLength(MAX_CUSTOM_GENDERS);
  });

  it('可删除已保存的自定义预设', async () => {
    addCustomGender('anonymous', '精灵');
    render(<CharacterModal open onClose={vi.fn()} onSubmit={vi.fn()} />);

    const close = document.querySelector('.ant-tag-close-icon');
    expect(close).not.toBeNull();
    fireEvent.click(close as Element);

    await waitFor(() => {
      expect(loadCustomGenders('anonymous')).toEqual([]);
    });
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
