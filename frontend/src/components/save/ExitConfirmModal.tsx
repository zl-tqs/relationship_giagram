import { Button, Modal, Typography } from 'antd';

interface Props {
  open: boolean;
  busy?: boolean;
  onSaveAndExit: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function ExitConfirmModal({
  open,
  busy = false,
  onSaveAndExit,
  onDiscard,
  onCancel,
}: Props) {
  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button onClick={onCancel} disabled={busy}>取消</Button>
      <Button danger onClick={onDiscard} disabled={busy}>不保存</Button>
      <Button type="primary" onClick={onSaveAndExit} loading={busy}>保存并退出</Button>
    </div>
  );

  return (
    <Modal
      open={open}
      title="退出前保存"
      footer={footer}
      onCancel={onCancel}
      maskClosable={false}
      closable={!busy}
      keyboard={!busy}
    >
      <Typography.Text>当前画布有未保存的修改，是否保存后退出？</Typography.Text>
    </Modal>
  );
}
