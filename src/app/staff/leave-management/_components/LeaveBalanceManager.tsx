'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Input, Select, Popconfirm, message, Tooltip, Card, Row, Col, Statistic } from 'antd';
import { 
    SyncOutlined, 
    EditOutlined, 
    SearchOutlined, 
    DownloadOutlined, 
    CalendarOutlined, 
    CheckCircleOutlined, 
    TeamOutlined, 
    PieChartOutlined 
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { EditLeaveBalanceModal } from './EditLeaveBalanceModal';

interface LeaveBalanceManagerProps {
    departments: any[];
}

export const LeaveBalanceManager: React.FC<LeaveBalanceManagerProps> = ({
    departments
}) => {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedDept, setSelectedDept] = useState<string>('ALL');
    const [searchText, setSearchText] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [syncing, setSyncing] = useState<boolean>(false);

    const [balances, setBalances] = useState<any[]>([]);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

    // Tải danh sách quỹ phép
    const fetchBalances = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                year: String(selectedYear),
                ...(selectedDept !== 'ALL' ? { ma_khoa: selectedDept } : {}),
                ...(searchText ? { search: searchText } : {})
            });

            const res = await fetch(`/api/staff/leave-management/balances?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setBalances(data.balances || []);
            } else {
                message.error(data.error || 'Lỗi tải danh sách quỹ phép');
            }
        } catch (err) {
            console.error('Lỗi fetch balances:', err);
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBalances();
    }, [selectedYear, selectedDept]);

    const handleSearch = () => {
        fetchBalances();
    };

    // Đồng bộ từ Bảng Chấm Công
    const handleSyncFromAttendance = async () => {
        try {
            setSyncing(true);
            const res = await fetch('/api/staff/leave-management/sync-attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    year: selectedYear,
                    ma_khoa: selectedDept !== 'ALL' ? selectedDept : undefined
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                message.success(data.message, 6);
                fetchBalances();
            } else {
                message.error(data.error || 'Đồng bộ chấm công thất bại');
            }
        } catch (err) {
            console.error('Lỗi đồng bộ chấm công:', err);
            message.error('Lỗi khi gọi API đồng bộ');
        } finally {
            setSyncing(false);
        }
    };

    // Xuất Excel
    const handleExportExcel = () => {
        if (balances.length === 0) {
            message.warning('Không có dữ liệu để xuất Excel');
            return;
        }

        const excelData = balances.map((item, idx) => ({
            'STT': idx + 1,
            'Mã NV': item.staff?.ma_nv || '',
            'Họ và tên': item.staff?.ho_ten || '',
            'Khoa / Phòng': item.staff?.ten_khoa || item.staff?.ma_khoa || '',
            'Chức vụ': item.staff?.chuc_vu || '',
            'Năm': item.year,
            'Phép tiêu chuẩn': item.standardDays || 12,
            'Thâm niên': item.seniorityDays || 0,
            'Năm trước chuyển sang': item.transferredDays || 0,
            'Tổng ngày được nghỉ': item.totalAvailable || 12,
            'Số ngày ĐÃ NGHỈ': item.usedDays || 0,
            'Số ngày CÒN LẠI': item.remainingDays || 0,
            'Ghi chú': item.note || ''
        }));

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `QuyPhepNam_${selectedYear}`);
        XLSX.writeFile(wb, `Quy_Phep_Nam_${selectedYear}_BVDKLS.xlsx`);
        message.success(`Đã xuất file Excel Quỹ Phép Năm ${selectedYear}!`);
    };

    // Mở modal sửa
    const handleOpenEdit = (record: any) => {
        setEditingRecord(record);
        setIsEditModalOpen(true);
    };

    // Tính tổng thống kê
    const totalStaffCount = balances.length;
    const totalAvailableDays = balances.reduce((sum, b) => sum + (Number(b.totalAvailable) || 0), 0);
    const totalUsedDays = balances.reduce((sum, b) => sum + (Number(b.usedDays) || 0), 0);
    const totalRemainingDays = balances.reduce((sum, b) => sum + (Number(b.remainingDays) || 0), 0);

    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 55,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => index + 1
        },
        {
            title: 'Mã NV',
            key: 'ma_nv',
            width: 95,
            render: (_: any, r: any) => <span className="font-mono font-bold text-blue-700">{r.staff?.ma_nv}</span>
        },
        {
            title: 'Họ và Tên',
            key: 'ho_ten',
            width: 170,
            render: (_: any, r: any) => (
                <div>
                    <div className="font-semibold text-slate-800">{r.staff?.ho_ten}</div>
                    <div className="text-[11px] text-slate-500">{r.staff?.chuc_vu}</div>
                </div>
            )
        },
        {
            title: 'Khoa / Phòng',
            key: 'khoa',
            width: 170,
            render: (_: any, r: any) => <span className="text-slate-700">{r.staff?.ten_khoa || r.staff?.ma_khoa}</span>
        },
        {
            title: 'Tiêu Chuẩn',
            dataIndex: 'standardDays',
            key: 'standardDays',
            width: 85,
            align: 'center' as const,
            render: (v: number) => <span>{v ?? 12}</span>
        },
        {
            title: 'Thâm Niên',
            dataIndex: 'seniorityDays',
            key: 'seniorityDays',
            width: 85,
            align: 'center' as const,
            render: (v: number) => <span className="text-purple-700 font-medium">+{v ?? 0}</span>
        },
        {
            title: 'Chuyển Sang',
            dataIndex: 'transferredDays',
            key: 'transferredDays',
            width: 95,
            align: 'center' as const,
            render: (v: number) => <span className="text-indigo-600 font-medium">{v ?? 0}</span>
        },
        {
            title: 'TỔNG ĐƯỢC NGHỈ',
            dataIndex: 'totalAvailable',
            key: 'totalAvailable',
            width: 120,
            align: 'center' as const,
            render: (v: number) => <span className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{v} ngày</span>
        },
        {
            title: 'ĐÃ NGHỈ',
            dataIndex: 'usedDays',
            key: 'usedDays',
            width: 100,
            align: 'center' as const,
            render: (v: number) => (
                <Tag color={v > 0 ? 'orange' : 'default'} className="font-bold text-xs px-2 py-0.5">
                    {v ?? 0} ngày
                </Tag>
            )
        },
        {
            title: 'CÒN LẠI',
            dataIndex: 'remainingDays',
            key: 'remainingDays',
            width: 105,
            align: 'center' as const,
            render: (v: number) => {
                const isZero = (v ?? 0) <= 0;
                return (
                    <Tag color={isZero ? 'default' : 'success'} className="font-bold text-xs px-2 py-0.5">
                        {v ?? 0} ngày
                    </Tag>
                );
            }
        },
        {
            title: 'Ghi Chú',
            dataIndex: 'note',
            key: 'note',
            ellipsis: true,
            render: (text: string) => <span className="text-xs text-slate-500 italic">{text || '-'}</span>
        },
        {
            title: 'Thao Tác',
            key: 'actions',
            width: 90,
            align: 'center' as const,
            render: (_: any, r: any) => (
                <Tooltip title="Chỉnh sửa số ngày phép đã nghỉ & còn lại">
                    <Button
                        size="small"
                        type="primary"
                        ghost
                        icon={<EditOutlined />}
                        onClick={() => handleOpenEdit(r)}
                        className="text-xs"
                    >
                        Sửa
                    </Button>
                </Tooltip>
            )
        }
    ];

    return (
        <div className="space-y-4">
            {/* Hàng 1: Thẻ KPI Tổng Quát */}
            <Row gutter={[12, 12]}>
                <Col xs={12} sm={6}>
                    <Card size="small" className="border-slate-200 shadow-2xs">
                        <Statistic
                            title={<span className="text-xs font-semibold text-slate-500">Tổng Cán Bộ</span>}
                            value={totalStaffCount}
                            suffix="người"
                            prefix={<TeamOutlined className="text-blue-500" />}
                            valueStyle={{ fontSize: '1.25rem', fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" className="border-slate-200 shadow-2xs">
                        <Statistic
                            title={<span className="text-xs font-semibold text-slate-500">Tổng Quỹ Phép Năm {selectedYear}</span>}
                            value={totalAvailableDays}
                            suffix="ngày"
                            prefix={<CalendarOutlined className="text-indigo-500" />}
                            valueStyle={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1d4ed8' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" className="border-slate-200 shadow-2xs">
                        <Statistic
                            title={<span className="text-xs font-semibold text-slate-500">Số Ngày Đã Nghỉ Thực Tế</span>}
                            value={totalUsedDays}
                            suffix="ngày"
                            prefix={<PieChartOutlined className="text-amber-500" />}
                            valueStyle={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#b45309' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" className="border-slate-200 shadow-2xs">
                        <Statistic
                            title={<span className="text-xs font-semibold text-slate-500">Số Ngày Phép Còn Lại</span>}
                            value={totalRemainingDays}
                            suffix="ngày"
                            prefix={<CheckCircleOutlined className="text-emerald-500" />}
                            valueStyle={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#047857' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Hàng 2: Thanh Công Cụ Bộ Lọc & Các Nút Tác Vụ */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Chọn Năm Quản Lý Phép */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-600">Năm Phép:</span>
                        <Select
                            value={selectedYear}
                            onChange={setSelectedYear}
                            className="w-28 font-bold text-blue-700"
                            options={[
                                { value: 2024, label: 'Năm 2024' },
                                { value: 2025, label: 'Năm 2025' },
                                { value: 2026, label: 'Năm 2026' },
                                { value: 2027, label: 'Năm 2027' },
                                { value: 2028, label: 'Năm 2028' }
                            ]}
                        />
                    </div>

                    {/* Lọc Khoa/Phòng */}
                    <Select
                        showSearch
                        value={selectedDept}
                        onChange={setSelectedDept}
                        className="w-56"
                        placeholder="Lọc theo Khoa / Phòng"
                        options={[
                            { value: 'ALL', label: '--- Toàn Bộ Bệnh Viện ---' },
                            ...(departments || []).map(d => ({
                                value: d.ma_khoa,
                                label: d.ten_khoa
                            }))
                        ]}
                    />

                    {/* Ô Tìm Kiếm Tên / Mã NV */}
                    <Space.Compact className="w-64">
                        <Input
                            placeholder="Tìm theo Tên hoặc Mã NV..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onPressEnter={handleSearch}
                            allowClear
                        />
                        <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                            Tìm
                        </Button>
                    </Space.Compact>
                </div>

                {/* Các nút Tác vụ */}
                <div className="flex items-center gap-2">
                    {/* NÚT QUAN TRỌNG: Đồng bộ từ Bảng Chấm Công */}
                    <Popconfirm
                        title={`Đồng bộ số ngày nghỉ phép từ Bảng Chấm Công năm ${selectedYear}?`}
                        description={
                            <div className="max-w-xs text-xs py-1 text-slate-600 space-y-1">
                                <div>• Hệ thống sẽ quét toàn bộ ký hiệu <b>P</b> (1 ngày) và <b>P/2</b> (0.5 ngày) trên Bảng Chấm Công năm {selectedYear}.</div>
                                <div>• Tự động cập nhật vào <b>Số ngày đã nghỉ</b> và tính lại <b>Số ngày phép còn lại</b> cho nhân sự.</div>
                            </div>
                        }
                        onConfirm={handleSyncFromAttendance}
                        okText="Đồng Bộ Ngay"
                        cancelText="Hủy"
                        okButtonProps={{ loading: syncing }}
                    >
                        <Button
                            type="primary"
                            icon={<SyncOutlined spin={syncing} />}
                            loading={syncing}
                            className="bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs shadow-xs"
                        >
                            🔄 Đồng Bộ Từ Bảng Chấm Công
                        </Button>
                    </Popconfirm>

                    {/* Nút Xuất Excel */}
                    <Button
                        icon={<DownloadOutlined />}
                        onClick={handleExportExcel}
                        className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-xs font-medium"
                    >
                        Xuất Excel
                    </Button>
                </div>
            </div>

            {/* Bảng Danh Sách Quỹ Phép */}
            <Table
                columns={columns}
                dataSource={balances}
                rowKey="id"
                loading={loading}
                size="small"
                bordered
                pagination={{
                    pageSize: 15,
                    showSizeChanger: true,
                    pageSizeOptions: ['15', '30', '50', '100'],
                    showTotal: (total) => `Tổng cộng: ${total} cán bộ`
                }}
            />

            {/* Modal Điều Chỉnh Số Dư Ngày Phép */}
            <EditLeaveBalanceModal
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={fetchBalances}
                recordData={editingRecord}
                year={selectedYear}
            />
        </div>
    );
};

