'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Popconfirm, message, Tag, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import WarehouseModal from './WarehouseModal';

const { Title } = Typography;

export default function WarehousesPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/warehouses');
            if (res.ok) {
                const result = await res.json();
                setData(result);
            }
        } catch (error) {
            message.error('Lỗi khi tải danh sách kho');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/warehouses/${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa kho');
                fetchData();
            } else {
                message.error('Không thể xóa kho này');
            }
        } catch (error) {
            message.error('Có lỗi xảy ra');
        }
    };

    const columns = [
        {
            title: 'Mã Kho',
            dataIndex: 'code',
            key: 'code',
            render: (text: string) => <b>{text}</b>,
        },
        {
            title: 'Tên Kho',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Phòng ban quản lý',
            key: 'department',
            render: (record: any) => record.department?.ten_khoa || 'Chưa gắn',
        },
        {
            title: 'Loại',
            dataIndex: 'warehouse_type',
            key: 'warehouse_type',
            render: (type: string) => (
                <Tag color={type === 'KHO_CHINH' ? 'blue' : 'green'}>
                    {type === 'KHO_CHINH' ? 'Kho Chính' : 'Kho Khoa'}
                </Tag>
            )
        },
        {
            title: 'Thủ kho',
            key: 'storekeeper',
            render: (record: any) => record.storekeeper?.ho_ten || '-',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>
                    {status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng'}
                </Tag>
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Button 
                        type="primary" 
                        ghost 
                        icon={<EditOutlined />} 
                        onClick={() => {
                            setEditingRecord(record);
                            setModalOpen(true);
                        }}
                    >
                        Sửa
                    </Button>
                    <Popconfirm
                        title="Bạn có chắc chắn muốn xóa kho này?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Button danger icon={<DeleteOutlined />}>Xóa</Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <Title level={3} className="!mb-0 text-slate-800">Danh mục Kho lưu trữ</Title>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    onClick={() => {
                        setEditingRecord(null);
                        setModalOpen(true);
                    }}
                    className="bg-blue-600"
                >
                    Thêm mới Kho
                </Button>
            </div>

            <Table 
                columns={columns} 
                dataSource={data} 
                rowKey="id" 
                loading={loading}
                pagination={{ pageSize: 10 }}
                className="border border-slate-100 rounded-lg overflow-hidden"
            />

            {modalOpen && (
                <WarehouseModal 
                    open={modalOpen} 
                    onClose={() => setModalOpen(false)}
                    onSuccess={() => {
                        setModalOpen(false);
                        fetchData();
                    }}
                    warehouseData={editingRecord}
                />
            )}
        </div>
    );
}
