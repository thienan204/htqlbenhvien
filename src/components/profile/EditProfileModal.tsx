'use client';

import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, message, Switch } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface EditProfileModalProps {
    open: boolean;
    onClose: () => void;
}

export default function EditProfileModal({ open, onClose }: EditProfileModalProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (open && user) {
            // Fetch latest user data
            const fetchProfile = async () => {
                try {
                    const res = await fetch('/api/auth/profile');
                    if (res.ok) {
                        const data = await res.json();
                        form.setFieldsValue({
                            username: data.username,
                            name: data.name,
                            telegram_id: data.telegram_id,
                            isAvailable: data.isAvailable
                        });
                    }
                } catch (error) {
                    console.error('Error fetching profile:', error);
                }
            };
            fetchProfile();
        }
    }, [open, user, form]);

    const handleSave = async (values: any) => {
        setLoading(true);
        try {
            const res = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });

            if (res.ok) {
                message.success('Cập nhật hồ sơ thành công! Yêu cầu tải lại trang.');
                onClose();
                router.refresh();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi cập nhật hồ sơ');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Cập nhật Hồ sơ Cá nhân"
            open={open}
            onCancel={onClose}
            footer={null}
            destroyOnHidden
            width={500}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                className="mt-4"
            >
                <Form.Item label="Tên đăng nhập" name="username">
                    <Input disabled className="bg-slate-50 text-slate-500" />
                </Form.Item>

                <Form.Item 
                    label="Tên hiển thị" 
                    name="name" 
                    rules={[{ required: true, message: 'Vui lòng nhập tên hiển thị' }]}
                >
                    <Input placeholder="Nhập tên hiển thị..." />
                </Form.Item>

                <Form.Item label="Telegram ID" name="telegram_id">
                    <Input placeholder="Nhập ID để nhận thông báo từ Bot..." />
                </Form.Item>

                {user?.role === 'CNTT' && (
                    <Form.Item 
                        label="Sẵn sàng nhận việc (Trực ban)" 
                        name="isAvailable" 
                        valuePropName="checked"
                        tooltip="Bật để nhận yêu cầu IT tự động chia việc"
                    >
                        <Switch checkedChildren="Sẵn sàng" unCheckedChildren="Đang bận" />
                    </Form.Item>
                )}

                <div className="flex justify-end gap-2 mt-8">
                    <Button onClick={onClose} disabled={loading}>Hủy</Button>
                    <Button type="primary" htmlType="submit" loading={loading} className="bg-blue-600">
                        Lưu Thay Đổi
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
