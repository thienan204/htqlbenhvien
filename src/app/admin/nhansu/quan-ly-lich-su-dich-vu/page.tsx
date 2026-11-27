'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Input, message, Tag, Space, Typography, Popconfirm } from 'antd';
import { DeleteOutlined, SearchOutlined, ReloadOutlined, HistoryOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { getBasePath } from '@/utils/config';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function QuanLyLichSuDichVuPage() {
    const { hasPermission } = useAuth();
    
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [search, setSearch] = useState('');
    
    const [deleting, setDeleting] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    useEffect(() => {
        fetchData();
    }, [page, limit]);

    const fetchData = async (searchParam = search) => {
        setLoading(true);
        try {
            const res = await fetch(`${getBasePath()}/api/doctor-service-mapping?page=${page}&limit=${limit}&search=${encodeURIComponent(searchParam)}`);
            const json = await res.json();
            
            if (json.data) {
                setData(json.data);
                setTotal(json.total);
            } else {
                message.error('Lỗi khi tải dữ liệu');
            }
        } catch (error) {
            console.error(error);
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (value: string) => {
        setSearch(value);
        setPage(1); // Reset to first page
        fetchData(value);
    };

    const handleDeleteSelected = async () => {
        if (selectedRowKeys.length === 0) return;
        setDeleting(true);
        try {
            const res = await fetch(`${getBasePath()}/api/doctor-service-mapping`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedRowKeys }),
            });
            const json = await res.json();

            if (res.ok && json.success) {
                message.success(
                    json.snapshotId
                        ? `Đã xóa ${json.count ?? selectedRowKeys.length} bản ghi đã chọn (đã lưu Snapshot dự phòng).`
                        : `Đã xóa ${json.count ?? selectedRowKeys.length} bản ghi đã chọn!`
                );
                setSelectedRowKeys([]);
                fetchData();
            } else {
                message.error(json.error || 'Lỗi khi xóa dữ liệu');
            }
        } catch (error) {
            console.error(error);
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setDeleting(false);
        }
    };

    if (!hasPermission('MENU_CHUYEN_DE')) {
        return <div className="p-12 text-center text-red-500 font-bold text-xl">Truy cập bị từ chối</div>;
    }

    const columns = [
        {
            title: 'STT',
            width: 70,
            render: (_: any, __: any, index: number) => (page - 1) * limit + index + 1
        },
        {
            title: 'CCHN Bác Sĩ',
            dataIndex: 'cchn',
            width: 150,
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: 'Mã Dịch Vụ',
            dataIndex: 'ma_dich_vu',
            width: 150,
            render: (text: string) => <Tag color="blue">{text}</Tag>
        },
        {
            title: 'Tên Dịch Vụ',
            dataIndex: 'ten_dich_vu',
        },
        {
            title: 'Ngày ghi nhận',
            dataIndex: 'createdAt',
            width: 180,
            render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm')
        },
        {
            title: 'Nguồn',
            dataIndex: 'source',
            width: 120,
            render: (text: string) => <Tag color={text === 'XML_AUTO' ? 'purple' : 'default'}>{text}</Tag>
        }
    ];

    return (
        <div className="p-6 max-w-[98%] mx-auto space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-2xl">
                        <HistoryOutlined />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">Quản lý Lịch sử Dịch vụ Cá nhân</h1>
                        <p className="text-slate-500 m-0">Xem và dọn dẹp các mã dịch vụ đã đồng bộ từ file XML.</p>
                    </div>
                </div>
            </div>

            <Card 
                className="shadow-sm rounded-xl border-slate-100"
                title={<span className="font-semibold">Danh sách bản ghi (Tổng: {total})</span>}
                extra={
                    <Space>
                        <Input.Search 
                            placeholder="Tìm CCHN hoặc Mã/Tên Dịch vụ..." 
                            allowClear
                            onSearch={handleSearch}
                            style={{ width: 300 }}
                        />
                        <Button icon={<ReloadOutlined />} onClick={() => fetchData()} />
                        <Popconfirm
                            title={`Xóa ${selectedRowKeys.length} bản ghi đã chọn?`}
                            description="Hệ thống sẽ tự động chụp Snapshot dự phòng trước khi xóa."
                            onConfirm={handleDeleteSelected}
                            okText="Xóa đã chọn"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                            disabled={selectedRowKeys.length === 0}
                        >
                            <Button
                                type="primary"
                                danger
                                icon={<DeleteOutlined />}
                                loading={deleting}
                                disabled={selectedRowKeys.length === 0}
                            >
                                Xóa đã chọn{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
                            </Button>
                        </Popconfirm>
                    </Space>
                }
            >
                <Table
                    rowSelection={{
                        selectedRowKeys,
                        onChange: (keys) => setSelectedRowKeys(keys),
                    }}
                    columns={columns}
                    dataSource={data}
                    rowKey="id"
                    loading={loading || deleting}
                    scroll={{ x: 1000 }}
                    pagination={{
                        current: page,
                        pageSize: limit,
                        total: total,
                        showSizeChanger: true,
                        pageSizeOptions: ['20', '50', '100', '500'],
                        onChange: (newPage, newLimit) => {
                            setPage(newPage);
                            setLimit(newLimit);
                        }
                    }}
                />
            </Card>
        </div>
    );
}
