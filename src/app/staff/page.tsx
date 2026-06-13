'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Space, Tag, Input } from 'antd';
import { PlusOutlined, UploadOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import ImportStaffModal from './components/ImportStaffModal';
import StaffModal from './components/StaffModal';

export default function StaffPage() {
    const [staffList, setStaffList] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<any>(null);

    const fetchStaff = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/staff');
            if (res.ok) {
                const data = await res.json();
                setStaffList(data);
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách nhân sự', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const columns = [
        {
            title: 'Mã NV',
            dataIndex: 'ma_bac_si',
            key: 'ma_bac_si',
            render: (text: string) => <span className="font-semibold text-blue-600">{text}</span>
        },
        {
            title: 'Họ và tên',
            dataIndex: 'ho_ten',
            key: 'ho_ten',
            render: (text: string) => <span className="font-medium text-slate-800">{text}</span>
        },
        {
            title: 'Trình độ',
            key: 'trinh_do',
            render: (_: any, record: any) => record.trinh_do_ref ? <Tag color="blue">{record.trinh_do_ref.name}</Tag> : <span className="text-slate-400 italic">-</span>
        },
        {
            title: 'Chức danh',
            key: 'chuc_danh',
            render: (_: any, record: any) => record.chuc_danh_ref ? record.chuc_danh_ref.name : <span className="text-slate-400 italic">-</span>
        },
        {
            title: 'Khoa / Phòng',
            key: 'khoa',
            render: (_: any, record: any) => record.department ? record.department.ten_khoa : record.ma_khoa
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => (
                <Button size="small" type="primary" ghost onClick={() => {
                    setSelectedStaff(record);
                    setIsStaffModalOpen(true);
                }}>Xem chi tiết / Sửa</Button>
            )
        }
    ];

    const filteredData = staffList.filter(s => 
        (s.ho_ten && s.ho_ten.toLowerCase().includes(searchText.toLowerCase())) || 
        (s.ma_bac_si && s.ma_bac_si.toLowerCase().includes(searchText.toLowerCase()))
    );

    return (
        <div className="w-full h-full p-6 space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center text-2xl">
                        <TeamOutlined />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">Quản lý Nhân sự</h1>
                        <p className="text-slate-500 m-0">Tra cứu thông tin, chức danh, khoa phòng và CCHN.</p>
                    </div>
                </div>
                <Space>
                    <Button type="default" size="large" icon={<UploadOutlined />} onClick={() => setIsImportOpen(true)}>
                        Import Excel
                    </Button>
                    <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => {
                        setSelectedStaff(null);
                        setIsStaffModalOpen(true);
                    }}>
                        Thêm mới
                    </Button>
                </Space>
            </div>

            <Card className="shadow-sm rounded-2xl overflow-hidden border-slate-100" styles={{ body: { padding: 0 } }}>
                <div className="p-4 border-b border-slate-100">
                    <Input 
                        placeholder="Tìm kiếm theo Tên hoặc Mã NV..." 
                        prefix={<SearchOutlined className="text-slate-400" />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="max-w-md rounded-lg"
                        size="large"
                    />
                </div>
                <Table 
                    dataSource={filteredData} 
                    columns={columns} 
                    rowKey="id" 
                    loading={loading}
                    pagination={{ defaultPageSize: 10 }}
                />
            </Card>

            <ImportStaffModal 
                open={isImportOpen} 
                onClose={() => setIsImportOpen(false)} 
                onSuccess={() => {
                    setIsImportOpen(false);
                    fetchStaff();
                }} 
            />

            <StaffModal
                open={isStaffModalOpen}
                onClose={() => setIsStaffModalOpen(false)}
                staffData={selectedStaff}
                onSuccess={() => {
                    setIsStaffModalOpen(false);
                    fetchStaff();
                }}
            />
        </div>
    );
}
