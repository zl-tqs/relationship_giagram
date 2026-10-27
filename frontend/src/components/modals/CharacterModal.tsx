import { Form, Input, Modal, Radio } from 'antd';
import { useEffect } from 'react';
import type { CharacterData } from '../../types';

interface Props {
  open: boolean;
  initial?: CharacterData;
  onClose: () => void;
  onSubmit: (data: CharacterData) => void;
}

export function CharacterModal({ open, initial, onClose, onSubmit }: Props) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) form.setFieldsValue(initial ?? { shape: 'circle', name: '', gender: '', intro: '' });
  }, [open, initial, form]);

  return (
    <Modal
      open={open}
      title="角色详情"
      onCancel={onClose}
      onOk={() =>
        form.validateFields().then((v) => {
          onSubmit(v as CharacterData);
          form.resetFields();
          onClose();
        })
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item name="shape" label="形状" rules={[{ required: true }]}>
          <Radio.Group>
            <Radio.Button value="circle">圆形</Radio.Button>
            <Radio.Button value="square">方形</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="name" label="姓名" rules={[{ required: true, message: '姓名必填' }]}>
          <Input maxLength={50} />
        </Form.Item>
        <Form.Item name="gender" label="性别" rules={[{ required: true, message: '性别必填' }]}>
          <Input maxLength={20} />
        </Form.Item>
        <Form.Item name="intro" label="简介">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
