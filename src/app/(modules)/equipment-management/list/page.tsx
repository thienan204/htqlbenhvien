'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Popconfirm, message, Tag, Typography, Tooltip, Input } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, QrcodeOutlined, SearchOutlined, PrinterOutlined } from '@ant-design/icons';
import EquipmentModal from './EquipmentModal';
import PrintQRCodeModal from './PrintQRCodeModal';

const { Title, Text } = Typography;

export default function EquipmentsPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [searchText, setSearchText] = useState('');
    const [printModalOpen, setPrintModalOpen] = useState(false);
    const [printingRecord, setPrintingRecord] = useState<any>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/equipments');
            if (res.ok) {
                const result = await res.json();
                setData(result);
            }
        } catch (error) {
            message.error('Lỗi khi tải danh sách thiết bị');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/equipments/${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa thiết bị');
                fetchData();
            } else {
                message.error('Không thể xóa thiết bị này');
            }
        } catch (error) {
            message.error('Có lỗi xảy ra');
        }
    };

    const filteredData = data.filter(item => 
        item.ten_vttb?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.ma_vttb?.toLowerCase().includes(searchText.toLowerCase())
    );

    const columns = [
        {
            title: 'Mã TB',
            dataIndex: 'ma_vttb',
            key: 'ma_vttb',
            render: (text: string) => <Text strong className="text-blue-600">{text}</Text>,
        },
        {
            title: 'Tên Thiết Bị',
            dataIndex: 'ten_vttb',
            key: 'ten_vttb',
        },
        {
            title: 'QR Code',
            dataIndex: 'qr_code',
            key: 'qr_code',
            render: (text: string, record: any) => (
                <Tooltip title="Nhấn để xem và in mã QR">
                    <Tag 
                        icon={<QrcodeOutlined />} 
                        color="purple"
                        className="cursor-pointer hover:opacity-80"
                        onClick={() => {
                            setPrintingRecord(record);
                            setPrintModalOpen(true);
                        }}
                    >
                        {text.substring(0, 8)}...
                    </Tag>
                </Tooltip>
            )
        },
        {
            title: 'Kho / Vị trí',
            key: 'warehouse',
            render: (record: any) => record.warehouse?.name || '-',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                let color = 'default';
                let text = status;
                switch(status) {
                    case 'TRONG_KHO': color = 'blue'; text = 'Trong kho'; break;
                    case 'DANG_SU_DUNG': color = 'green'; text = 'Đang sử dụng'; break;
                    case 'BAO_HONG': color = 'orange'; text = 'Báo hỏng'; break;
                    case 'THANH_LY': color = 'red'; text = 'Thanh lý'; break;
                }
                return <Tag color={color}>{text}</Tag>;
            }
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Tooltip title="In tem mã QR">
                        <Button 
                            type="text" 
                            className="text-purple-600"
                            icon={<PrinterOutlined />} 
                            onClick={() => {
                                setPrintingRecord(record);
                                setPrintModalOpen(true);
                            }}
                        />
                    </Tooltip>
                    <Button 
                        type="text" 
                        className="text-blue-600"
                        icon={<EditOutlined />} 
                        onClick={() => {
                            setEditingRecord(record);
                            setModalOpen(true);
                        }}
                    >
                        Sửa
                    </Button>
                    <Popconfirm
                        title="Bạn có chắc chắn muốn xóa?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <Title level={3} className="!mb-0 text-slate-800">Danh sách Thiết bị</Title>
                    <Text type="secondary">Quản lý toàn bộ vật tư, trang thiết bị trong hệ thống</Text>
                </div>
                <Space>
                    <Input 
                        placeholder="Tìm kiếm thiết bị..." 
                        prefix={<SearchOutlined className="text-slate-400" />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="w-64"
                    />
                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        onClick={() => {
                            setEditingRecord(null);
                            setModalOpen(true);
                        }}
                        className="bg-blue-600"
                    >
                        Thêm thiết bị
                    </Button>
                </Space>
            </div>

            <Table 
                columns={columns} 
                dataSource={filteredData} 
                rowKey="id" 
                loading={loading}
                pagination={{ pageSize: 10 }}
                className="border border-slate-100 rounded-lg overflow-hidden"
            />

            {modalOpen && (
                <EquipmentModal 
                    open={modalOpen} 
                    onClose={() => setModalOpen(false)}
                    onSuccess={() => {
                        setModalOpen(false);
                        fetchData();
                    }}
                    equipmentData={editingRecord}
                />
            )}

            {printModalOpen && (
                <PrintQRCodeModal
                    open={printModalOpen}
                    onClose={() => setPrintModalOpen(false)}
                    equipment={printingRecord}
                />
            )}
        </div>
    );
}
