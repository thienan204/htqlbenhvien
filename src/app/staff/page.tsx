'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Space, Tag, Input, Popconfirm, message, Select } from 'antd';
import { PlusOutlined, UploadOutlined, SearchOutlined, TeamOutlined, DeleteOutlined } from '@ant-design/icons';
import ImportStaffModal from './components/ImportStaffModal';
import StaffModal from './components/StaffModal';
import CertificatesModal from './components/CertificatesModal';
import BulkUpdateStaffModal from './components/BulkUpdateStaffModal';
import StaffDetailsModal from './components/StaffDetailsModal';

export default function StaffPage() {
    const [staffList, setStaffList] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [filterDept, setFilterDept] = useState<string | null>(null);
    const [filterJobTitle, setFilterJobTitle] = useState<string | null>(null);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
    const [isStaffDetailsModalOpen, setIsStaffDetailsModalOpen] = useState(false);
    const [isCertModalOpen, setIsCertModalOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<any>(null);
    const [isGeneratingUsers, setIsGeneratingUsers] = useState(false);
    const [tableParams, setTableParams] = useState({ current: 1, pageSize: 20 });

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

    const handleGenerateUsers = async () => {
        try {
            setIsGeneratingUsers(true);
            const res = await fetch('/api/staff/generate-users', { method: 'POST' });
            if (res.ok) {
                const result = await res.json();
                if (result.count === 0 && result.failed === undefined) {
                    message.info(result.message);
                } else {
                    message.success(result.message);
                }
                fetchStaff();
            } else {
                message.error('Lỗi khi tạo user tự động');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setIsGeneratingUsers(false);
        }
    };

    const handleDeleteAll = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/staff', { method: 'DELETE' });
            if (res.ok) {
                const result = await res.json();
                message.success(`Đã xóa thành công ${result.count} nhân sự.`);
                fetchStaff();
            } else {
                message.error('Xóa toàn bộ thất bại');
            }
        } catch (error) {
            message.error('Lỗi khi xóa toàn bộ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

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
            dataIndex: 'ma_nv',
            key: 'ma_nv',
            render: (text: string) => <span className="font-semibold text-blue-600">{text}</span>
        },
        {
            title: 'Số CCHN',
            key: 'cchn',
            render: (_: any, record: any) => {
                const certs = record.certificates || [];
                const activeCert = certs.find((c: any) => c.isActive) || certs[0];
                return activeCert ? <span className="text-purple-600">{activeCert.so_cchn}</span> : <span className="text-slate-400 italic">-</span>;
            }
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
                <Space>
                    <Button size="small" onClick={() => {
                        setSelectedStaff(record);
                        setIsStaffDetailsModalOpen(true);
                    }}>👁️ Xem</Button>
                    <Button size="small" type="primary" ghost onClick={() => {
                        setSelectedStaff(record);
                        setIsStaffModalOpen(true);
                    }}>Sửa</Button>
                    <Button size="small" onClick={() => {
                        setSelectedStaff(record);
                        setIsCertModalOpen(true);
                    }}>🪪 Quản lý CCHN</Button>
                </Space>
            )
        }
    ];

    const uniqueDepartments = Array.from(new Set(staffList.map(s => s.department?.ten_khoa || s.ma_khoa))).filter(Boolean);
    const uniqueJobTitles = Array.from(new Set(staffList.map(s => s.chuc_danh_ref?.name))).filter(Boolean);

    const filteredData = staffList.filter(s => {
        const matchText = (s.ho_ten && s.ho_ten.toLowerCase().includes(searchText.toLowerCase())) || 
                          (s.ma_nv && s.ma_nv.toLowerCase().includes(searchText.toLowerCase())) ||
                          (s.certificates && s.certificates.some((c: any) => c.so_cchn.toLowerCase().includes(searchText.toLowerCase())));
        const matchDept = filterDept ? (s.department?.ten_khoa === filterDept || s.ma_khoa === filterDept) : true;
        const matchJobTitle = filterJobTitle ? (s.chuc_danh_ref?.name === filterJobTitle) : true;
        return matchText && matchDept && matchJobTitle;
    });

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
                    <Popconfirm 
                        title="Xóa toàn bộ nhân sự?" 
                        description="Hành động này sẽ xóa sạch danh sách nhân sự (không thể hoàn tác). Bạn có chắc không?"
                        onConfirm={handleDeleteAll} 
                        okText="Có, Xóa hết" 
                        cancelText="Không"
                        okButtonProps={{ danger: true }}
                    >
                        <Button danger type="primary" icon={<DeleteOutlined />}>Xóa toàn bộ</Button>
                    </Popconfirm>
                    <Popconfirm
                        title="Tạo User tự động?"
                        description="Hệ thống sẽ tạo tài khoản cho tất cả nhân sự chưa có User. Mật khẩu mặc định là 123456."
                        onConfirm={handleGenerateUsers}
                        okText="Tạo ngay"
                        cancelText="Hủy"
                    >
                        <Button 
                            type="dashed" 
                            className="border-blue-500 text-blue-600 font-medium bg-blue-50 hover:bg-blue-100" 
                            size="large" 
                            icon={<TeamOutlined />}
                            loading={isGeneratingUsers}
                        >
                            Tạo User tự động
                        </Button>
                    </Popconfirm>
                    <Button type="default" size="large" icon={<UploadOutlined />} onClick={() => setIsImportOpen(true)}>
                        Import Nhân sự mới
                    </Button>
                    <Button type="default" size="large" icon={<UploadOutlined />} onClick={() => setIsBulkUpdateOpen(true)}>
                        Cập nhật hàng loạt
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
                <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4">
                    <Input 
                        placeholder="Tìm kiếm theo Tên hoặc Mã NV..." 
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
                        className="min-w-[200px]"
                        value={filterDept}
                        onChange={setFilterDept}
                        options={uniqueDepartments.map(dept => ({ label: String(dept), value: String(dept) }))}
                    />
                    <Select
                        placeholder="Lọc Chức danh"
                        allowClear
                        showSearch
                        size="large"
                        className="min-w-[200px]"
                        value={filterJobTitle}
                        onChange={setFilterJobTitle}
                        options={uniqueJobTitles.map(title => ({ label: String(title), value: String(title) }))}
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
                        pageSizeOptions: ['10', '20', '50', '100'],
                        locale: { items_per_page: '/ Trang' }
                    }}
                    onChange={(pagination) => {
                        setTableParams({
                            current: pagination.current || 1,
                            pageSize: pagination.pageSize || 20,
                        });
                    }}
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

            <BulkUpdateStaffModal
                open={isBulkUpdateOpen}
                onClose={() => setIsBulkUpdateOpen(false)}
                onSuccess={() => {
                    setIsBulkUpdateOpen(false);
                    fetchStaff();
                }}
            />

            <StaffModal
                open={isStaffModalOpen}
                staffData={selectedStaff}
                onClose={() => setIsStaffModalOpen(false)}
                onSuccess={() => {
                    setIsStaffModalOpen(false);
                    fetchStaff();
                }}
            />

            <StaffDetailsModal
                open={isStaffDetailsModalOpen}
                staff={selectedStaff}
                onClose={() => setIsStaffDetailsModalOpen(false)}
            />

            <CertificatesModal
                open={isCertModalOpen}
                staffId={selectedStaff?.id}
                staffName={selectedStaff?.ho_ten}
                onClose={() => setIsCertModalOpen(false)}
                onSuccess={() => {
                    fetchStaff();
                }}
            />
        </div>
    );
}
