import { Button } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

interface Props {
  hintAt: Date | null;
  error: 'retrying' | 'persistent' | null;
  conflict: boolean;
  writer: boolean | null;
  busy?: boolean;
  onRetry: () => void;
  onReload: () => void;
  onBackup: () => void;
  onOverwrite: () => void;
  onTakeOver: () => void;
}

const base: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 8,
  fontSize: 13,
  color: '#fff',
  boxShadow: '0 2px 10px rgba(0, 0, 0, .18)',
};

function bar(background: string): CSSProperties {
  return { ...base, background };
}

function timeLabel(date: Date) {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function SaveStatusBar({
  hintAt,
  error,
  conflict,
  writer,
  busy = false,
  onRetry,
  onReload,
  onBackup,
  onOverwrite,
  onTakeOver,
}: Props) {
  const items: ReactNode[] = [];

  if (conflict) {
    items.push(
      <div key="conflict" style={bar('rgba(207, 19, 34, .92)')}>
        <span>画布已在其他端修改，自动保存已暂停</span>
        <Button size="small" onClick={onReload} loading={busy}>重新加载</Button>
        <Button size="small" onClick={onBackup} disabled={busy}>下载本地备份</Button>
        <Button size="small" danger onClick={onOverwrite} loading={busy}>覆盖云端</Button>
      </div>,
    );
  } else if (writer === false) {
    items.push(
      <div key="writer" style={bar('rgba(250, 140, 22, .94)')}>
        <span>该项目已在另一个标签页编辑</span>
        <Button size="small" onClick={onTakeOver} loading={busy}>接管编辑</Button>
      </div>,
    );
  } else if (error === 'persistent') {
    items.push(
      <div key="error" style={bar('rgba(207, 19, 34, .92)')}>
        <span>自动保存失败，请检查网络</span>
        <Button size="small" onClick={onRetry} loading={busy}>重试</Button>
      </div>,
    );
  } else if (error === 'retrying') {
    items.push(
      <div key="retry" style={bar('rgba(250, 140, 22, .94)')}>
        <span>自动保存失败，将重试</span>
      </div>,
    );
  }

  if (hintAt && !conflict && !error) {
    items.push(
      <div key="hint" style={{ ...bar('rgba(16, 122, 87, .78)'), opacity: 0.86 }}>
        已自动保存 {timeLabel(hintAt)}
      </div>,
    );
  }

  if (items.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        {items}
      </div>
    </div>
  );
}
