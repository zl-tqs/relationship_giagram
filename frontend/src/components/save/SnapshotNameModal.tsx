import { Input, Modal, Typography } from 'antd';
import type { InputRef } from 'antd';
import { useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  initialName: string;
  busy?: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export function SnapshotNameModal({ open, initialName, busy = false, onSubmit, onCancel }: Props) {
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
      setError('快照名称不能为空');
      return;
    }
    if (value.length > 100) {
      setError('快照名称不能超过 100 个字符');
      return;
    }
    setError('');
    onSubmit(value);
  };

  return (
    <Modal
      open={open}
      title="创建版本快照"
      okText="创建"
      cancelText="取消"
      confirmLoading={busy}
      onOk={submit}
      onCancel={onCancel}
      maskClosable={false}
      closable={!busy}
      keyboard={!busy}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        创建快照会先保存当前画布，再生成一个不会自动删除的版本。
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
      {error && (
        <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>{error}</div>
      )}
    </Modal>
  );
}
