'use client';

import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Switch, Select, message, Space, Table, Spin, Tabs } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

export default function DynamicFormBuilder({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = React.use(params);
    const id = resolvedParams.id;
    const [form] = Form.useForm();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fields, setFields] = useState<any[]>([]);

    useEffect(() => {
        const fetchForm = async () => {
            try {
                const basePath = window.location.pathname.split('/dynamic-forms')[0];
                const res = await fetch(`${basePath}/api/dynamic-forms/${id}`);
                if (res.ok) {
                    const data = await res.json();
                    form.setFieldsValue({
                        name: data.name,
                        description: data.description,
                        slug: data.slug,
                    });
                    setFields(data.config || []);
                } else {
                    message.error('Không tìm thấy Form');
                    router.push('/dynamic-forms');
                }
            } catch (error) {
                message.error('Lỗi tải dữ liệu Form');
            } finally {
                setLoading(false);
            }
        };
        fetchForm();
    }, [id]);

    const handleSave = async (values: any) => {
        setSaving(true);
        try {
            const basePath = window.location.pathname.split('/dynamic-forms')[0];
            const res = await fetch(`${basePath}/api/dynamic-forms/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...values, config: fields }),
            });
            
            if (res.ok) {
                message.success('Đã lưu cấu hình Form');
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi lưu Form');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setSaving(false);
        }
    };

    const addField = () => {
        setFields(prev => [...prev, {
            id: Date.now().toString(),
            name: `field_${prev.length + 1}`,
            label: 'Trường mới',
            type: 'text',
            required: false,
            isVerificationKey: false,
            isEditable: true,
            isHidden: false,
        }]);
    };

    const updateField = (id: string, key: string, value: any) => {
        setFields(prev => prev.map(f => f.id === id ? { ...f, [key]: value } : f));
    };

    const removeField = (id: string) => {
        setFields(prev => prev.filter(f => f.id !== id));
    };

    const columns = [
        {
            title: 'Tên cột (Hiển thị)',
            key: 'label',
            render: (_: any, record: any) => (
                <Input value={record.label} onChange={(e) => updateField(record.id, 'label', e.target.value)} />
            )
        },
        {
            title: 'Mã hệ thống (Key)',
            key: 'name',
            render: (_: any, record: any) => (
                <Input value={record.name} onChange={(e) => updateField(record.id, 'name', e.target.value)} />
            )
        },
        {
            title: 'Kiểu dữ liệu',
            key: 'type',
            render: (_: any, record: any) => (
                <Select
                    value={record.type}
                    onChange={(val) => updateField(record.id, 'type', val)}
                    style={{ width: 140 }}
                    options={[
                        { label: 'Văn bản (Text)', value: 'text' },
                        { label: 'Số (Number)', value: 'number' },
                        { label: 'Ngày tháng (Date)', value: 'date' },
                        { label: 'Số CCCD (12 số)', value: 'cccd' },
                        { label: 'Số điện thoại', value: 'phone' },
                        { label: 'Hình ảnh (Upload)', value: 'image' },
                    ]}
                />
            )
        },
        {
            title: 'Thuộc tính',
            key: 'attributes',
            render: (_: any, record: any) => (
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Bắt buộc nhập:</span>
                        <Switch 
                            checked={record.required} 
                            onChange={(val) => updateField(record.id, 'required', val)} 
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Cho phép sửa:</span>
                        <Switch 
                            checked={record.isEditable} 
                            onChange={(val) => updateField(record.id, 'isEditable', val)} 
                        />
                    </div>
                    <div className="flex justify-between items-center bg-blue-50 p-1 rounded">
                        <span className="text-xs font-semibold text-blue-700">Làm Mật Khẩu:</span>
                        <Switch 
                            checked={record.isVerificationKey} 
                            onChange={(val) => updateField(record.id, 'isVerificationKey', val)} 
                        />
                    </div>
                    <div className="flex justify-between items-center bg-gray-100 p-1 rounded">
                        <span className="text-xs text-gray-600">Ẩn khỏi Form:</span>
                        <Switch 
                            checked={record.isHidden} 
                            onChange={(val) => updateField(record.id, 'isHidden', val)} 
                        />
                    </div>
                </div>
            )
        },
        {
            title: '',
            key: 'action',
            render: (_: any, record: any) => (
                <Button danger icon={<DeleteOutlined />} onClick={() => removeField(record.id)} />
            )
        },
    ];

    return (
        <Spin spinning={loading} size="large">
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/dynamic-forms')}>
                        Quay lại
                    </Button>
                    <h1 className="text-2xl font-bold mb-0">Cấu hình Form</h1>
                </Space>
                <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()} loading={saving}>
                    Lưu Cấu Hình
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1">
                    <Card title="Thông tin chung" className="shadow-sm">
                        <Form form={form} layout="vertical" onFinish={handleSave}>
                            <Form.Item name="name" label="Tên Form" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                            <Form.Item name="slug" label="Đường dẫn (Slug)" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                            <Form.Item name="description" label="Mô tả">
                                <Input.TextArea rows={3} />
                            </Form.Item>
                        </Form>
                    </Card>
                </div>
                
                <div className="md:col-span-3">
                    <Card 
                        title="Thiết kế Cột dữ liệu (Builder)" 
                        className="shadow-sm"
                        extra={<Button type="dashed" icon={<PlusOutlined />} onClick={addField}>Thêm cột mới</Button>}
                    >
                        <Table
                            columns={columns}
                            dataSource={fields}
                            rowKey="id"
                            pagination={false}
                            bordered
                            size="small"
                        />
                    </Card>
                </div>
            </div>
            </div>
        </Spin>
    );
}
