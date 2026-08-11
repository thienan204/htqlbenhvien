'use client';

import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Typography, Space, message, Popconfirm, Spin, Layout, Breadcrumb, Switch } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Content } = Layout;

export default function PathsConfigPage() {
    const [paths, setPaths] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newPath, setNewPath] = useState('');

    const [isMaintenance, setIsMaintenance] = useState(false);
    const [toggling, setToggling] = useState(false);

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

    const fetchMaintenance = async () => {
        try {
            const res = await fetch('/api/configs/maintenance');
            if (res.ok) {
                const data = await res.json();
                setIsMaintenance(data.isMaintenance);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchPaths();
        fetchMaintenance();
    }, []);

    const handleToggleMaintenance = async (checked: boolean) => {
        setToggling(true);
        try {
            const res = await fetch('/api/configs/maintenance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: checked })
            });
            if (res.ok) {
                setIsMaintenance(checked);
                message.success(checked ? 'Đã BẬT chế độ bảo trì!' : 'Đã TẮT chế độ bảo trì!');
            } else {
                throw new Error('Failed');
            }
        } catch (error) {
            message.error('Có lỗi xảy ra khi thay đổi trạng thái bảo trì.');
        } finally {
            setToggling(false);
        }
    };

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
                <Breadcrumb className="mb-4" items={[{ title: 'Quản trị' }, { title: 'Cấu hình hệ thống' }]} />
                
                <Card 
                    title={<Title level={4} className="!m-0 text-orange-600">Bảo trì Hệ thống (Maintenance Mode)</Title>}
                    className="shadow-sm border-orange-200 mb-6"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <Text strong>Trạng thái Bảo trì</Text>
                            <br/>
                            <Text type="secondary">Khi bật, tất cả người dùng bình thường sẽ bị chuyển hướng sang trang Bảo trì. Chỉ có Admin mới có thể tiếp tục sử dụng hệ thống.</Text>
                        </div>
                        <Switch 
                            checked={isMaintenance} 
                            onChange={handleToggleMaintenance} 
                            loading={toggling}
                            checkedChildren="ĐANG BẬT"
                            unCheckedChildren="ĐANG TẮT"
                        />
                    </div>
                </Card>

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
                            <small className="text-emerald-600 font-medium">Hệ thống đã được nâng cấp: Các thay đổi sẽ có tác dụng ngay lập tức (Real-time) mà không cần khởi động lại Server!</small>
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
                        <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-200">
                            {paths.map((item) => (
                                <div
                                    key={item}
                                    className="flex justify-between items-center p-4 hover:bg-slate-50 transition-colors"
                                >
                                    <Text strong className="font-mono text-slate-700">{item}</Text>
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
                                </div>
                            ))}
                            {paths.length === 0 && (
                                <div className="p-8 text-center text-slate-500">
                                    Chưa có đường dẫn nào được cấu hình
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </Content>
        </Layout>
    );
}
