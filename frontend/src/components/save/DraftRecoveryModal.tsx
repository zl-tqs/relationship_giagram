import { Button, Modal, Typography } from 'antd';

interface Props {
  open: boolean;
  stale: boolean;
  updatedAt: string;
  onApply: () => void;
  onOverwrite: () => void;
  onExport: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export function DraftRecoveryModal({
  open,
  stale,
  updatedAt,
  onApply,
  onOverwrite,
  onExport,
  onDiscard,
  onClose,
}: Props) {
  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      {stale ? (
        <>
          <Button danger onClick={onDiscard}>放弃</Button>
          <Button onClick={onExport}>导出草稿</Button>
          <Button type="primary" onClick={onOverwrite}>覆盖保存</Button>
        </>
      ) : (
        <>
          <Button danger onClick={onDiscard}>丢弃</Button>
          <Button type="primary" onClick={onApply}>恢复</Button>
        </>
      )}
    </div>
  );

  return (
    <Modal
      open={open}
      title={stale ? '草稿基于旧版本' : '检测到未保存修改'}
      footer={footer}
      onCancel={onClose}
      maskClosable={false}
    >
      <Typography.Paragraph>
        本地草稿更新于 {new Date(updatedAt).toLocaleString()}。
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">
        {stale
          ? '服务端画布已在其他时间更新，草稿不能直接恢复。可以导出草稿留存，或用草稿覆盖云端内容。'
          : '可以恢复草稿继续编辑，或丢弃草稿使用服务端版本。'}
      </Typography.Paragraph>
    </Modal>
  );
}
