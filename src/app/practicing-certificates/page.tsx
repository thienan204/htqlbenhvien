'use client';

import React, { useState, useEffect } from 'react';
import { Table, Card, Space, Tag, Input, Button, Select } from 'antd';
import { SearchOutlined, IdcardOutlined, EditOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import CertificatesModal from '@/app/staff/components/CertificatesModal';

export default function PracticingCertificatesPage() {
    const [certificates, setCertificates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [filterDept, setFilterDept] = useState<string | null>(null);
    
    // Manage CertificatesModal
    const [isCertModalOpen, setIsCertModalOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<{ id: string, ho_ten: string } | null>(null);

    const fetchCertificates = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/practicing-certificates');
            if (res.ok) {
                const data = await res.json();
                setCertificates(data);
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách CCHN', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCertificates();
    }, []);

    const uniqueDepartments = Array.from(new Set(certificates.map(c => c.staff?.department?.ten_khoa || c.staff?.ma_khoa))).filter(Boolean);

    const filteredData = certificates.filter(c => {
        const matchText = (c.so_cchn && c.so_cchn.toLowerCase().includes(searchText.toLowerCase())) ||
                          (c.staff?.ho_ten && c.staff.ho_ten.toLowerCase().includes(searchText.toLowerCase())) ||
                          (c.staff?.ma_nv && c.staff.ma_nv.toLowerCase().includes(searchText.toLowerCase()));
        
        const deptName = c.staff?.department?.ten_khoa || c.staff?.ma_khoa;
        const matchDept = filterDept ? deptName === filterDept : true;
        
        return matchText && matchDept;
    });

    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => index + 1
        },
        {
            title: 'Mã NV',
            dataIndex: ['staff', 'ma_nv'],
            key: 'ma_nv',
            width: 100,
        },
        {
            title: 'Họ và tên',
            dataIndex: ['staff', 'ho_ten'],
            key: 'ho_ten',
            render: (text: string) => <span className="font-semibold text-slate-800">{text}</span>
        },
        {
            title: 'Số CCHN',
            dataIndex: 'so_cchn',
            key: 'so_cchn',
            render: (text: string, record: any) => (
                <Space>
                    <span className="font-medium text-purple-600">{text}</span>
                    {record.isActive && <Tag color="green" icon={<CheckCircleOutlined />}>Đang sử dụng</Tag>}
                </Space>
            )
        },
        {
            title: 'Ngày cấp',
            dataIndex: 'ngay_cap',
            key: 'ngay_cap',
            render: (val: string) => val ? dayjs(val).format('DD/MM/YYYY') : '-'
        },
        {
            title: 'Phạm vi hành nghề',
            dataIndex: 'pham_vi_hanh_nghe',
            key: 'pham_vi_hanh_nghe',
            ellipsis: true
        },
        {
            title: 'Nhóm phân quyền (TT32)',
            dataIndex: ['TT32Category', 'name'],
            key: 'tt32_category',
            render: (text: string) => text ? <Tag color="blue">{text}</Tag> : <span className="text-slate-300 italic">Chưa phân quyền</span>
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 120,
            render: (_: any, record: any) => (
                <Button 
                    size="small" 
                    icon={<EditOutlined />} 
                    onClick={() => {
                        setSelectedStaff({ id: record.staff.id, ho_ten: record.staff.ho_ten });
                        setIsCertModalOpen(true);
                    }}
                >
                    Sửa
                </Button>
            )
        }
    ];

    return (
        <div className="w-full h-full p-6 space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-2xl">
                        <IdcardOutlined />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">Quản lý CCHN</h1>
                        <p className="text-slate-500 m-0">Tra cứu và quản lý chứng chỉ hành nghề của toàn bộ nhân viên.</p>
                    </div>
                </div>
            </div>

            <Card className="shadow-sm rounded-2xl overflow-hidden border-slate-100" styles={{ body: { padding: 0 } }}>
                <div className="p-4 border-b border-slate-100 flex gap-4">
                    <Input 
                        placeholder="Tìm kiếm theo Tên NV, Mã NV hoặc Số CCHN..." 
                        prefix={<SearchOutlined className="text-slate-400" />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="max-w-md rounded-lg"
                        size="large"
                    />
                    <Select
                        placeholder="Lọc Khoa/Phòng"
                        allowClear
                        showSearch
                        size="large"
                        className="min-w-[250px]"
                        value={filterDept}
                        onChange={setFilterDept}
                        options={uniqueDepartments.map(dept => ({ label: String(dept), value: String(dept) }))}
                    />
                </div>
                <Table 
                    dataSource={filteredData} 
                    columns={columns} 
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (total) => `Tổng số ${total} chứng chỉ` }}
                    rowClassName="hover:bg-slate-50/50"
                    size="middle"
                />
            </Card>

            <CertificatesModal
                open={isCertModalOpen}
                onClose={() => setIsCertModalOpen(false)}
                staffId={selectedStaff?.id || null}
                staffName={selectedStaff?.ho_ten || null}
                onSuccess={() => {
                    fetchCertificates();
                }}
            />
        </div>
    );
}
