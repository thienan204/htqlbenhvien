'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, message, Popconfirm, Tooltip, Tag, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, EyeOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

export default function AdminInstructionsPage() {
    const [instructions, setInstructions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [form] = Form.useForm();
    const [content, setContent] = useState('');
    const { user } = useAuth();
    const router = useRouter();

    const canEdit = user?.role === 'ADMIN';

    useEffect(() => {
        if (!canEdit && user) {
            router.push('/');
        }
    }, [user, router, canEdit]);

    const fetchInstructions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/page-instructions');
            const data = await res.json();
            if (data.success) {
                setInstructions(data.data);
            } else {
                message.error('Lỗi lấy danh sách hướng dẫn');
            }
        } catch (error) {
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (canEdit) {
            fetchInstructions();
        }
    }, [canEdit]);

    const handleAdd = () => {
        setEditingItem(null);
        setContent('');
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (record: any) => {
        setEditingItem(record);
        setContent(record.content || '');
        form.setFieldsValue({
            title: record.title,
            pageId: record.pageId,
            description: record.description,
            showOnPage: record.showOnPage !== false
        });
        setIsModalVisible(true);
    };

    const handleDelete = async (pageId: string) => {
        try {
            const res = await fetch(`/api/page-instructions?pageId=${pageId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                message.success('Đã xóa thành công');
                fetchInstructions();
            } else {
                message.error('Lỗi khi xóa');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleSave = async (values: any) => {
        try {
            const finalPageId = editingItem ? editingItem.pageId : values.pageId;
            const res = await fetch('/api/page-instructions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pageId: finalPageId,
                    title: values.title,
                    description: values.description,
                    content: content,
                    showOnPage: values.showOnPage
                })
            });
            const data = await res.json();
            if (data.success) {
                message.success('Lưu thành công!');
                setIsModalVisible(false);
                fetchInstructions();
            } else {
                message.error('Lỗi khi lưu: ' + (data.error || ''));
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleCopyLink = (pageId: string) => {
        const link = `${window.location.origin}/htqlbenhvien/huong-dan/${pageId}`;
        navigator.clipboard.writeText(link);
        message.success('Đã copy link: ' + link);
    };

    const columns = [
        {
            title: 'Tiêu đề',
            dataIndex: 'title',
            key: 'title',
            render: (text: string, record: any) => (
                <div>
                    <div style={{ fontWeight: 'bold' }}>{text || '(Chưa có tiêu đề)'}</div>
                    <div style={{ fontSize: 12, color: 'gray' }}>{record.description}</div>
                </div>
            )
        },
        {
            title: 'Link (Slug)',
            dataIndex: 'pageId',
            key: 'pageId',
            width: 250,
            render: (text: string) => <Tag color="blue">{text}</Tag>
        },
        {
            title: 'Ngày cập nhật',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            width: 150,
            render: (text: string) => new Date(text).toLocaleDateString('vi-VN')
        },
        {
            title: 'Hiển thị nút',
            dataIndex: 'showOnPage',
            key: 'showOnPage',
            width: 120,
            render: (val: boolean) => <Tag color={val !== false ? 'green' : 'default'}>{val !== false ? 'Đang bật' : 'Đã ẩn'}</Tag>
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 200,
            render: (_: any, record: any) => (
                <Space>
                    <Tooltip title="Xem">
                        <Button 
                            icon={<EyeOutlined />} 
                            size="small"
                            onClick={() => window.open(`/htqlbenhvien/huong-dan/${record.pageId}`, '_blank')}
                        />
                    </Tooltip>
                    <Tooltip title="Copy Link">
                        <Button 
                            icon={<CopyOutlined />} 
                            size="small" 
                            onClick={() => handleCopyLink(record.pageId)}
                        />
                    </Tooltip>
                    <Tooltip title="Sửa">
                        <Button 
                            type="primary" 
                            icon={<EditOutlined />} 
                            size="small" 
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Bạn có chắc chắn muốn xóa bài hướng dẫn này?"
                        onConfirm={() => handleDelete(record.pageId)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Tooltip title="Xóa">
                            <Button danger icon={<DeleteOutlined />} size="small" />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const editorConfig = React.useMemo(() => ({
        readonly: false,
        height: 500,
        language: 'vi',
        placeholder: 'Nhập nội dung hướng dẫn...',
        uploader: { 
            url: '/htqlbenhvien/api/upload-image',
            format: 'json',
        },
    }), []);

    if (!canEdit) return null;

    return (
        <div style={{ padding: 24 }}>
            <Card 
                title="Quản lý Bài Hướng dẫn" 
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Tạo bài mới</Button>}
            >
                <Table 
                    columns={columns} 
                    dataSource={instructions} 
                    rowKey="id" 
                    loading={loading} 
                />
            </Card>

            <Modal
                title={editingItem ? "Sửa Bài Hướng dẫn" : "Tạo Bài Hướng dẫn mới"}
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                footer={null}
                width={1000}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                    initialValues={{ showOnPage: true }}
                >
                    <div style={{ display: 'flex', gap: 16 }}>
                        <Form.Item
                            name="title"
                            label="Tiêu đề"
                            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                            style={{ flex: 1 }}
                        >
                            <Input placeholder="VD: Hướng dẫn lấy mã TOTP" />
                        </Form.Item>
                        <Form.Item
                            name="pageId"
                            label="Link (Slug)"
                            rules={[{ required: true, message: 'Vui lòng nhập slug' }]}
                            style={{ flex: 1 }}
                        >
                            <Input placeholder="VD: lay-ma-totp (không dấu, không khoảng trắng)" disabled={!!editingItem} />
                        </Form.Item>
                    </div>

                    <Form.Item
                        name="description"
                        label="Mô tả ngắn"
                    >
                        <Input.TextArea placeholder="Mô tả tóm tắt nội dung hướng dẫn..." rows={2} />
                    </Form.Item>

                    <Form.Item
                        name="showOnPage"
                        label="Hiển thị nút Hướng dẫn trên các trang"
                        valuePropName="checked"
                        tooltip="Bật: Tự động hiển thị nút Hướng dẫn nổi trên các trang có URL khớp với Slug. Tắt: Chỉ xem được qua Link trực tiếp."
                    >
                        <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                    </Form.Item>

                    <Form.Item label="Nội dung chi tiết">
                        <JoditEditor
                            value={content}
                            config={editorConfig as any}
                            onBlur={newContent => setContent(newContent)}
                        />
                    </Form.Item>

                    <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
                        <Space>
                            <Button onClick={() => setIsModalVisible(false)}>Hủy</Button>
                            <Button type="primary" htmlType="submit">
                                Lưu lại
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
