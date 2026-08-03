'use client';

import React, { useState, useEffect } from 'react';
import { Table, Card, Space, Tag, Input, Button, Select } from 'antd';
import { SearchOutlined, EditOutlined, BookOutlined } from '@ant-design/icons';
import TrainingModal from '@/app/staff/components/TrainingModal';

export default function StaffTrainingPage() {
    const [trainings, setTrainings] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [filterDept, setFilterDept] = useState<string | null>(null);
    
    // Manage TrainingModal
    const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<{ id: string, ho_ten: string } | null>(null);
    const [tableParams, setTableParams] = useState({ current: 1, pageSize: 15 });

    const fetchTrainings = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/staff-training');
            if (res.ok) {
                const data = await res.json();
                setTrainings(data);
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách đào tạo', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrainings();
    }, []);

    const uniqueDepartments = Array.from(new Set(trainings.map(t => t.staff?.department?.ten_khoa || t.staff?.ma_khoa))).filter(Boolean);

    const filteredData = trainings.filter(t => {
        const matchText = (t.name && t.name.toLowerCase().includes(searchText.toLowerCase())) ||
                          (t.staff?.ho_ten && t.staff.ho_ten.toLowerCase().includes(searchText.toLowerCase())) ||
                          (t.staff?.ma_nv && t.staff.ma_nv.toLowerCase().includes(searchText.toLowerCase()));
        
        const deptName = t.staff?.department?.ten_khoa || t.staff?.ma_khoa;
        const matchDept = filterDept ? deptName === filterDept : true;
        
        return matchText && matchDept;
    });

    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => (tableParams.current - 1) * tableParams.pageSize + index + 1
        },
        {
            title: 'Mã NV',
            dataIndex: ['staff', 'ma_nv'],
            key: 'ma_nv',
            width: 100,
            render: (text: string) => <span className="font-semibold text-blue-600">{text}</span>
        },
        {
            title: 'Họ và tên',
            dataIndex: ['staff', 'ho_ten'],
            key: 'ho_ten',
            render: (text: string) => <span className="font-medium text-slate-800">{text}</span>
        },
        {
            title: 'Khoa / Phòng',
            key: 'khoa',
            render: (_: any, record: any) => record.staff?.department ? record.staff.department.ten_khoa : record.staff?.ma_khoa
        },
        {
            title: 'Tên chứng chỉ / Khóa học',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <span className="font-medium text-amber-600">{text}</span>
        },
        {
            title: 'Loại hình',
            dataIndex: ['trainingType', 'name'],
            key: 'training_type',
            render: (text: string) => text ? <Tag color="blue">{text}</Tag> : '-'
        },
        {
            title: 'Nơi đào tạo',
            dataIndex: 'institution',
            key: 'institution',
        },
        {
            title: 'Năm TN',
            dataIndex: 'graduationYear',
            key: 'graduationYear',
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => (
                <Button 
                    size="small" 
                    icon={<EditOutlined />} 
                    onClick={() => {
                        setSelectedStaff({ id: record.staff.id, ho_ten: record.staff.ho_ten });
                        setIsTrainingModalOpen(true);
                    }}
                >
                    Chi tiết
                </Button>
            )
        }
    ];

    return (
        <div className="w-full h-full p-6 space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-2xl">
                        <BookOutlined />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">Quản lý Đào tạo</h1>
                        <p className="text-slate-500 m-0">Tra cứu chứng chỉ, bằng cấp và khóa học của toàn bộ nhân viên.</p>
                    </div>
                </div>
            </div>

            <Card variant="borderless" className="shadow-sm rounded-2xl">
                <div className="flex flex-wrap gap-4 mb-6">
                    <Input 
                        placeholder="Tìm theo Mã NV, Tên NV, Tên chứng chỉ..." 
                        prefix={<SearchOutlined className="text-slate-400" />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        className="max-w-md"
                        size="large"
                        allowClear
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
                    pagination={{ 
                        current: tableParams.current,
                        pageSize: tableParams.pageSize,
                        showSizeChanger: true,
                        pageSizeOptions: ['15', '30', '50', '100'],
                    }}
                    onChange={(pagination) => {
                        setTableParams({
                            current: pagination.current || 1,
                            pageSize: pagination.pageSize || 15,
                        });
                    }}
                />
            </Card>

            <TrainingModal
                open={isTrainingModalOpen}
                staffId={selectedStaff?.id || null}
                staffName={selectedStaff?.ho_ten || null}
                onClose={() => {
                    setIsTrainingModalOpen(false);
                    fetchTrainings();
                }}
            />
        </div>
    );
}
