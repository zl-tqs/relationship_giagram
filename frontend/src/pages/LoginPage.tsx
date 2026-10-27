import { Button, Card, Form, Input, Tabs, message } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { toApiError } from '../api/client';

export function LoginPage() {
  const { login, register, anonymous } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onLogin = async (v: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(v.email, v.password);
      navigate('/');
    } catch (e) {
      message.error(toApiError(e).message);
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (v: { email: string; password: string; nickname: string }) => {
    setLoading(true);
    try {
      await register(v.email, v.password, v.nickname);
      navigate('/');
    } catch (e) {
      message.error(toApiError(e).message);
    } finally {
      setLoading(false);
    }
  };

  const onAnonymous = async () => {
    setLoading(true);
    try {
      await anonymous();
      navigate('/');
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <Card title="小说人物关系图工具" style={{ width: 360 }}>
        <Tabs
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
                <Form onFinish={onLogin} layout="vertical">
                  <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="password" label="密码" rules={[{ required: true, min: 8 }]}>
                    <Input.Password />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block loading={loading}>登录</Button>
                </Form>
              ),
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <Form onFinish={onRegister} layout="vertical">
                  <Form.Item name="nickname" label="昵称" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="password" label="密码" rules={[{ required: true, min: 8 }]}>
                    <Input.Password />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block loading={loading}>注册并登录</Button>
                </Form>
              ),
            },
          ]}
        />
        <Button block type="link" onClick={onAnonymous} loading={loading}>以访客身份继续（数据保存到云端）</Button>
      </Card>
    </div>
  );
}
