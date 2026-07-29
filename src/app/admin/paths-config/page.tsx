'use client';

import React, { useState, useEffect } from 'react';
import { Card, Input, Button, List, Typography, Space, message, Popconfirm, Spin, Layout, Breadcrumb } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Content } = Layout;

export default function PathsConfigPage() {
    const [paths, setPaths] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newPath, setNewPath] = useState('');

    const fetchPaths = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/paths-config');
            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();
            setPaths(data);
        } catch (error) {
            message.error('Không thể tải danh sách đường dẫn');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPaths();
    }, []);

    const handleAddPath = () => {
        if (!newPath.trim()) return;
        let formattedPath = newPath.trim();
        if (!formattedPath.startsWith('/')) {
            formattedPath = '/' + formattedPath;
        }

        if (paths.includes(formattedPath)) {
            message.warning('Đường dẫn này đã tồn tại!');
            return;
        }

        setPaths([...paths, formattedPath]);
        setNewPath('');
    };

    const handleRemovePath = (pathToRemove: string) => {
        setPaths(paths.filter(p => p !== pathToRemove));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/paths-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(paths)
            });
            if (!res.ok) throw new Error('Failed to save');
            message.success('Đã lưu cấu hình thành công!');
        } catch (error) {
            message.error('Không thể lưu cấu hình. Vui lòng thử lại.');
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Layout className="min-h-screen bg-slate-50">
            <Content className="p-6 max-w-4xl mx-auto w-full">
                <Breadcrumb className="mb-4" items={[{ title: 'Quản trị' }, { title: 'Cấu hình đường dẫn bảo mật' }]} />
                
                <Card 
                    title={<Title level={4} className="!m-0">Quản lý Không gian Quản trị (ADMIN_ONLY_PATHS)</Title>}
                    extra={
                        <Space>
                            <Button icon={<ReloadOutlined />} onClick={fetchPaths} disabled={loading || saving}>Tải lại</Button>
                            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>Lưu cấu hình</Button>
                        </Space>
                    }
                    className="shadow-sm border-slate-200"
                >
                    <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <Text className="text-blue-800">
                            <strong>Lưu ý quan trọng:</strong> Bất kỳ đường dẫn nào (hoặc bắt đầu bằng) các cấu hình dưới đây sẽ yêu cầu tài khoản phải có quyền <code>ADMIN</code> mới được phép truy cập.
                            <br />
                            <small className="text-blue-600">Thay đổi cấu hình có thể cần khởi động lại Server (hoặc đợi Hệ thống tự động Re-build) để có tác dụng ở môi trường Production.</small>
                        </Text>
                    </div>

                    <Space.Compact className="w-full mb-6">
                        <Button disabled size="large">/</Button>
                        <Input 
                            placeholder="Nhập đường dẫn mới (VD: admin/reports)" 
                            value={newPath}
                            onChange={(e) => setNewPath(e.target.value)}
                            onPressEnter={handleAddPath}
                            size="large"
                        />
                        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleAddPath}>
                            Thêm
                        </Button>
                    </Space.Compact>

                    {loading ? (
                        <div className="text-center py-10"><Spin size="large" /></div>
                    ) : (
                        <List
                            bordered
                            dataSource={paths}
                            renderItem={(item) => (
                                <List.Item
                                    actions={[
                                        <Popconfirm
                                            key="delete"
                                            title="Bạn có chắc muốn xóa đường dẫn này?"
                                            onConfirm={() => handleRemovePath(item)}
                                            okText="Xóa"
                                            cancelText="Hủy"
                                            okButtonProps={{ danger: true }}
                                        >
                                            <Button danger type="text" icon={<DeleteOutlined />} />
                                        </Popconfirm>
                                    ]}
                                    className="hover:bg-slate-50 transition-colors"
                                >
                                    <Text strong className="font-mono text-slate-700">{item}</Text>
                                </List.Item>
                            )}
                        />
                    )}
                </Card>
            </Content>
        </Layout>
    );
}
