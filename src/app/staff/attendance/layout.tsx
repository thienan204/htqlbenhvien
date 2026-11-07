'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Card, Tabs, Select, DatePicker, Input, Button, Tag, Dropdown, Tooltip, Alert, Popconfirm, message } from 'antd';
import {
    ScheduleOutlined,
    CalendarOutlined,
    ClockCircleOutlined,
    SwapOutlined,
    SearchOutlined,
    ReloadOutlined,
    DownloadOutlined,
    ThunderboltOutlined,
    LockOutlined,
    UserOutlined,
    InfoCircleOutlined,
    FileExcelOutlined,
    FileTextOutlined,
    SettingOutlined
} from '@ant-design/icons';
import { AttendanceProvider, useAttendance } from './AttendanceContext';
import { NoteEditModal } from './_components/NoteEditModal';
import { HospitalAttendanceConfigModal } from './_components/HospitalAttendanceConfigModal';
import { useAuth } from '@/contexts/AuthContext';

const AttendanceLayoutInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuth();
    const {
        selectedDate,
        setSelectedDate,
        selectedDept,
        setSelectedDept,
        searchText,
        setSearchText,
        loading,
        matrixData,
        canEditCurrentDept,
        fetchData,
        showGuide,
        setShowGuide
    } = useAttendance();

    const [hospitalConfigOpen, setHospitalConfigOpen] = React.useState(false);

    // Xác định tab đang active dựa theo URL
    const activeKey = React.useMemo(() => {
        if (pathname.includes('/duty')) return 'CHAM_TRUC';
        if (pathname.includes('/compensatory')) return 'SO_NGHI_BU';
        if (pathname.includes('/overtime')) return 'CHAM_THEM_GIO';
        return 'CHAM_CONG';
    }, [pathname]);

    const canManageAllDepts = user?.role === 'ADMIN' || !user?.ma_khoa;

    // Chuyển tab liên kết URL
    const handleTabChange = (key: string) => {
        if (key === 'CHAM_CONG') router.push('/staff/attendance');
        else if (key === 'CHAM_TRUC') router.push('/staff/attendance/duty');
        else if (key === 'SO_NGHI_BU') router.push('/staff/attendance/compensatory');
        else if (key === 'CHAM_THEM_GIO') router.push('/staff/attendance/overtime');
    };

    const getBasePath = () => {
        if (typeof window !== 'undefined') {
            const parts = window.location.pathname.split('/staff');
            return parts.length > 1 ? parts[0] : '';
        }
        return '';
    };

    // Xuất Excel
    const handleExportExcel = (type: 'CHAM_CONG' | 'CHAM_TRUC' | 'TRUC_KEM' | 'TRUC_THUONG_TRU' | 'CHAM_THEM_GIO') => {
        const basePath = getBasePath();
        const monthYear = selectedDate.format('YYYY-MM');
        window.open(`${basePath}/api/staff/attendance/export-excel?monthYear=${monthYear}&ma_khoa=${selectedDept}&type=${type}`, '_blank');
    };

    const exportMenuItems = [
        {
            key: 'export_cong',
            label: '1. Xuất Bảng Chấm Công Chuẩn Mẫu',
            icon: <FileExcelOutlined className="text-emerald-600" />,
            onClick: () => handleExportExcel('CHAM_CONG')
        },
        {
            key: 'export_truc',
            label: '2. Xuất Bảng Chấm Trực (Ngày thường, T7/CN, Lễ tết)',
            icon: <FileExcelOutlined className="text-blue-600" />,
            onClick: () => handleExportExcel('CHAM_TRUC')
        },
        {
            key: 'export_truc_kem',
            label: '3. Xuất Bảng Trực Kèm (Tk)',
            icon: <FileExcelOutlined className="text-teal-600" />,
            onClick: () => handleExportExcel('TRUC_KEM')
        },
        {
            key: 'export_truc_thuong_tru',
            label: '4. Xuất Bảng Trực Thường Trú (TT)',
            icon: <FileExcelOutlined className="text-indigo-600" />,
            onClick: () => handleExportExcel('TRUC_THUONG_TRU')
        },
        {
            key: 'export_them_gio',
            label: '5. Xuất Bảng Chấm Thêm Giờ',
            icon: <FileExcelOutlined className="text-amber-600" />,
            onClick: () => handleExportExcel('CHAM_THEM_GIO')
        }
    ];

    // Chấm nhanh cả khoa
    const handleBulkSelectedDate = async () => {
        try {
            const basePath = getBasePath();
            const dateStr = selectedDate.format('YYYY-MM-DD');
            const res = await fetch(`${basePath}/api/staff/attendance/bulk-daily`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ma_khoa: selectedDept,
                    date: dateStr,
                    code: '+'
                })
            });
            if (!res.ok) {
                try {
                    const errData = await res.json();
                    message.error(errData.error || 'Chấm nhanh thất bại');
                } catch {
                    message.error('Lỗi máy chủ khi chấm nhanh');
                }
                return;
            }
            const data = await res.json();
            if (data.success) {
                message.success(data.message || 'Đã chấm nhanh thành công');
                fetchData();
            } else {
                message.error(data.error || 'Chấm nhanh thất bại');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi chấm nhanh');
        }
    };

    // Khởi tạo cả tháng
    const handleInitMonth = async () => {
        try {
            const basePath = getBasePath();
            const monthYear = selectedDate.format('YYYY-MM');
            const res = await fetch(`${basePath}/api/staff/attendance/init-month`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ma_khoa: selectedDept,
                    monthYear,
                    code: '+'
                })
            });
            if (!res.ok) {
                try {
                    const errData = await res.json();
                    message.error(errData.error || 'Khởi tạo thất bại');
                } catch {
                    message.error('Lỗi máy chủ khi khởi tạo');
                }
                return;
            }
            const data = await res.json();
            if (data.success) {
                message.success(data.message || 'Khởi tạo công cả tháng thành công');
                fetchData();
            } else {
                message.error(data.error || 'Khởi tạo thất bại');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi khởi tạo');
        }
    };

    // Thông tin ngày đang chọn từ ma trận (đã tính đến ngày nghỉ lễ & ngày làm bù toàn viện)
    const selectedDayInfo = React.useMemo(() => {
        const dateStr = selectedDate.format('YYYY-MM-DD');
        return matrixData?.daysInfo?.find((d) => d.dateStr === dateStr);
    }, [matrixData?.daysInfo, selectedDate]);

    // Ngày cuối tuần bị khóa (nếu là ngày làm bù đã cấu hình thì không bị khóa)
    const isSelectedWeekend = React.useMemo(() => {
        if (selectedDayInfo) {
            return !!selectedDayInfo.isWeekend;
        }
        return selectedDate.day() === 0 || selectedDate.day() === 6;
    }, [selectedDayInfo, selectedDate]);

    return (
        <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
            {/* Header Màn hình */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4">
                {/* HÀNG 1: Tiêu đề + Các nút tiện ích */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <ScheduleOutlined className="text-blue-600 text-2xl shrink-0" />
                        <h1 className="text-base md:text-lg lg:text-xl font-bold text-slate-800 m-0 truncate">
                            Quản Lý Chấm Công, Chấm Trực, Trực Kèm, Thêm Giờ: {matrixData?.ten_khoa || 'Khoa / Phòng'}
                        </h1>
                        <Tag color="cyan" className="font-mono font-bold shrink-0">Mã: {selectedDept}</Tag>
                        {canEditCurrentDept ? (
                            <Tag color="success" className="font-medium shrink-0">🟢 Có quyền chấm công</Tag>
                        ) : (
                            <Tag color="default" className="font-medium shrink-0">👁️ Chế độ chỉ xem</Tag>
                        )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {canManageAllDepts && (
                            <Button
                                icon={<SettingOutlined className="text-purple-600" />}
                                size="small"
                                onClick={() => setHospitalConfigOpen(true)}
                                className="border-purple-300 text-purple-700 hover:bg-purple-50 font-medium"
                                title="Cấu hình ngày nghỉ lễ, ngày làm bù, khung giờ chấm công toàn viện"
                            >
                                ⚙️ Cấu Hình Toàn Viện
                            </Button>
                        )}
                        <Button
                            type="text"
                            size="small"
                            icon={<InfoCircleOutlined className={showGuide ? "text-blue-600" : "text-slate-400"} />}
                            onClick={() => setShowGuide(!showGuide)}
                            className="text-slate-600 hover:text-blue-600 font-medium"
                        >
                            {showGuide ? 'Ẩn hướng dẫn' : 'Hướng dẫn thao tác'}
                        </Button>
                        <Link href="/staff/leave-management">
                            <Button icon={<FileTextOutlined className="text-blue-600" />} size="small" className="border-blue-300 text-blue-700 hover:bg-blue-50 font-medium">
                                📝 Đơn Nghỉ Phép
                            </Button>
                        </Link>
                        <Link href="/staff/my-attendance">
                            <Button icon={<UserOutlined />} size="small">
                                Lịch Của Tôi
                            </Button>
                        </Link>
                        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} size="small" title="Tải lại dữ liệu" />
                    </div>
                </div>

                {/* HÀNG 2: Toàn bộ bộ lọc & các nút tác vụ nghiệp vụ */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Bộ chọn Khoa / Phòng */}
                        <Select
                            value={selectedDept}
                            onChange={setSelectedDept}
                            disabled={!canManageAllDepts}
                            className="w-64 font-medium"
                            showSearch
                            placeholder="Chọn Khoa / Phòng"
                            filterOption={(input, option) =>
                                ((option?.label as string) ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={(matrixData?.departments || []).map((d: any) => ({
                                value: d.ma_khoa,
                                label: `${d.ten_khoa} (${d.ma_khoa})`
                            }))}
                        />

                        {/* Bộ chọn Ngày/Tháng/Năm */}
                        <DatePicker
                            value={selectedDate}
                            onChange={(val) => val && setSelectedDate(val)}
                            format="DD/MM/YYYY"
                            allowClear={false}
                            className="w-36 font-semibold border-blue-400 text-blue-700 shadow-sm"
                            placeholder="Chọn ngày chấm công"
                        />

                        {/* Bộ lọc Tìm kiếm theo Tên viết tắt (VD: "Nguyễn Thiện An" -> "nta") */}
                        <Input
                            placeholder="🔍 Tìm nhân viên (VD: nta, hdd...)"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            allowClear
                            className="w-64 font-medium"
                            prefix={<SearchOutlined className="text-slate-400" />}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Nút Chấm Nhanh & Khởi Tạo Công (Chỉ Lãnh đạo có quyền chấm công mới hiển thị) */}
                        {canEditCurrentDept && (
                            <>
                                <Tooltip
                                    title={
                                        isSelectedWeekend
                                            ? `Ngày nghỉ cuối tuần (${selectedDate.format('dddd, DD/MM/YYYY')}): Cán bộ không đi làm hành chính, không thể chấm nhanh cả khoa!`
                                            : `Chấm nhanh đi làm cả khoa ngày ${selectedDate.format('DD/MM/YYYY')}`
                                    }
                                >
                                    <span>
                                        <Button
                                            type="primary"
                                            icon={<ThunderboltOutlined />}
                                            disabled={isSelectedWeekend}
                                            onClick={handleBulkSelectedDate}
                                            className={isSelectedWeekend ? 'bg-slate-300 text-slate-500 font-medium' : 'bg-amber-600 hover:bg-amber-500 font-medium'}
                                        >
                                            {isSelectedWeekend
                                                ? `🚫 Nghỉ ${selectedDate.format('DD/MM')} (Khóa)`
                                                : `Chấm Nhanh Ngày ${selectedDate.format('DD/MM')}`
                                            }
                                        </Button>
                                    </span>
                                </Tooltip>

                                <Popconfirm
                                    title="⚡ Khởi tạo công cả tháng?"
                                    description={
                                        <div className="max-w-xs text-xs space-y-1.5 py-1">
                                            <p>Tự động điền công đi làm (<b>+</b>) cho tất cả cán bộ trong tháng <b>{selectedDate.format('MM/YYYY')}</b>.</p>
                                            <p className="text-emerald-700 font-medium">✓ <b>Mặc định điền Thứ 2 - Thứ 6</b> (tự động bỏ qua Thứ 7 & Chủ Nhật).</p>
                                            <p className="text-purple-700 font-medium">✓ Tự động bỏ qua các ngày nghỉ Lễ/Tết đã cấu hình.</p>
                                            <p className="text-blue-700">✓ Tự động điền Thứ 7/CN nếu có lịch làm bù.</p>
                                            <p className="text-slate-500 italic">✓ Không ghi đè các ô đã chấm trước đó.</p>
                                        </div>
                                    }
                                    onConfirm={handleInitMonth}
                                    okText="Khởi tạo ngay"
                                    cancelText="Hủy"
                                >
                                    <Button 
                                        icon={<ThunderboltOutlined className="text-amber-500" />}
                                        className="font-semibold text-slate-700 hover:text-amber-600 border-amber-300 hover:border-amber-400 bg-amber-50/50"
                                    >
                                        ⚡ Khởi Tạo Công Cả Tháng
                                    </Button>
                                </Popconfirm>
                            </>
                        )}

                        {/* Nút Xuất Excel */}
                        <Dropdown menu={{ items: exportMenuItems }}>
                            <Button type="primary" icon={<DownloadOutlined />} className="bg-emerald-600 hover:bg-emerald-500 font-medium">
                                Xuất Excel Chuẩn Mẫu
                            </Button>
                        </Dropdown>
                    </div>
                </div>
            </div>

            {/* Thông báo hướng dẫn nhanh */}
            {showGuide && (
                <Alert
                    title="Hướng dẫn thao tác nhanh:"
                    description={
                        <div className="text-xs text-slate-600 grid grid-cols-1 md:grid-cols-4 gap-2 mt-1">
                            <div>• <b>Chấm Công:</b> Nhấp chuột trực tiếp vào ô để chọn ký hiệu (<Tag color="success">x</Tag> đi làm, <Tag color="warning">Nb</Tag> nghỉ bù, <Tag color="processing">P</Tag> phép, <Tag color="purple">L</Tag> lễ...).</div>
                            <div>• <b>Chấm Trực:</b> Chọn tab Bảng Chấm Trực, nhấp vào ô để chọn (<Tag color="blue">T</Tag> thường, <Tag color="volcano">C</Tag> thứ 7/CN, <Tag color="magenta">L ⭐2d</Tag> trực lễ, <Tag color="cyan">Tk</Tag> trực kèm, <Tag color="geekblue">TT</Tag> thường trú).</div>
                            <div>• <b>Đồng bộ CNTT:</b> Kỹ thuật viên khi được chấm đi làm hôm nay sẽ <b>tự động bật Nhận việc</b> tại Quản lý yêu cầu CNTT. Lãnh đạo không tự động ép nhận việc.</div>
                            <div>• <b>Ghi chú tháng:</b> Nhấp vào cột <b>Ghi Chú</b> để mở hộp thoại nhập nhanh ghi chú lưu vào Cột AK file Excel bệnh viện.</div>
                        </div>
                    }
                    type="info"
                    showIcon
                    closable
                    onClose={() => setShowGuide(false)}
                    className="mb-4"
                />
            )}

            {/* Route-based Tabs - Chuẩn Ant Design type="card" */}
            <Card className="shadow-sm border-slate-200">
                <Tabs
                    activeKey={activeKey}
                    onChange={handleTabChange}
                    type="card"
                    items={[
                        {
                            key: 'CHAM_CONG',
                            label: (
                                <span className="font-semibold px-2">
                                    <CalendarOutlined /> 1. Bảng Chấm Công
                                </span>
                            ),
                            children: null
                        },
                        {
                            key: 'CHAM_TRUC',
                            label: (
                                <span className="font-semibold px-2">
                                    <ClockCircleOutlined /> 2. Bảng Chấm Trực (Kèm & Thường Trú)
                                </span>
                            ),
                            children: null
                        },
                        {
                            key: 'SO_NGHI_BU',
                            label: (
                                <span className="font-semibold px-2">
                                    <SwapOutlined /> 3. Sổ Theo Dõi & Đối Soát Nghỉ Bù
                                </span>
                            ),
                            children: null
                        },
                        {
                            key: 'CHAM_THEM_GIO',
                            label: (
                                <span className="font-semibold px-2">
                                    <ClockCircleOutlined /> 4. Bảng Chấm Thêm Giờ
                                </span>
                            ),
                            children: null
                        }
                    ]}
                />

                {/* Nội dung Sub-page tương ứng của Tab */}
                <div className="mt-2">
                    {children}
                </div>
            </Card>

            {/* Modal Ghi Chú Tháng */}
            <NoteEditModal />

            {/* Modal Cấu Hình Toàn Viện (Ngày lễ, ngày làm bù, khung giờ) */}
            {canManageAllDepts && (
                <HospitalAttendanceConfigModal
                    open={hospitalConfigOpen}
                    onClose={() => setHospitalConfigOpen(false)}
                />
            )}
        </div>
    );
};

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
    return (
        <AttendanceProvider>
            <AttendanceLayoutInner>
                {children}
            </AttendanceLayoutInner>
        </AttendanceProvider>
    );
}
