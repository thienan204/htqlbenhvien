'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import ReportConfigModal from './components/ReportConfigModal';

export default function ReportsPage() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const basePath = window.location.pathname.split('/staff')[0];
            const res = await fetch(`${basePath}/api/staff/reports`);
            if (res.ok) {
                const data = await res.json();
                setTemplates(data);
            }
        } catch (error) {
            console.error(error);
            message.error('Lỗi khi tải danh sách báo cáo');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleDelete = async (id: string) => {
        try {
            const basePath = window.location.pathname.split('/staff')[0];
            const res = await fetch(`${basePath}/api/staff/reports/${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa báo cáo');
                fetchTemplates();
            } else {
                message.error('Lỗi khi xóa');
            }
        } catch (e) {
            message.error('Lỗi hệ thống');
        }
    };

    const handleExport = (id: string) => {
        const basePath = window.location.pathname.split('/staff')[0];
        const url = new URL(`${basePath}/api/staff/reports/${id}/export`, window.location.origin);
        window.open(url.toString(), '_blank');
    };

    const columns = [
        { title: 'Mã báo cáo', dataIndex: 'code', key: 'code', width: 150 },
        { title: 'Tên báo cáo', dataIndex: 'name', key: 'name' },
        { title: 'Mô tả', dataIndex: 'description', key: 'description' },
        { 
            title: 'Thao tác', 
            key: 'action',
            width: 250,
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Button 
                        type="primary" 
                        icon={<DownloadOutlined />} 
                        onClick={() => handleExport(record.id)}
                    >
                        Xuất
                    </Button>
                    <Button 
                        icon={<EditOutlined />} 
                        onClick={() => {
                            setEditingId(record.id);
                            setModalOpen(true);
                        }}
                    >
                        Sửa
                    </Button>
                    <Popconfirm
                        title="Bạn có chắc chắn muốn xóa mẫu này không?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Có"
                        cancelText="Không"
                    >
                        <Button danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Quản lý Mẫu Báo cáo</h1>
                    <p className="text-slate-500">Thiết lập cấu hình động cho các loại báo cáo, danh sách</p>
                </div>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    size="large"
                    onClick={() => {
                        setEditingId(null);
                        setModalOpen(true);
                    }}
                >
                    Tạo Báo cáo mới
                </Button>
            </div>

            <Card className="shadow-sm rounded-xl">
                <Table 
                    columns={columns} 
                    dataSource={templates} 
                    rowKey="id" 
                    loading={loading}
                    pagination={false}
                />
            </Card>

            {modalOpen && (
                <ReportConfigModal 
                    open={modalOpen} 
                    onClose={() => setModalOpen(false)} 
                    onSuccess={() => {
                        setModalOpen(false);
                        fetchTemplates();
                    }}
                    templateId={editingId}
                />
            )}
        </div>
    );
}
