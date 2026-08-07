'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Space, Tag, Modal, Form, Input, message, Popconfirm } from 'antd';
import { PlusOutlined, UploadOutlined, DeleteOutlined, SettingOutlined, EyeOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import ImportExcelModal from './components/ImportExcelModal';

export default function DynamicFormsPage() {
    const [forms, setForms] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [createForm] = Form.useForm();
    const router = useRouter();

    const fetchForms = async () => {
        setLoading(true);
        try {
            const basePath = window.location.pathname.split('/dynamic-forms')[0];
            const res = await fetch(`${basePath}/api/dynamic-forms`);
            if (res.ok) {
                const data = await res.json();
                setForms(data);
            }
        } catch (error) {
            console.error('Error fetching forms:', error);
            message.error('Lỗi khi tải danh sách Form');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchForms();
    }, []);

    const handleCreateForm = async (values: any) => {
        try {
            const basePath = window.location.pathname.split('/dynamic-forms')[0];
            const res = await fetch(`${basePath}/api/dynamic-forms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            
            if (res.ok) {
                message.success('Tạo Form thành công');
                setIsCreateModalOpen(false);
                createForm.resetFields();
                fetchForms();
            } else {
                const error = await res.json();
                message.error(error.error || 'Lỗi khi tạo Form');
            }
        } catch (error) {
            message.error('Lỗi kết nối khi tạo Form');
        }
    };

    const handleDeleteForm = async (id: string) => {
        try {
            const basePath = window.location.pathname.split('/dynamic-forms')[0];
            const res = await fetch(`${basePath}/api/dynamic-forms/${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa Form và toàn bộ dữ liệu');
                fetchForms();
            } else {
                message.error('Lỗi khi xóa Form');
            }
        } catch (error) {
            message.error('Lỗi kết nối khi xóa Form');
        }
    };

    const columns = [
        {
            title: 'Tên Form',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: any) => <strong className="text-blue-600">{text}</strong>
        },
        {
            title: 'Đường dẫn (Slug)',
            dataIndex: 'slug',
            key: 'slug',
            render: (text: string) => {
                const bPath = typeof window !== 'undefined' ? window.location.pathname.split('/dynamic-forms')[0] : '/htqlbenhvien';
                return (
                    <a href={`${bPath}/${text}`} target="_blank" rel="noopener noreferrer">
                        <Tag color="blue" className="cursor-pointer hover:opacity-80">/{text}</Tag>
                    </a>
                );
            }
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Số dòng dữ liệu',
            key: 'count',
            render: (_: any, record: any) => <Tag color="green">{record._count?.data || 0} bản ghi</Tag>
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Button 
                        type="primary" 
                        icon={<SettingOutlined />} 
                        onClick={() => router.push(`/dynamic-forms/${record.id}/edit`)}
                    >
                        Cấu hình
                    </Button>
                    <Button 
                        icon={<EyeOutlined />} 
                        onClick={() => router.push(`/dynamic-forms/${record.id}/data`)}
                    >
                        Quản lý Dữ liệu
                    </Button>
                    <Popconfirm
                        title="Xóa Form"
                        description="Bạn có chắc chắn muốn xóa vĩnh viễn Form này và TOÀN BỘ dữ liệu đã thu thập không?"
                        onConfirm={() => handleDeleteForm(record.id)}
                        okText="Có, Xóa"
                        cancelText="Không"
                        okButtonProps={{ danger: true }}
                    >
                        <Button danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold mb-2">Quản lý Thu thập thông tin</h1>
                    <p className="text-gray-500">Tạo form động, thu thập dữ liệu thay thế Google Sheets</p>
                </div>
                <Space>
                    <Button icon={<UploadOutlined />} onClick={() => setIsImportModalOpen(true)}>Tạo nhanh từ Excel</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>
                        Tạo Form Mới
                    </Button>
                </Space>
            </div>

            <Card className="shadow-sm">
                <Table
                    columns={columns}
                    dataSource={forms}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 15 }}
                />
            </Card>

            <Modal
                title="Tạo Form Mới"
                open={isCreateModalOpen}
                onCancel={() => setIsCreateModalOpen(false)}
                onOk={() => createForm.submit()}
                okText="Tạo"
                cancelText="Hủy"
                forceRender
            >
                <Form form={createForm} layout="vertical" onFinish={handleCreateForm}>
                    <Form.Item
                        name="name"
                        label="Tên Form (Ví dụ: Khảo sát bệnh nhân)"
                        rules={[{ required: true, message: 'Vui lòng nhập tên form!' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="slug"
                        label="Đường dẫn tĩnh (Ví dụ: khao-sat-2026)"
                        rules={[
                            { required: true, message: 'Vui lòng nhập đường dẫn!' },
                            { pattern: /^[a-z0-9-]+$/, message: 'Chỉ chấp nhận chữ thường, số và dấu gạch ngang' }
                        ]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="description"
                        label="Mô tả ngắn gọn"
                    >
                        <Input.TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Modal>

            <ImportExcelModal 
                open={isImportModalOpen} 
                onCancel={() => setIsImportModalOpen(false)} 
                onSuccess={() => {
                    setIsImportModalOpen(false);
                    fetchForms();
                }} 
            />
        </div>
    );
}
