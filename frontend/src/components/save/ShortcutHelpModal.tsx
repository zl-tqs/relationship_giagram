import { Modal, Typography } from 'antd';

const GROUPS = [
  {
    title: '文件',
    items: [
      ['Ctrl/Cmd + S', '保存'],
      ['Ctrl/Cmd + Shift + S', '创建快照'],
      ['Ctrl/Cmd + Alt + S', '另存为'],
    ],
  },
  {
    title: '编辑',
    items: [
      ['Ctrl/Cmd + Z', '撤销'],
      ['Ctrl/Cmd + Shift + Z', '重做'],
      ['Delete / Backspace', '删除选中对象'],
      ['Ctrl/Cmd + A', '全选'],
      ['Esc', '取消选择 / 关闭面板'],
    ],
  },
  {
    title: '画布',
    items: [
      ['Ctrl/Cmd + F', '搜索角色'],
      ['Ctrl/Cmd + =', '放大画布'],
      ['Ctrl/Cmd + -', '缩小画布'],
      ['Ctrl/Cmd + Shift + -', '缩小画布（备用）'],
      ['R', '反向关系箭头'],
      ['Ctrl/Cmd + Alt + Enter', '新建圆形角色'],
      ['Ctrl/Cmd + / 或 ?', '打开快捷键帮助'],
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ShortcutHelpModal({ open, onClose }: Props) {
  return (
    <Modal open={open} title="快捷键" footer={null} onCancel={onClose} width={620}>
      <div style={{ display: 'grid', gap: 20 }}>
        {GROUPS.map((group) => (
          <section key={group.title}>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
              {group.title}
            </Typography.Title>
            {group.items.map(([keys, description]) => (
              <div
                key={keys}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '5px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <Typography.Text type="secondary">{description}</Typography.Text>
                <Typography.Text code>{keys}</Typography.Text>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Modal>
  );
}
