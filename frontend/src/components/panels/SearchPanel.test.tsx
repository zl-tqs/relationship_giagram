import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCanvasStore } from '../../stores/canvasStore';
import { SearchPanel } from './SearchPanel';

const renderPanel = (props: Partial<React.ComponentProps<typeof SearchPanel>> = {}) =>
  render(
    <SearchPanel
      open
      query="张"
      onQueryChange={vi.fn()}
      onClose={vi.fn()}
      onSelect={vi.fn()}
      {...props}
    />,
  );

describe('SearchPanel', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [
        { id: 'n1', position: { x: 0, y: 0 }, data: { shape: 'circle', name: '张三', gender: '未知' } },
        { id: 'n2', position: { x: 0, y: 0 }, data: { shape: 'circle', name: '李四', gender: '未知' } },
      ],
    });
  });

  it('只展示命中角色', () => {
    renderPanel();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.queryByText('李四')).not.toBeInTheDocument();
  });

  it('点击结果触发定位回调', async () => {
    const onSelect = vi.fn();
    renderPanel({ onSelect });
    await userEvent.click(screen.getByText('张三'));
    expect(onSelect).toHaveBeenCalledWith('n1');
  });

  it('关闭状态不渲染', () => {
    const { container } = renderPanel({ open: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('按 Escape 关闭面板', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    await userEvent.type(screen.getByPlaceholderText('搜索角色名'), '{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
