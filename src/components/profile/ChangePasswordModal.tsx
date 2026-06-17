'use client';

import React, { useState } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';

interface ChangePasswordModalProps {
    open: boolean;
    onClose: () => void;
}

export default function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleSave = async (values: any) => {
        if (values.newPassword !== values.confirmPassword) {
            return message.error('Mật khẩu mới và Nhập lại mật khẩu không khớp!');
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: values.currentPassword,
                    newPassword: values.newPassword
                })
            });

            if (res.ok) {
                message.success('Đổi mật khẩu thành công!');
                form.resetFields();
                onClose();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi đổi mật khẩu');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Đổi Mật khẩu"
            open={open}
            onCancel={onClose}
            footer={null}
            destroyOnHidden
            width={400}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                className="mt-4"
            >
                <Form.Item 
                    label="Mật khẩu hiện tại" 
                    name="currentPassword" 
                    rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
                >
                    <Input.Password placeholder="Nhập mật khẩu hiện tại..." />
                </Form.Item>

                <Form.Item 
                    label="Mật khẩu mới" 
                    name="newPassword" 
                    rules={[{ required: true, message: 'Vui lòng nhập mật khẩu mới' }, { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }]}
                >
                    <Input.Password placeholder="Nhập mật khẩu mới..." />
                </Form.Item>

                <Form.Item 
                    label="Nhập lại mật khẩu mới" 
                    name="confirmPassword" 
                    dependencies={['newPassword']}
                    rules={[
                        { required: true, message: 'Vui lòng nhập lại mật khẩu mới' },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                if (!value || getFieldValue('newPassword') === value) {
                                    return Promise.resolve();
                                }
                                return Promise.reject(new Error('Mật khẩu nhập lại không khớp!'));
                            },
                        }),
                    ]}
                >
                    <Input.Password placeholder="Nhập lại mật khẩu mới..." />
                </Form.Item>

                <div className="flex justify-end gap-2 mt-8">
                    <Button onClick={onClose} disabled={loading}>Hủy</Button>
                    <Button type="primary" htmlType="submit" loading={loading} className="bg-blue-600">
                        Đổi Mật khẩu
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
