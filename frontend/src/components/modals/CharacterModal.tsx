import { AutoComplete, Button, Form, Input, Modal, Radio, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_GENDER,
  MAX_CUSTOM_GENDERS,
  MAX_GENDER_LENGTH,
  PRESET_GENDERS,
  addCustomGender,
  buildGenderOptions,
  loadCustomGenders,
  removeCustomGender,
} from '../../core/character/genders';
import { useAuthStore } from '../../stores/authStore';
import type { CharacterData } from '../../types';

const DEFAULT_CHARACTER: CharacterData = {
  shape: 'circle',
  name: '',
  gender: DEFAULT_GENDER,
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
  const userId = useAuthStore((state) => state.user?.id ?? 'anonymous');
  const [customGenders, setCustomGenders] = useState<string[]>([]);
  const genderValue = Form.useWatch('gender', form);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      ...DEFAULT_CHARACTER,
      ...initial,
      gender: initial?.gender?.trim() || DEFAULT_CHARACTER.gender,
    });
  }, [open, initial, form]);

  useEffect(() => {
    if (open) setCustomGenders(loadCustomGenders(userId));
  }, [open, userId]);

  const genderOptions = useMemo(() => buildGenderOptions(customGenders), [customGenders]);
  const currentGender = typeof genderValue === 'string' ? genderValue.trim() : '';
  const canSavePreset = currentGender !== ''
    && currentGender.length <= MAX_GENDER_LENGTH
    && !(PRESET_GENDERS as readonly string[]).includes(currentGender)
    && !customGenders.includes(currentGender);

  const handleSavePreset = () => {
    const result = addCustomGender(userId, currentGender);
    setCustomGenders(result.genders);
    if (result.status === 'saved') message.success('已保存为预设');
    else if (result.status === 'limit') {
      message.warning(`最多保存 ${MAX_CUSTOM_GENDERS} 个自定义性别，请先删除一个`);
    }
  };

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
            { max: MAX_GENDER_LENGTH, message: `性别不能超过 ${MAX_GENDER_LENGTH} 个字符` },
          ]}
          extra={(customGenders.length > 0 || canSavePreset) ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {customGenders.length > 0 && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  自定义预设：
                </Typography.Text>
              )}
              {customGenders.map((gender) => (
                <Tag
                  key={gender}
                  closable
                  onClose={(event) => {
                    event.preventDefault();
                    setCustomGenders(removeCustomGender(userId, gender));
                  }}
                >
                  {gender}
                </Tag>
              ))}
              {canSavePreset && (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, height: 'auto' }}
                  onClick={handleSavePreset}
                >
                  保存为预设
                </Button>
              )}
            </div>
          ) : undefined}
        >
          <AutoComplete
            options={genderOptions}
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
