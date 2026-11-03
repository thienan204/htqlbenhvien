'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Space, Tag, Input, Popconfirm, message, Select, Dropdown } from 'antd';
import { PlusOutlined, UploadOutlined, SearchOutlined, TeamOutlined, DeleteOutlined, SyncOutlined, DownloadOutlined, CalendarOutlined, ScheduleOutlined } from '@ant-design/icons';
import Link from 'next/link';
import ImportStaffModal from './components/ImportStaffModal';
import StaffModal from './components/StaffModal';
import CertificatesModal from './components/CertificatesModal';
import TrainingModal from './components/TrainingModal';
import StaffWorkHistoryModal from './components/StaffWorkHistoryModal';
import BulkUpdateStaffModal from './components/BulkUpdateStaffModal';
import StaffDetailsModal from './components/StaffDetailsModal';
import TemplateConfigModal from './components/TemplateConfigModal';
import { useAuth } from '@/contexts/AuthContext';
import { SettingOutlined } from '@ant-design/icons';

export default function StaffPage() {
    const [staffList, setStaffList] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [filterDept, setFilterDept] = useState<string | null>(null);
    const [filterJobTitle, setFilterJobTitle] = useState<string | null>(null);
    const [filterDegree, setFilterDegree] = useState<string | null>(null);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
    const [isTemplateConfigOpen, setIsTemplateConfigOpen] = useState(false);
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
    const [isStaffDetailsModalOpen, setIsStaffDetailsModalOpen] = useState(false);
    const [isCertModalOpen, setIsCertModalOpen] = useState(false);
    const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
    const [isWorkHistoryModalOpen, setIsWorkHistoryModalOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<any>(null);
    const [isGeneratingUsers, setIsGeneratingUsers] = useState(false);
    const [tableParams, setTableParams] = useState({ current: 1, pageSize: 20 });
    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const { user } = useAuth();

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const basePath = window.location.pathname.split('/staff')[0];
                const res = await fetch(`${basePath}/api/staff/reports`);
                if (res.ok) {
                    const data = await res.json();
                    setReports(data);
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchReports();
    }, []);

    const handleSyncMau02 = async () => {
        try {
            setIsSyncing(true);
            const res = await fetch('/api/staff/sync-mau02', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staffIds: selectedRowKeys })
            });
            if (res.ok) {
                const result = await res.json();
                message.success(`Đã đồng bộ thành công ${result.count} nhân sự sang Mẫu 02!`);
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(err.error || 'Đồng bộ thất bại');
            }
        } catch (error) {
            message.error('Lỗi kết nối khi đồng bộ');
        } finally {
            setIsSyncing(false);
        }
    };

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
                <Space wrap size="small">
                    <Button size="small" onClick={() => {
                        setSelectedStaff(record);
                        setIsStaffDetailsModalOpen(true);
                    }}>👁️ Xem</Button>
                    <Button size="small" type="primary" ghost onClick={() => {
                        setSelectedStaff(record);
                        setIsStaffModalOpen(true);
                    }}>Sửa</Button>
                    <Button size="small" className="text-emerald-600 border-emerald-600 hover:bg-emerald-50" onClick={() => {
                        setSelectedStaff(record);
                        setIsWorkHistoryModalOpen(true);
                    }}>🏢 Lịch sử khoa</Button>
                    <Button size="small" onClick={() => {
                        setSelectedStaff(record);
                        setIsCertModalOpen(true);
                    }}>🪪 Quản lý CCHN</Button>
                    <Button size="small" className="text-amber-600 border-amber-600 hover:bg-amber-50" onClick={() => {
                        setSelectedStaff(record);
                        setIsTrainingModalOpen(true);
                    }}>🎓 Đào tạo</Button>
                </Space>
            )
        }
    ];

    const uniqueDepartments = Array.from(new Set(staffList.map(s => s.department?.ten_khoa || s.ma_khoa))).filter(Boolean);
    const uniqueJobTitles = Array.from(new Set(staffList.map(s => s.chuc_danh_ref?.name))).filter(Boolean);
    const uniqueDegrees = Array.from(new Set(staffList.map(s => s.trinh_do_ref?.name))).filter(Boolean);

    // Normalize vietnamese string for better search
    const normalizeString = (str: string) => {
        if (!str) return '';
        return str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "D")
            .toLowerCase();
    };

    // Get initials (e.g. "Lê Thị Phượng" -> "ltp")
    const getInitials = (str: string) => {
        if (!str) return '';
        const normalized = normalizeString(str);
        return normalized.replace(/[^a-z0-9\s]/gi, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('');
    };

    const filteredData = staffList.filter(s => {
        const searchInput = normalizeString(searchText);
        const matchText = (s.ho_ten && normalizeString(s.ho_ten).includes(searchInput)) || 
                          (s.ho_ten && getInitials(s.ho_ten).includes(searchInput)) ||
                          (s.ma_nv && s.ma_nv.toLowerCase().includes(searchText.toLowerCase())) ||
                          (s.certificates && s.certificates.some((c: any) => c.so_cchn.toLowerCase().includes(searchText.toLowerCase())));
        const matchDept = filterDept ? (s.department?.ten_khoa === filterDept || s.ma_khoa === filterDept) : true;
        const matchJobTitle = filterJobTitle ? (s.chuc_danh_ref?.name === filterJobTitle) : true;
        const matchDegree = filterDegree ? (s.trinh_do_ref?.name === filterDegree) : true;
        return matchText && matchDept && matchJobTitle && matchDegree;
    });

    return (
        <div className="w-full h-full p-6 space-y-6">
            {/* Header Card 2 Hàng (Row 1: Tiêu đề + Nút chính | Row 2: Thanh công cụ tác vụ nhóm) */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
                {/* HÀNG 1: Tiêu đề trang + Nhóm nút chính */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center text-2xl shadow-xs">
                            <TeamOutlined />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-2xl font-bold text-slate-800 m-0">Quản lý Nhân sự</h1>
                                <Tag color="blue" className="font-semibold text-xs rounded-full px-2.5">
                                    {filteredData.length} / {staffList.length} Cán bộ
                                </Tag>
                            </div>
                            <p className="text-slate-500 text-xs sm:text-sm m-0 mt-0.5">
                                Tra cứu hồ sơ, chức danh, bằng cấp, khoa phòng và chứng chỉ hành nghề (CCHN).
                            </p>
                        </div>
                    </div>

                    {/* Nút hành động chính ở góc trên */}
                    <div className="flex items-center gap-2.5">
                        <Space.Compact>
                            <Dropdown
                                menu={{
                                    items: reports.length > 0 ? reports.map(r => ({
                                        key: r.id,
                                        label: r.name,
                                        onClick: () => {
                                            const basePath = window.location.pathname.split('/staff')[0];
                                            const url = new URL(`${basePath}/api/staff/reports/${r.id}/export`, window.location.origin);
                                            if (searchText) url.searchParams.append('search', searchText);
                                            window.open(url.toString(), '_blank');
                                        }
                                    })) : [{ key: 'empty', label: 'Chưa có mẫu báo cáo nào', disabled: true }]
                                }}
                                placement="bottomRight"
                            >
                                <Button 
                                    type="default" 
                                    size="middle"
                                    icon={<DownloadOutlined />} 
                                    className="text-green-700 border-green-600 hover:bg-green-50 font-medium"
                                >
                                    Xuất Báo Cáo
                                </Button>
                            </Dropdown>
                            {user?.role === 'ADMIN' && (
                                <Button
                                    type="default"
                                    size="middle"
                                    className="text-slate-500 border-green-600 hover:text-green-600"
                                    icon={<SettingOutlined />}
                                    onClick={() => window.location.href = window.location.pathname.split('/staff')[0] + '/staff/reports'}
                                    title="Quản lý Mẫu Báo cáo"
                                />
                            )}
                        </Space.Compact>

                        {(user?.role === 'ADMIN' || user?.role === 'PTCCB') && (
                            <Button 
                                type="primary" 
                                size="middle"
                                icon={<PlusOutlined />} 
                                onClick={() => {
                                    setSelectedStaff(null);
                                    setIsStaffModalOpen(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-500 font-semibold shadow-xs"
                            >
                                Thêm mới
                            </Button>
                        )}
                    </div>
                </div>

                {/* HÀNG 2: Thanh công cụ Toolbar chuyên biệt (Phân nhóm chức năng khoa học) */}
                {(user?.role === 'ADMIN' || user?.role === 'PTCCB') && (
                    <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-3">
                        {/* Nhóm 1: Chấm công & Lịch làm việc */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
                                Chấm công:
                            </span>
                            <Link href="/staff/attendance">
                                <Button 
                                    type="primary" 
                                    icon={<CalendarOutlined />} 
                                    className="bg-indigo-600 hover:bg-indigo-500 font-semibold"
                                >
                                    Bảng Chấm Công & Trực
                                </Button>
                            </Link>
                            <Link href="/staff/my-attendance">
                                <Button 
                                    icon={<ScheduleOutlined />} 
                                    className="text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-medium"
                                >
                                    Lịch Của Tôi
                                </Button>
                            </Link>
                        </div>

                        {/* Nhóm 2: Nhập xuất & Quản trị TCCB */}
                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="default" icon={<UploadOutlined />} onClick={() => setIsImportOpen(true)}>
                                Import Nhân sự
                            </Button>
                            <Button type="default" icon={<SyncOutlined />} onClick={() => setIsBulkUpdateOpen(true)}>
                                Cập nhật hàng loạt
                            </Button>
                            <Popconfirm
                                title="Đồng bộ sang Mẫu 02 XML?"
                                description={selectedRowKeys.length > 0 
                                    ? `Bạn đang chọn ${selectedRowKeys.length} nhân sự. Hệ thống sẽ XÓA SẠCH Mẫu 02 cũ và CHỈ ĐỒNG BỘ ${selectedRowKeys.length} người này. Bạn chắc chắn chứ?` 
                                    : "Bạn chưa chọn ai. Hệ thống sẽ XÓA SẠCH Mẫu 02 cũ và ĐỒNG BỘ TOÀN BỘ nhân sự. Bạn chắc chắn chứ?"}
                                onConfirm={handleSyncMau02}
                                okText="Đồng bộ"
                                cancelText="Hủy"
                                okButtonProps={{ danger: true }}
                            >
                                <Button 
                                    className="text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100 font-medium" 
                                    icon={<SyncOutlined />}
                                    loading={isSyncing}
                                >
                                    Đồng bộ Mẫu 02 {selectedRowKeys.length > 0 ? `(${selectedRowKeys.length})` : ''}
                                </Button>
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
                                    className="border-blue-400 text-blue-600 font-medium bg-blue-50/50 hover:bg-blue-100" 
                                    icon={<TeamOutlined />}
                                    loading={isGeneratingUsers}
                                >
                                    Tạo User tự động
                                </Button>
                            </Popconfirm>

                            {user?.role === 'ADMIN' && (
                                <Popconfirm 
                                    title="Xóa toàn bộ nhân sự?" 
                                    description="Hành động này sẽ xóa sạch danh sách nhân sự (không thể hoàn tác). Bạn có chắc không?"
                                    onConfirm={handleDeleteAll} 
                                    okText="Có, Xóa hết" 
                                    cancelText="Không"
                                    okButtonProps={{ danger: true }}
                                >
                                    <Button danger type="text" icon={<DeleteOutlined />} className="hover:bg-rose-50 text-rose-600">
                                        Xóa tất cả
                                    </Button>
                                </Popconfirm>
                            )}
                        </div>
                    </div>
                )}
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
                        filterOption={(input, option) => {
                            const rawLabel = option?.label as string ?? '';
                            const optionLabel = normalizeString(rawLabel);
                            const searchInput = normalizeString(input);
                            const initials = getInitials(rawLabel);
                            return optionLabel.includes(searchInput) || initials.includes(searchInput);
                        }}
                    />
                    <Select
                        placeholder="Lọc Chức danh"
                        allowClear
                        showSearch
                        size="large"
                        className="min-w-[200px]"
                        value={filterJobTitle}
                        onChange={setFilterJobTitle}
                        options={uniqueJobTitles.map(jt => ({ label: String(jt), value: String(jt) }))}
                        filterOption={(input, option) => {
                            const rawLabel = option?.label as string ?? '';
                            const optionLabel = normalizeString(rawLabel);
                            const searchInput = normalizeString(input);
                            const initials = getInitials(rawLabel);
                            return optionLabel.includes(searchInput) || initials.includes(searchInput);
                        }}
                    />
                    <Select
                        placeholder="Lọc Trình độ"
                        allowClear
                        showSearch
                        size="large"
                        className="min-w-[200px]"
                        value={filterDegree}
                        onChange={setFilterDegree}
                        options={uniqueDegrees.map(deg => ({ label: String(deg), value: String(deg) }))}
                        filterOption={(input, option) => {
                            const rawLabel = option?.label as string ?? '';
                            const optionLabel = normalizeString(rawLabel);
                            const searchInput = normalizeString(input);
                            const initials = getInitials(rawLabel);
                            return optionLabel.includes(searchInput) || initials.includes(searchInput);
                        }}
                    />
                </div>
                <Table 
                    rowSelection={{
                        selectedRowKeys,
                        onChange: (newSelectedRowKeys: React.Key[]) => {
                            setSelectedRowKeys(newSelectedRowKeys);
                        }
                    }}
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
                onSuccess={fetchStaff}
            />

            <TemplateConfigModal
                open={isTemplateConfigOpen}
                onClose={() => setIsTemplateConfigOpen(false)}
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

            <TrainingModal
                open={isTrainingModalOpen}
                staffId={selectedStaff?.id}
                staffName={selectedStaff?.ho_ten}
                onClose={() => setIsTrainingModalOpen(false)}
            />

            <StaffWorkHistoryModal
                open={isWorkHistoryModalOpen}
                staffId={selectedStaff?.id}
                staffName={selectedStaff?.ho_ten}
                currentDeptName={selectedStaff?.department?.ten_khoa || selectedStaff?.ma_khoa}
                onClose={() => setIsWorkHistoryModalOpen(false)}
                onSuccess={() => {
                    fetchStaff();
                }}
            />
        </div>
    );
}
