import { Input, Modal, message } from 'antd';
import { useEffect, useState } from 'react';

interface Props {
  open: boolean;
  initialName: string;
  onCancel: () => void;
  onSubmit: (name: string) => Promise<void> | void;
}

export function ProjectRenameModal({ open, initialName, onCancel, onSubmit }: Props) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const handleOk = async () => {
    const value = name.trim();
    if (!value) {
      message.warning('项目名称不能为空');
      return;
    }
    await onSubmit(value);
  };

  return (
    <Modal
      open={open}
      title="重命名项目"
      okText="保存"
      cancelText="取消"
      onOk={handleOk}
      onCancel={onCancel}
    >
      <Input
        autoFocus
        maxLength={100}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onPressEnter={handleOk}
      />
    </Modal>
  );
}
