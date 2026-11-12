import { AutoComplete, Form, Input, Modal, Radio } from 'antd';
import { useEffect } from 'react';
import type { CharacterData } from '../../types';

export const GENDER_OPTIONS = ['男', '女', '未知'].map((value) => ({ value, label: value }));
const DEFAULT_CHARACTER: CharacterData = {
  shape: 'circle',
  name: '',
  gender: '未知',
  intro: '',
};

interface Props {
  open: boolean;
  initial?: CharacterData;
  onClose: () => void;
  onSubmit: (data: CharacterData) => void;
}

export function CharacterModal({ open, initial, onClose, onSubmit }: Props) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      ...DEFAULT_CHARACTER,
      ...initial,
      gender: initial?.gender?.trim() ? initial.gender : DEFAULT_CHARACTER.gender,
    });
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
        <Form.Item name="shape" label="形状" rules={[{ required: true, message: '请选择形状' }]}>
          <Radio.Group>
            <Radio.Button value="circle">圆形</Radio.Button>
            <Radio.Button value="square">方形</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="name" label="姓名" rules={[{ required: true, message: '姓名必填' }]}>
          <Input maxLength={50} />
        </Form.Item>
        <Form.Item
          name="gender"
          label="性别"
          rules={[
            { required: true, message: '性别必填' },
            { max: 20, message: '性别不能超过 20 个字符' },
          ]}
        >
          <AutoComplete
            options={GENDER_OPTIONS}
            filterOption={() => true}
            defaultActiveFirstOption={false}
            placeholder="选择或输入性别"
          >
            <Input />
          </AutoComplete>
        </Form.Item>
        <Form.Item name="intro" label="简介">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
