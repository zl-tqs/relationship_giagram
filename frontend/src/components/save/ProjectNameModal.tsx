import { Button, Input, Modal, Typography } from 'antd';
import type { InputRef } from 'antd';
import { useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  mode: 'save' | 'exit';
  initialName: string;
  originalName?: string | null;
  busy?: boolean;
  onSubmit: (name: string) => void;
  onLater: () => void;
  onDiscard?: () => void;
  onCancel: () => void;
}

export function ProjectNameModal({
  open,
  mode,
  initialName,
  originalName,
  busy = false,
  onSubmit,
  onLater,
  onDiscard,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setError('');
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [open, initialName]);

  const submit = () => {
    const value = name.trim();
    if (!value) {
      setError('项目名称不能为空');
      return;
    }
    if (value.length > 100) {
      setError('项目名称不能超过 100 个字符');
      return;
    }
    setError('');
    onSubmit(value);
  };

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button onClick={onCancel} disabled={busy}>取消</Button>
      {mode === 'exit' && onDiscard && (
        <Button danger onClick={onDiscard} disabled={busy}>不保存</Button>
      )}
      <Button onClick={onLater} disabled={busy}>稍后保存</Button>
      <Button type="primary" onClick={submit} loading={busy}>
        {mode === 'exit' ? '保存并退出' : '保存'}
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      title={mode === 'exit' ? '保存并退出' : '保存项目'}
      footer={footer}
      onCancel={onCancel}
      maskClosable={false}
      closable={!busy}
      keyboard={!busy}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        {mode === 'exit'
          ? '项目尚未命名保存。退出前请确认项目名称，画布内容将保存到云端。'
          : '项目尚未命名保存。确认名称后，画布内容将保存到云端。'}
      </Typography.Paragraph>
      <Input
        ref={inputRef}
        maxLength={100}
        value={name}
        status={error ? 'error' : undefined}
        disabled={busy}
        onChange={(event) => {
          setName(event.target.value);
          if (error) setError('');
        }}
        onPressEnter={submit}
      />
      {originalName && (
        <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 6, opacity: 0.65 }}>
          原文件名：{originalName}
        </Typography.Text>
      )}
      {error && (
        <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>{error}</div>
      )}
    </Modal>
  );
}
