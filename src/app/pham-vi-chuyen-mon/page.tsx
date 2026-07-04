'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Popconfirm, message, Card, Tooltip, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import ServiceMappingModal from './components/ServiceMappingModal';

export default function ScopeOfPracticeCatalogPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [form] = Form.useForm();
    const [searchText, setSearchText] = useState('');
    const [mappingModalOpen, setMappingModalOpen] = useState(false);
    const [mappingRecord, setMappingRecord] = useState<any>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/pham-vi-chuyen-mon`);
            if (!res.ok) throw new Error('Network response was not ok');
            const result = await res.json();
            setData(result);
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (isModalOpen) {
            if (editingRecord) {
                form.setFieldsValue(editingRecord);
            } else {
                form.resetFields();
                form.setFieldsValue({ isActive: true });
            }
        }
    }, [isModalOpen, editingRecord, form]);

    const handleAdd = () => {
        setEditingRecord(null);
        setIsModalOpen(true);
    };

    const handleOpenMapping = (record: any) => {
        setMappingRecord(record);
        setMappingModalOpen(true);
    };

    const handleEdit = (record: any) => {
        setEditingRecord(record);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/pham-vi-chuyen-mon?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa dòng');
                fetchData();
            } else {
                message.error('Xóa thất bại');
            }
        } catch (error) {
            message.error('Xóa thất bại');
        }
    };

    const handleSave = async (values: any) => {
        try {
            if (editingRecord) {
                const res = await fetch(`/api/pham-vi-chuyen-mon`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...values, id: editingRecord.id })
                });
                if (res.ok) {
                    message.success('Cập nhật thành công');
                    setIsModalOpen(false);
                    fetchData();
                } else {
                    const err = await res.json();
                    message.error(err.error || 'Lỗi cập nhật');
                }
            } else {
                const res = await fetch(`/api/pham-vi-chuyen-mon`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(values)
                });
                if (res.ok) {
                    message.success('Thêm mới thành công');
                    setIsModalOpen(false);
                    fetchData();
                } else {
                    const err = await res.json();
                    message.error(err.error || 'Lỗi thêm mới');
                }
            }
        } catch (error) {
            message.error('Lưu thất bại');
        }
    };

    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => index + 1
        },
        { title: 'Mã Phạm vi', dataIndex: 'ma_pham_vi', width: 120, render: (text: string) => <span className="font-semibold text-blue-600">{text}</span> },
        { title: 'Tên Chức danh / Phạm vi', dataIndex: 'ten_chuc_danh' },
        { title: 'Ghi chú', dataIndex: 'ghi_chu' },
        { 
            title: 'Trạng thái', 
            dataIndex: 'isActive', 
            width: 120,
            align: 'center' as const,
            render: (val: boolean) => val ? <span className="text-green-600 font-medium">Đang dùng</span> : <span className="text-red-500">Đã khóa</span>
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 120,
            align: 'center' as const,
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Tooltip title="Cấu hình Dịch vụ (Mẫu 05)">
                        <Button type="text" icon={<AppstoreAddOutlined className="text-purple-500" />} onClick={() => handleOpenMapping(record)} />
                    </Tooltip>
                    <Tooltip title="Sửa">
                        <Button type="text" icon={<EditOutlined className="text-blue-500" />} onClick={() => handleEdit(record)} />
                    </Tooltip>
                    <Popconfirm
                        title="Bạn có chắc chắn muốn xóa?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Có"
                        cancelText="Không"
                    >
                        <Tooltip title="Xóa">
                            <Button type="text" icon={<DeleteOutlined className="text-red-500" />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const filteredData = data.filter(item =>
        (item.ma_pham_vi?.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.ten_chuc_danh?.toLowerCase().includes(searchText.toLowerCase()))
    );

    return (
        <div className="p-6 h-full flex flex-col bg-gray-50">
            <Card title={<span className="text-xl font-bold text-slate-700">Danh mục Phạm vi chuyên môn (CV 02.7.24)</span>} className="flex-1 drop-shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <Space>
                        <Input.Search
                            placeholder="Tìm kiếm Mã hoặc Tên chức danh..."
                            allowClear
                            onSearch={(value) => setSearchText(value)}
                            onChange={e => setSearchText(e.target.value)}
                            style={{ width: 300 }}
                        />
                        <Button icon={<SyncOutlined />} onClick={fetchData}>Làm mới</Button>
                    </Space>
                    <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            Thêm mới
                        </Button>
                    </Space>
                </div>

                <Table
                    columns={columns}
                    dataSource={filteredData}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 20 }}
                    size="middle"
                    bordered
                    scroll={{ x: 'max-content' }}
                />

                <Modal
                    title={editingRecord ? "Sửa bản ghi" : "Thêm bản ghi mới"}
                    open={isModalOpen}
                    onCancel={() => setIsModalOpen(false)}
                    onOk={() => form.submit()}
                    width={600}
                >
                    <Form form={form} layout="vertical" onFinish={handleSave}>
                        <div className="space-y-4 pt-4">
                            <Form.Item name="ma_pham_vi" label={<span className="font-medium text-slate-600">Mã phạm vi hành nghề</span>} rules={[{ required: true, message: 'Vui lòng nhập Mã phạm vi' }]}>
                                <Input placeholder="VD: 102.04" size="large" className="font-mono text-blue-700" />
                            </Form.Item>
                            <Form.Item name="ten_chuc_danh" label={<span className="font-medium text-slate-600">Tên chức danh chuyên môn</span>} rules={[{ required: true, message: 'Vui lòng nhập Tên chức danh' }]}>
                                <Input placeholder="VD: Bác sỹ chuyên khoa Nội Tim mạch" size="large" />
                            </Form.Item>
                            <Form.Item name="ghi_chu" label={<span className="font-medium text-slate-600">Ghi chú</span>}>
                                <Input.TextArea placeholder="Ghi chú thêm..." rows={2} />
                            </Form.Item>
                            <Form.Item name="isActive" valuePropName="checked">
                                <Switch checkedChildren="Đang sử dụng" unCheckedChildren="Đã khóa" />
                            </Form.Item>
                        </div>
                    </Form>
                </Modal>

                <ServiceMappingModal 
                    open={mappingModalOpen} 
                    onCancel={() => setMappingModalOpen(false)} 
                    maPhamVi={mappingRecord?.ma_pham_vi} 
                    tenPhamVi={mappingRecord?.ten_chuc_danh} 
                />
            </Card>
        </div>
    );
}
