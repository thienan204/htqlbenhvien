'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Typography, Space, Tag, Input, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Search } = Input;

export default function ExportVouchersPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [vouchers, setVouchers] = useState<any[]>([]);

    useEffect(() => {
        fetchVouchers();
    }, []);

    const fetchVouchers = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/inventory-vouchers?type=XUAT_KHO');
            if (res.ok) {
                const data = await res.json();
                setVouchers(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { title: 'Mã Phiếu', dataIndex: 'voucher_code', key: 'voucher_code', render: (text: string) => <span className="font-bold text-orange-600">{text}</span> },
        { title: 'Ngày Xuất', dataIndex: 'document_date', key: 'document_date', render: (val: string) => val ? dayjs(val).format('DD/MM/YYYY') : '' },
        { 
            title: 'Loại Xuất', 
            dataIndex: 'sub_type', 
            key: 'sub_type',
            render: (val: string) => {
                if (val === 'XUAT_CHUYEN_KHO') return <Tag color="blue">Xuất Chuyển Kho</Tag>;
                if (val === 'XUAT_SU_DUNG') return <Tag color="green">Xuất Sử Dụng</Tag>;
                if (val === 'XUAT_TRA_NCC') return <Tag color="orange">Xuất Trả NCC</Tag>;
                return <Tag>{val}</Tag>;
            }
        },
        { 
            title: 'Từ Kho', 
            dataIndex: 'from_warehouse', 
            key: 'from_warehouse',
            render: (_: any, record: any) => record.from_warehouse?.name || ''
        },
        { 
            title: 'Đến Kho / NCC', 
            key: 'to_destination',
            render: (_: any, record: any) => {
                if (record.sub_type === 'XUAT_TRA_NCC') return record.supplier_name;
                return record.to_warehouse?.name || '';
            }
        },
        { 
            title: 'Trạng Thái', 
            dataIndex: 'status', 
            key: 'status',
            render: (val: string) => {
                if (val === 'APPROVED') return <Tag color="success">Đã duyệt (Trừ tồn)</Tag>;
                if (val === 'PENDING') return <Tag color="processing">Lưu nháp</Tag>;
                return <Tag color="error">{val}</Tag>;
            }
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Button type="text" icon={<EyeOutlined />} className="text-blue-600" />
                    {record.status === 'PENDING' && (
                        <>
                            <Button type="text" icon={<EditOutlined />} className="text-orange-600" />
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </>
                    )}
                </Space>
            )
        }
    ];

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <Title level={3} className="!mb-0 text-slate-800">Danh Sách Phiếu Xuất Kho</Title>
                    <p className="text-slate-500 mt-1">Quản lý các hoạt động xuất chuyển kho, xuất sử dụng, xuất trả NCC</p>
                </div>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    onClick={() => router.push('/equipment-management/export-vouchers/create')}
                    size="large"
                    className="bg-orange-600 font-medium"
                >
                    Lập Phiếu Xuất Kho
                </Button>
            </div>

            <Card className="shadow-sm border-slate-200">
                <div className="flex gap-4 mb-4">
                    <Search placeholder="Tìm kiếm theo mã phiếu..." className="max-w-md" />
                    <Select placeholder="Chọn trạng thái" className="w-48" allowClear>
                        <Select.Option value="PENDING">Lưu nháp</Select.Option>
                        <Select.Option value="APPROVED">Đã duyệt</Select.Option>
                    </Select>
                </div>
                
                <Table 
                    columns={columns} 
                    dataSource={vouchers} 
                    rowKey="id" 
                    loading={loading}
                />
            </Card>
        </div>
    );
}
