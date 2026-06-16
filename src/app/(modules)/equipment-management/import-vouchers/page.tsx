'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Typography, message, Popconfirm } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function VouchersPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/inventory-vouchers?type=NHAP_KHO');
            if (res.ok) {
                const result = await res.json();
                setData(result);
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách phiếu nhập', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/inventory-vouchers/${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa phiếu thành công');
                fetchData();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi xóa phiếu');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleApprove = async (id: string) => {
        try {
            const res = await fetch(`/api/inventory-vouchers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'APPROVE' })
            });
            if (res.ok) {
                message.success('Đã duyệt phiếu và sinh tài sản thành công!');
                fetchData();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi duyệt phiếu');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const columns = [
        {
            title: 'Mã Phiếu',
            dataIndex: 'voucher_code',
            key: 'voucher_code',
            render: (text: string) => <b>{text}</b>,
        },
        {
            title: 'Ngày chứng từ',
            dataIndex: 'document_date',
            key: 'document_date',
            render: (date: string) => date ? dayjs(date).format('DD/MM/YYYY') : '-',
        },
        {
            title: 'Nhà cung cấp / Đơn vị giao',
            dataIndex: 'supplier_name',
            key: 'supplier_name',
        },
        {
            title: 'Kho Nhập',
            key: 'to_warehouse',
            render: (record: any) => record.to_warehouse?.name || '-',
        },
        {
            title: 'Số mặt hàng',
            key: 'details_count',
            render: (record: any) => (
                <Tag color="blue">{record.details?.length || 0} mặt hàng</Tag>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'APPROVED' ? 'success' : 'warning'}>
                    {status === 'APPROVED' ? 'Đã duyệt (Đã nhập kho)' : 'Chờ duyệt'}
                </Tag>
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => {
                if (record.status === 'APPROVED') {
                    return (
                        <Space size="small">
                            <Link href={`/equipment-management/import-vouchers/view/${record.id}`}>
                                <Button type="text" className="text-blue-600" icon={<EyeOutlined />}>Xem chi tiết</Button>
                            </Link>
                            <Popconfirm
                                title="Thu hồi toàn bộ thiết bị và xóa phiếu này?"
                                onConfirm={() => handleDelete(record.id)}
                                okText="Xóa"
                                cancelText="Hủy"
                            >
                                <Button type="text" danger icon={<DeleteOutlined />} title="Xóa phiếu" />
                            </Popconfirm>
                        </Space>
                    );
                }
                
                return (
                    <Space size="small">
                        <Button 
                            type="text" 
                            className="text-green-600" 
                            icon={<CheckOutlined />} 
                            onClick={() => handleApprove(record.id)}
                            title="Duyệt phiếu (Nhập vào kho)"
                        />
                        <Link href={`/equipment-management/import-vouchers/edit/${record.id}`}>
                            <Button 
                                type="text" 
                                className="text-blue-600" 
                                icon={<EditOutlined />} 
                                title="Chỉnh sửa phiếu"
                            />
                        </Link>
                        <Popconfirm
                            title="Xóa phiếu nháp này?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Xóa"
                            cancelText="Hủy"
                        >
                            <Button type="text" danger icon={<DeleteOutlined />} title="Xóa phiếu" />
                        </Popconfirm>
                    </Space>
                );
            },
        },
    ];

    return (
        <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <Title level={3} className="!mb-0 text-slate-800">Danh sách Phiếu Nhập Kho</Title>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    onClick={() => router.push('/equipment-management/import-vouchers/create')}
                    className="bg-blue-600"
                >
                    Lập Phiếu Nhập
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
        </div>
    );
}
