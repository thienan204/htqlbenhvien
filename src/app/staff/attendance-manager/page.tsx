'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Table,
    Button,
    Card,
    Space,
    Tag,
    Select,
    DatePicker,
    Modal,
    Radio,
    message,
    Tooltip,
    Tabs,
    Badge,
    Dropdown,
    Spin,
    Divider,
    Alert,
    Popconfirm,
    Input,
    InputNumber
} from 'antd';
import {
    CalendarOutlined,
    DownloadOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    SafetyCertificateOutlined,
    ReloadOutlined,
    UserOutlined,
    ThunderboltOutlined,
    ScheduleOutlined,
    FileExcelOutlined,
    SwapOutlined,
    CarryOutOutlined,
    InfoCircleOutlined,
    SearchOutlined,
    EditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

// Hàm chuẩn hóa tiếng Việt loại bỏ dấu
function removeVietnameseTones(str: string): string {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

// Hàm lấy chữ cái viết tắt (VD: "Nguyễn Thiện An" -> ["nta", "nta"])
function getInitials(name: string): string[] {
    const rawWords = name.trim().split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) return [];
    const withDiacritics = rawWords.map(w => w[0].toLowerCase()).join('');
    const withoutDiacritics = removeVietnameseTones(withDiacritics);
    return [withDiacritics, withoutDiacritics];
}

interface StaffAttendanceSummary {
    luongThoiGian: number;
    nghiKhongLuong: number;
    huongBHXH: number;
    tongCong: number;
}

interface StaffDutySummary {
    ngayThuong: number;
    t7cn: number;
    leTet: number;
    tongSo: number;
    totalAllowanceDays: number;
    totalCompensatedDays: number;
    remainingCompensatoryDays: number;
}

interface StaffMatrixData {
    stt: number;
    staffId: string;
    ma_nv: string;
    ho_ten: string;
    so_dien_thoai: string | null;
    chuc_vu: string;
    chuc_danh: string;
    bac_luong: string;
    he_so_luong: string;
    userId: string | null;
    username: string | null;
    isAvailable: boolean;
    attendanceMap: Record<number, any>;
    dutyMap: Record<number, any>;
    overtimeMap?: Record<number, any>;
    monthlyNote?: string;
    attendanceSummary: StaffAttendanceSummary;
    dutySummary: StaffDutySummary;
    overtimeSummary?: any;
}

interface DayInfo {
    day: number;
    dateStr: string;
    dayOfWeek: number;
    isWeekend: boolean;
    isSaturday: boolean;
    isSunday: boolean;
    isHoliday?: boolean;
    holidayName?: string;
}

export default function AttendanceManagerPage() {
    const { user } = useAuth();
    const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
    const [activeTab, setActiveTab] = useState<'CHAM_CONG' | 'CHAM_TRUC' | 'SO_NGHI_BU' | 'CHAM_THEM_GIO'>('CHAM_CONG');
    const [loading, setLoading] = useState<boolean>(false);
    const [matrixData, setMatrixData] = useState<any>(null);

    // Modal Chấm Nghỉ Bù (Nb)
    const [compensatoryModalVisible, setCompensatoryModalVisible] = useState<boolean>(false);
    const [selectedCellForComp, setSelectedCellForComp] = useState<{
        staffId: string;
        staffName: string;
        dateStr: string;
        day: number;
    } | null>(null);
    const [availableDuties, setAvailableDuties] = useState<any[]>([]);
    const [loadingDuties, setLoadingDuties] = useState<boolean>(false);
    const [selectedDutyId, setSelectedDutyId] = useState<string>('');
    const [compSession, setCompSession] = useState<'FULL_DAY' | 'MORNING' | 'AFTERNOON' | 'HALF_ONLY'>('FULL_DAY');
    const [savingComp, setSavingComp] = useState<boolean>(false);

    // Modal Chấm Thêm Giờ (Overtime)
    const [overtimeModalVisible, setOvertimeModalVisible] = useState<boolean>(false);
    const [selectedOvertimeCell, setSelectedOvertimeCell] = useState<{
        staffId: string;
        staffName: string;
        dateStr: string;
        day: number;
        isWeekend: boolean;
        dayOfWeek: number;
        currentDayHours: number;
        currentNightHours: number;
        currentTotalHours: number;
        note: string;
    } | null>(null);
    const [inputDayHours, setInputDayHours] = useState<number>(0);
    const [inputNightHours, setInputNightHours] = useState<number>(0);
    const [inputOtNote, setInputOtNote] = useState<string>('');
    const [savingOt, setSavingOt] = useState<boolean>(false);

    const [selectedDept, setSelectedDept] = useState<string>(user?.ma_khoa && user.role !== 'ADMIN' ? user.ma_khoa : 'KP046');

    // Tìm kiếm thông minh theo Tên & Tên viết tắt (VD: "Nguyễn Thiện An" -> "nta")
    const [searchText, setSearchText] = useState<string>('');

    // Modal Ghi Chú Tháng
    const [editingNoteStaff, setEditingNoteStaff] = useState<{
        staffId: string;
        staffName: string;
        currentNote: string;
    } | null>(null);
    const [tempNote, setTempNote] = useState<string>('');
    const [savingNote, setSavingNote] = useState<boolean>(false);

    // Nút chấm nhanh
    const [bulkLoading, setBulkLoading] = useState<boolean>(false);
    // Nút khởi tạo công cả tháng
    const [initLoading, setInitLoading] = useState<boolean>(false);
    // Hướng dẫn thao tác nhanh (Mặc định ẩn)
    const [showGuide, setShowGuide] = useState<boolean>(false);

    // Kiểm tra phân quyền truy cập & chỉnh sửa theo Role và Cấp bậc
    const isSuperAdmin = user?.role === 'ADMIN' || user?.userLevel === 'LEVEL_1_BGD';
    const isTCCB = user?.role === 'TCCB' || (user?.ma_khoa && ['TCCB', 'TC_CB', 'P02'].includes(user.ma_khoa.toUpperCase()));
    const canManageAllDepts = isSuperAdmin || isTCCB;
    const isLeaderOfSelectedDept = user?.ma_khoa === selectedDept && (user?.isManager || user?.isDeptLeader || user?.userLevel === 'LEVEL_2_LEADER');
    const canEditCurrentDept = canManageAllDepts || isLeaderOfSelectedDept;

    const monthYearStr = selectedDate.format('YYYY-MM');

    // Tải dữ liệu ma trận
    const fetchMatrix = useCallback(async () => {
        setLoading(true);
        try {
            const basePath = window.location.pathname.split('/staff')[0];
            const res = await fetch(`${basePath}/api/staff/attendance/matrix?monthYear=${monthYearStr}&ma_khoa=${selectedDept}`);
            if (res.ok) {
                const data = await res.json();
                setMatrixData(data);
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(err.error || 'Lỗi khi tải bảng ma trận');
            }
        } catch (error) {
            console.error('Fetch matrix error:', error);
            message.error('Lỗi kết nối khi tải bảng chấm công');
        } finally {
            setLoading(false);
        }
    }, [monthYearStr, selectedDept]);

    useEffect(() => {
        fetchMatrix();
    }, [fetchMatrix]);

    // Lọc danh sách nhân viên theo Tên hoặc Từ viết tắt (VD: "Nguyễn Thiện An" -> "nta")
    const filteredStaffData = useMemo(() => {
        const list: StaffMatrixData[] = matrixData?.staffData || [];
        const q = searchText.trim().toLowerCase();
        if (!q) return list;

        const qNoTone = removeVietnameseTones(q);

        return list.filter((staff) => {
            const nameLower = (staff.ho_ten || '').toLowerCase();
            const nameNoTone = removeVietnameseTones(nameLower);

            // 1. Khớp họ tên trực tiếp (có dấu hoặc không dấu)
            if (nameLower.includes(q) || nameNoTone.includes(qNoTone)) return true;

            // 2. Khớp viết tắt các chữ cái đầu (VD: "Nguyễn Thiện An" -> "nta")
            const [initOriginal, initNoTone] = getInitials(staff.ho_ten || '');
            if (initOriginal.startsWith(q) || initNoTone.startsWith(qNoTone) || initNoTone.includes(qNoTone)) {
                return true;
            }

            // 3. Khớp mã nhân viên
            if (staff.ma_nv && staff.ma_nv.toLowerCase().includes(q)) return true;

            // 4. Khớp chức vụ
            if (staff.chuc_vu && removeVietnameseTones(staff.chuc_vu.toLowerCase()).includes(qNoTone)) return true;

            return false;
        });
    }, [matrixData?.staffData, searchText]);

    // Lưu ghi chú tháng của cán bộ
    const handleSaveNote = async () => {
        if (!editingNoteStaff) return;
        setSavingNote(true);
        try {
            const basePath = window.location.pathname.split('/staff')[0];
            const res = await fetch(`${basePath}/api/staff/attendance/update-note`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staffId: editingNoteStaff.staffId,
                    ma_khoa: selectedDept,
                    monthYear: monthYearStr,
                    note: tempNote
                })
            });

            if (res.ok) {
                message.success(`Đã lưu ghi chú cho ${editingNoteStaff.staffName}`);
                if (matrixData?.staffData) {
                    const updatedList = matrixData.staffData.map((s: StaffMatrixData) =>
                        s.staffId === editingNoteStaff.staffId ? { ...s, monthlyNote: tempNote.trim() } : s
                    );
                    setMatrixData({ ...matrixData, staffData: updatedList });
                }
                setEditingNoteStaff(null);
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(err.error || 'Lỗi khi lưu ghi chú');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi lưu ghi chú');
        } finally {
            setSavingNote(false);
        }
    };

    // Xử lý cập nhật ô chấm công
    const handleUpdateAttendanceCell = async (staffId: string, day: number, code: string) => {
        const dateStr = `${monthYearStr}-${String(day).padStart(2, '0')}`;

        // Nếu chọn Nghỉ bù (Nb cả ngày hoặc Nb/2 nửa ngày) -> Mở modal chọn ca trực
        if (code === 'Nb' || code === 'Nb/2') {
            const st = matrixData?.staffData?.find((s: StaffMatrixData) => s.staffId === staffId);
            setSelectedCellForComp({
                staffId,
                staffName: st?.ho_ten || '',
                dateStr,
                day
            });
            if (code === 'Nb/2') {
                setCompSession('MORNING');
            } else {
                setCompSession('FULL_DAY');
            }
            fetchAvailableDuties(staffId, dateStr);
            setCompensatoryModalVisible(true);
            return;
        }

        try {
            const basePath = window.location.pathname.split('/staff')[0];
            const isHalfDayP = code === 'P/2';

            const res = await fetch(`${basePath}/api/staff/attendance/update-cell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'ATTENDANCE',
                    staffId,
                    ma_khoa: selectedDept,
                    date: dateStr,
                    code,
                    session: isHalfDayP ? 'HALF_DAY' : 'FULL_DAY',
                    secondaryCode: isHalfDayP ? 'x' : null,
                    value: isHalfDayP ? 0.5 : 1.0
                })
            });

            if (res.ok) {
                message.success(`Đã cập nhật ngày ${day} thành: ${code || 'Trống'}`);
                fetchMatrix();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(err.error || 'Lỗi khi cập nhật ô công');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi cập nhật');
        }
    };

    // Xử lý cập nhật ô chấm trực
    const handleUpdateDutyCell = async (staffId: string, day: number, dutyCode: string) => {
        const dateStr = `${monthYearStr}-${String(day).padStart(2, '0')}`;
        try {
            const basePath = window.location.pathname.split('/staff')[0];
            const res = await fetch(`${basePath}/api/staff/attendance/update-cell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'DUTY',
                    staffId,
                    ma_khoa: selectedDept,
                    date: dateStr,
                    dutyCode
                })
            });

            if (res.ok) {
                message.success(`Đã cập nhật ca trực ngày ${day} thành: ${dutyCode || 'Trống'}`);
                fetchMatrix();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(err.error || 'Lỗi khi cập nhật ca trực');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi cập nhật ca trực');
        }
    };

    // Tải danh sách ca trực có thể nghỉ bù
    const fetchAvailableDuties = async (staffId: string, beforeDate: string) => {
        setLoadingDuties(true);
        try {
            const basePath = window.location.pathname.split('/staff')[0];
            const res = await fetch(`${basePath}/api/staff/attendance/available-duties?staffId=${staffId}&beforeDate=${beforeDate}`);
            if (res.ok) {
                const data = await res.json();
                setAvailableDuties(data);
                if (data.length > 0) {
                    setSelectedDutyId(data[0].id);
                } else {
                    setSelectedDutyId('');
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingDuties(false);
        }
    };

    // Xác nhận lưu chấm Nghỉ bù
    const handleSaveCompensatoryLeave = async () => {
        if (!selectedCellForComp || !selectedDutyId) {
            message.warning('Vui lòng chọn ca trực cần nghỉ bù!');
            return;
        }

        setSavingComp(true);
        try {
            const basePath = window.location.pathname.split('/staff')[0];

            let session = 'FULL_DAY';
            let secondaryCode: string | null = null;
            let value = 1.0;
            let code = 'Nb';

            if (compSession === 'MORNING') {
                session = 'MORNING';
                secondaryCode = 'x'; // Sáng nghỉ bù, chiều đi làm
                value = 0.5;
                code = 'Nb/2';
            } else if (compSession === 'AFTERNOON') {
                session = 'AFTERNOON';
                secondaryCode = 'x'; // Sáng đi làm, chiều nghỉ bù
                value = 0.5;
                code = 'Nb/2';
            } else if (compSession === 'HALF_ONLY') {
                session = 'MORNING';
                secondaryCode = null;
                value = 0.5;
                code = 'Nb/2';
            }

            const res = await fetch(`${basePath}/api/staff/attendance/update-cell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'ATTENDANCE',
                    staffId: selectedCellForComp.staffId,
                    ma_khoa: selectedDept,
                    date: selectedCellForComp.dateStr,
                    code,
                    session,
                    secondaryCode,
                    value,
                    dutyRecordId: selectedDutyId
                })
            });

            if (res.ok) {
                message.success('Đã chấm Nghỉ Bù thành công và liên kết ca trực!');
                setCompensatoryModalVisible(false);
                fetchMatrix();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(err.error || 'Lỗi khi lưu chấm nghỉ bù');
            }
        } catch (e) {
            message.error('Lỗi kết nối');
        } finally {
            setSavingComp(false);
        }
    };

    // Chấm nhanh cả phòng cho ngày đang chọn đi làm đủ 'x' hoặc '+'
    const handleBulkSelectedDate = async () => {
        const targetDateStr = selectedDate.format('YYYY-MM-DD');
        setBulkLoading(true);
        try {
            const basePath = window.location.pathname.split('/staff')[0];
            const res = await fetch(`${basePath}/api/staff/attendance/bulk-daily`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ma_khoa: selectedDept,
                    date: targetDateStr,
                    code: selectedDept === 'KP046' ? 'x' : '+',
                    overwrite: false
                })
            });

            if (res.ok) {
                const data = await res.json();
                message.success(data.message || `Đã chấm nhanh ngày ${selectedDate.format('DD/MM/YYYY')} thành công!`);
                fetchMatrix();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(err.error || 'Lỗi khi chấm nhanh');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi chấm nhanh');
        } finally {
            setBulkLoading(false);
        }
    };

    // Khởi tạo công mặc định cả tháng (T2 - T6)
    const handleInitMonth = async () => {
        setInitLoading(true);
        try {
            const basePath = window.location.pathname.split('/staff')[0];
            const res = await fetch(`${basePath}/api/staff/attendance/init-month`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ma_khoa: selectedDept,
                    monthYear: monthYearStr,
                    overwrite: false
                })
            });

            if (res.ok) {
                const data = await res.json();
                message.success(data.message || 'Khởi tạo công cả tháng thành công!');
                fetchMatrix();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(err.error || 'Lỗi khi khởi tạo công tháng');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi khởi tạo công tháng');
        } finally {
            setInitLoading(false);
        }
    };

    // Lưu chấm làm thêm giờ
    const handleSaveOvertime = async () => {
        if (!selectedOvertimeCell) return;
        const total = Number(inputDayHours) + Number(inputNightHours);
        const maxAllowed = selectedOvertimeCell.isWeekend ? 12 : 4;

        if (total > 0 && total < 1) {
            message.warning('Số giờ làm thêm tối thiểu là 1 giờ / ngày!');
            return;
        }

        if (total > maxAllowed) {
            message.warning(`Số giờ làm thêm vượt quá quy định! (${selectedOvertimeCell.isWeekend ? 'Ngày nghỉ cuối tuần tối đa 12h' : 'Ngày hành chính tối đa 4h'})`);
            return;
        }

        setSavingOt(true);
        try {
            const basePath = window.location.pathname.split('/staff')[0];
            const res = await fetch(`${basePath}/api/staff/overtime/update-cell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staffId: selectedOvertimeCell.staffId,
                    ma_khoa: selectedDept,
                    date: selectedOvertimeCell.dateStr,
                    dayHours: Number(inputDayHours),
                    nightHours: Number(inputNightHours),
                    note: inputOtNote
                })
            });

            if (res.ok) {
                message.success(`Đã cập nhật giờ làm thêm ngày ${selectedOvertimeCell.day}!`);
                setOvertimeModalVisible(false);
                fetchMatrix();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(err.error || 'Lỗi khi cập nhật làm thêm giờ');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi cập nhật làm thêm giờ');
        } finally {
            setSavingOt(false);
        }
    };

    // Xuất Excel
    const handleExportExcel = (sheetType: 'CHAM_CONG' | 'CHAM_TRUC' | 'CHAM_THEM_GIO') => {
        const basePath = window.location.pathname.split('/staff')[0];
        const url = `${basePath}/api/staff/attendance/export-excel?monthYear=${monthYearStr}&type=${sheetType}&ma_khoa=${selectedDept}`;
        window.open(url, '_blank');
    };

    // Render Tag chấm công
    const renderAttendanceTag = (att: any) => {
        if (!att) return <span className="text-slate-300">-</span>;
        const code = (att.code || '').trim().toUpperCase();
        const sec = (att.secondaryCode || '').trim();

        if (code === 'X' || code === '+') {
            return <Tag color="success" className="m-0 font-bold text-xs px-1.5">{att.code}</Tag>;
        }
        if (code === 'NB/2' || (code === 'NB' && sec)) {
            return (
                <Tooltip title="Nghỉ bù 1/2 ngày, nửa ngày đi làm (Hưởng đủ 1.0 công)">
                    <Tag color="warning" className="m-0 font-bold text-xs px-1">Nb/2</Tag>
                </Tooltip>
            );
        }
        if (code === 'NB') {
            return (
                <Tooltip title="Nghỉ bù trọn ngày">
                    <Tag color="orange" className="m-0 font-bold text-xs px-1">Nb</Tag>
                </Tooltip>
            );
        }
        if (code === 'P/2') {
            return (
                <Tooltip title="Nghỉ phép 1/2 ngày, nửa ngày đi làm (Hưởng đủ 1.0 công)">
                    <Tag color="geekblue" className="m-0 font-bold text-xs px-1">P/2</Tag>
                </Tooltip>
            );
        }
        if (code === 'P') return <Tag color="processing" className="m-0 font-semibold text-xs px-1">P</Tag>;
        if (code === 'L') return <Tag className="m-0 font-extrabold text-xs px-2 py-0.5 bg-purple-700 text-white border border-purple-800 shadow-xs">L</Tag>;
        if (code === 'TE') return <Tag className="m-0 font-extrabold text-xs px-2 py-0.5 bg-rose-600 text-white border border-rose-700 shadow-xs">Te</Tag>;
        if (code === 'H') return <Tag color="cyan" className="m-0 font-semibold text-xs px-1">H</Tag>;
        if (code === 'KL') return <Tag color="default" className="m-0 font-semibold text-xs px-1">KL</Tag>;
        if (['Ô', 'O', 'TS'].includes(code)) return <Tag color="error" className="m-0 font-semibold text-xs px-1">{code}</Tag>;

        return <Tag className="m-0 text-xs px-1">{att.code}</Tag>;
    };

    // Render Tag ca trực
    const renderDutyTag = (duty: any) => {
        if (!duty) return <span className="text-slate-300">-</span>;
        const code = (duty.dutyCode || '').trim().toUpperCase();

        if (code === 'T') {
            return (
                <Tooltip title="Trực ngày thường (Được bù 1 ngày)">
                    <Tag color="blue" className="m-0 font-bold text-xs px-1.5 py-0.5">T</Tag>
                </Tooltip>
            );
        }
        if (code === 'C') {
            return (
                <Tooltip title="Trực Thứ 7, Chủ Nhật (Được bù 1 ngày)">
                    <Tag color="volcano" className="m-0 font-bold text-xs px-1.5 py-0.5">C</Tag>
                </Tooltip>
            );
        }
        if (code === 'L') {
            return (
                <Tooltip title="Trực Ngày Lễ (Được bù 2 ngày theo luật)">
                    <Tag className="m-0 font-black text-xs px-2 py-0.5 bg-purple-700 text-white border border-purple-800 shadow-xs">L ⭐2d</Tag>
                </Tooltip>
            );
        }
        if (code === 'TE') {
            return (
                <Tooltip title="Trực Tết (Được bù 2 ngày theo luật)">
                    <Tag className="m-0 font-black text-xs px-2 py-0.5 bg-rose-600 text-white border border-rose-700 shadow-xs">Te ⭐2d</Tag>
                </Tooltip>
            );
        }

        return <Tag className="m-0 text-xs">{code}</Tag>;
    };

    // Cấu hình cột Bảng Chấm Công
    const daysInfo: DayInfo[] = matrixData?.daysInfo || [];
    const attendanceColumns: any[] = [
        {
            title: 'STT',
            dataIndex: 'stt',
            key: 'stt',
            width: 45,
            fixed: 'left',
            align: 'center',
            className: 'bg-slate-50 font-medium'
        },
        {
            title: 'Họ và Tên',
            dataIndex: 'ho_ten',
            key: 'ho_ten',
            width: 170,
            fixed: 'left',
            className: 'bg-slate-50',
            render: (name: string, record: StaffMatrixData) => {
                const hasPosition = Boolean(record.chuc_vu && record.chuc_vu.trim() !== '' && record.chuc_vu.trim().toLowerCase() !== 'cán bộ');
                return (
                    <div className="py-0.5">
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800 leading-tight">{name}</span>
                            {!hasPosition && record.userId && (
                                <Tooltip title={record.isAvailable ? 'Đang bật nhận việc CNTT' : 'Đang tắt nhận việc'}>
                                    <span className={`inline-block w-2 h-2 rounded-full ${record.isAvailable ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                </Tooltip>
                            )}
                        </div>
                        {hasPosition && (
                            <div className="text-[11px] text-blue-700 font-semibold flex items-center gap-1 mt-0.5 leading-none">
                                <span>{record.chuc_vu}</span>
                                {record.userId && (
                                    <Tooltip title={record.isAvailable ? 'Đang bật nhận việc CNTT' : 'Đang tắt nhận việc'}>
                                        <span className={`inline-block w-2 h-2 rounded-full ${record.isAvailable ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                    </Tooltip>
                                )}
                            </div>
                        )}
                    </div>
                );
            }
        },
        ...daysInfo.map(d => {
            const isSelected = d.dateStr === selectedDate.format('YYYY-MM-DD');
            const isToday = d.dateStr === dayjs().format('YYYY-MM-DD');

            return {
                title: (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(dayjs(d.dateStr));
                        }}
                        className={`text-center py-1 px-0.5 cursor-pointer select-none transition-all duration-200 rounded ${
                            isSelected
                                ? 'bg-blue-600 text-white font-bold shadow-md ring-2 ring-blue-400'
                                : d.isHoliday
                                ? 'bg-purple-200 text-purple-950 font-black hover:bg-purple-300 border-b-2 border-purple-500'
                                : d.isWeekend
                                ? 'bg-amber-200 text-amber-950 font-black hover:bg-amber-300 border-b-2 border-amber-400'
                                : 'text-slate-700 hover:bg-blue-50'
                        }`}
                        title={d.isHoliday && d.holidayName ? `Ngày Lễ: ${d.holidayName} (${d.day}/${selectedDate.format('MM/YYYY')})` : `Click để chọn ngày ${d.day}/${selectedDate.format('MM/YYYY')} (${d.dayOfWeek === 0 ? 'Chủ Nhật' : `Thứ ${d.dayOfWeek + 1}`})`}
                    >
                        <div className={`text-[10px] leading-3 ${isSelected ? 'text-blue-100 font-semibold' : d.isHoliday ? 'text-purple-800 font-black' : d.isWeekend ? 'text-red-700 font-black' : ''}`}>
                            {d.isHoliday ? 'Lễ' : d.dayOfWeek === 0 ? 'CN' : `T${d.dayOfWeek + 1}`}
                        </div>
                        <div className="text-xs font-bold leading-4 flex items-center justify-center gap-0.5">
                            {d.day}
                            {isToday && (
                                <span
                                    className={`inline-block w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-300' : 'bg-red-500'}`}
                                    title="Hôm nay"
                                />
                            )}
                        </div>
                        {isSelected && (
                            <div className="text-[9px] leading-tight text-amber-200 font-normal whitespace-nowrap scale-90">
                                {isToday ? 'Hôm nay' : 'Đang chọn'}
                            </div>
                        )}
                    </div>
                ),
                dataIndex: ['attendanceMap', d.day],
                key: `day_${d.day}`,
                width: isSelected ? 48 : 42,
                align: 'center',
                className: isSelected
                    ? 'bg-blue-50/90 border-x-2 border-blue-400 font-semibold shadow-inner'
                    : d.isHoliday
                    ? 'bg-purple-100/70 font-medium'
                    : d.isWeekend
                    ? 'bg-amber-100/80 font-medium'
                    : '',
                render: (att: any, record: StaffMatrixData) => {
                    const dutyOnThisDay = record.dutyMap?.[d.day];

                    const cellNode = (
                        <div className="relative flex items-center justify-center py-1">
                            {renderAttendanceTag(att)}
                            {dutyOnThisDay && (
                                <Tooltip title={`Có ca trực đêm: ${dutyOnThisDay.dutyCode} (${dutyOnThisDay.dutyCode === 'T' ? 'Trực thường - Bù 1 ngày' : dutyOnThisDay.dutyCode === 'C' ? 'Trực T7/CN - Bù 1 ngày' : 'Trực Lễ/Tết - Bù 2 ngày'})`}>
                                    <span className="absolute -top-1.5 -right-1 text-[8.5px] font-extrabold text-blue-700 bg-blue-100 rounded-full px-1 border border-blue-400 shadow-xs leading-none">
                                        {dutyOnThisDay.dutyCode}
                                    </span>
                                </Tooltip>
                            )}
                        </div>
                    );

                    if (!canEditCurrentDept) {
                        return cellNode;
                    }

                    const items = [
                        { key: 'x', label: <span className="font-semibold text-emerald-600">x - Đi làm 8h</span> },
                        { key: '+', label: <span className="font-semibold text-emerald-600">+ - Đi làm (Lâm sàng)</span> },
                        { key: 'Nb', label: <span className="font-semibold text-amber-600">Nb - Nghỉ bù cả ngày (Chọn ca trực)</span> },
                        { key: 'Nb/2', label: <span className="font-semibold text-amber-600">Nb/2 - Nghỉ bù 1/2 ngày (Làm nửa ngày)</span> },
                        { key: 'P', label: <span className="text-blue-600">P - Nghỉ phép năm cả ngày</span> },
                        { key: 'P/2', label: <span className="font-semibold text-blue-600">P/2 - Nghỉ phép 1/2 ngày (Làm nửa ngày)</span> },
                        { key: 'H', label: <span className="text-cyan-600">H - Đi học, bồi dưỡng</span> },
                        { key: 'L', label: <span className="text-purple-600">L - Nghỉ lễ, Tết</span> },
                        { key: 'Ô', label: <span className="text-red-600">Ô - Nghỉ ốm BHXH</span> },
                        { key: 'TS', label: <span className="text-pink-600">TS - Nghỉ thai sản</span> },
                        { key: 'KL', label: <span className="text-slate-500">KL - Nghỉ không lương</span> },
                        { type: 'divider' },
                        { key: '', label: <span className="text-rose-500">Xóa ô này</span> }
                    ];

                    return (
                        <Dropdown
                            menu={{
                                items: items as any,
                                onClick: ({ key }) => {
                                    setSelectedDate(dayjs(d.dateStr));
                                    handleUpdateAttendanceCell(record.staffId, d.day, key);
                                }
                            }}
                            trigger={['click']}
                        >
                            <div className="cursor-pointer hover:bg-blue-50/80 rounded transition-colors">
                                {cellNode}
                            </div>
                        </Dropdown>
                    );
                }
            };
        }),
        {
            title: 'Hưởng Lương TG',
            dataIndex: ['attendanceSummary', 'luongThoiGian'],
            key: 'luongThoiGian',
            width: 75,
            align: 'center',
            fixed: 'right',
            className: 'bg-emerald-50/60 font-bold text-emerald-800'
        },
        {
            title: 'Nghỉ KL',
            dataIndex: ['attendanceSummary', 'nghiKhongLuong'],
            key: 'nghiKhongLuong',
            width: 65,
            align: 'center',
            fixed: 'right',
            className: 'bg-slate-50 font-semibold text-slate-600'
        },
        {
            title: 'Hưởng BHXH',
            dataIndex: ['attendanceSummary', 'huongBHXH'],
            key: 'huongBHXH',
            width: 70,
            align: 'center',
            fixed: 'right',
            className: 'bg-rose-50/60 font-semibold text-rose-700'
        },
        {
            title: 'Ghi Chú',
            dataIndex: 'monthlyNote',
            key: 'monthlyNote',
            width: 140,
            fixed: 'right',
            className: 'bg-slate-50',
            render: (val: string, record: StaffMatrixData) => {
                const noteText = val || record.monthlyNote || '';
                return (
                    <div
                        onClick={() => {
                            if (!canEditCurrentDept) return;
                            setEditingNoteStaff({
                                staffId: record.staffId,
                                staffName: record.ho_ten,
                                currentNote: noteText
                            });
                            setTempNote(noteText);
                        }}
                        className={`py-1 px-1.5 rounded transition-all min-h-[28px] flex items-center justify-between gap-1 text-xs ${
                            canEditCurrentDept ? 'cursor-pointer hover:bg-blue-50/80 hover:ring-1 hover:ring-blue-300' : ''
                        }`}
                        title={canEditCurrentDept ? 'Click để sửa ghi chú tháng' : undefined}
                    >
                        <span className={`leading-tight truncate ${noteText ? 'text-slate-800 font-medium' : 'text-slate-300 italic'}`}>
                            {noteText || (canEditCurrentDept ? '+ Ghi chú' : '-')}
                        </span>
                        {canEditCurrentDept && (
                            <EditOutlined className="text-slate-400 hover:text-blue-600 text-[11px] shrink-0" />
                        )}
                    </div>
                );
            }
        }
    ];

    // Cấu hình cột Bảng Chấm Trực
    const dutyColumns: any[] = [
        {
            title: 'STT',
            dataIndex: 'stt',
            key: 'stt',
            width: 45,
            fixed: 'left',
            align: 'center',
            className: 'bg-slate-50 font-medium'
        },
        {
            title: 'Họ và Tên',
            dataIndex: 'ho_ten',
            key: 'ho_ten',
            width: 170,
            fixed: 'left',
            className: 'bg-slate-50',
            render: (name: string, record: StaffMatrixData) => {
                const hasPosition = Boolean(record.chuc_vu && record.chuc_vu.trim() !== '' && record.chuc_vu.trim().toLowerCase() !== 'cán bộ');
                return (
                    <div className="py-0.5">
                        <span className="font-semibold text-slate-800 leading-tight block">{name}</span>
                        {hasPosition && (
                            <div className="text-[11px] text-blue-700 font-semibold mt-0.5 leading-none">{record.chuc_vu}</div>
                        )}
                    </div>
                );
            }
        },
        ...daysInfo.map(d => {
            const isSelected = d.dateStr === selectedDate.format('YYYY-MM-DD');
            const isToday = d.dateStr === dayjs().format('YYYY-MM-DD');

            return {
                title: (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(dayjs(d.dateStr));
                        }}
                        className={`text-center py-1 px-0.5 cursor-pointer select-none transition-all duration-200 rounded ${
                            isSelected
                                ? 'bg-blue-600 text-white font-bold shadow-md ring-2 ring-blue-400'
                                : d.isHoliday
                                ? 'bg-purple-200 text-purple-950 font-black hover:bg-purple-300 border-b-2 border-purple-500'
                                : d.isWeekend
                                ? 'bg-amber-200 text-amber-950 font-black hover:bg-amber-300 border-b-2 border-amber-400'
                                : 'text-slate-700 hover:bg-blue-50'
                        }`}
                        title={d.isHoliday && d.holidayName ? `Ngày Lễ: ${d.holidayName} (${d.day}/${selectedDate.format('MM/YYYY')})` : `Click để chọn ngày ${d.day}/${selectedDate.format('MM/YYYY')} (${d.dayOfWeek === 0 ? 'Chủ Nhật' : `Thứ ${d.dayOfWeek + 1}`})`}
                    >
                        <div className={`text-[10px] leading-3 ${isSelected ? 'text-blue-100 font-semibold' : d.isHoliday ? 'text-purple-800 font-black' : d.isWeekend ? 'text-red-700 font-black' : ''}`}>
                            {d.isHoliday ? 'Lễ' : d.dayOfWeek === 0 ? 'CN' : `T${d.dayOfWeek + 1}`}
                        </div>
                        <div className="text-xs font-bold leading-4 flex items-center justify-center gap-0.5">
                            {d.day}
                            {isToday && (
                                <span
                                    className={`inline-block w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-300' : 'bg-red-500'}`}
                                    title="Hôm nay"
                                />
                            )}
                        </div>
                        {isSelected && (
                            <div className="text-[9px] leading-tight text-amber-200 font-normal whitespace-nowrap scale-90">
                                {isToday ? 'Hôm nay' : 'Đang chọn'}
                            </div>
                        )}
                    </div>
                ),
                dataIndex: ['dutyMap', d.day],
                key: `duty_day_${d.day}`,
                width: isSelected ? 48 : 42,
                align: 'center',
                className: isSelected
                    ? 'bg-blue-50/90 border-x-2 border-blue-400 font-semibold shadow-inner'
                    : d.isHoliday
                    ? 'bg-purple-100/70 font-medium'
                    : d.isWeekend
                    ? 'bg-amber-100/80 font-medium'
                    : '',
                render: (duty: any, record: StaffMatrixData) => {
                    const attOnThisDay = record.attendanceMap?.[d.day];

                    const dutyNode = (
                        <div className="relative flex items-center justify-center py-1">
                            {renderDutyTag(duty)}
                            {attOnThisDay && (
                                <Tooltip title={`Đã đồng bộ công đi làm: ${attOnThisDay.code}`}>
                                    <span className="absolute -top-1.5 -right-1 w-2 h-2 rounded-full bg-emerald-500 border border-white shadow-xs" />
                                </Tooltip>
                            )}
                        </div>
                    );

                    if (!canEditCurrentDept) {
                        return dutyNode;
                    }

                    const items = [
                        { key: 'T', label: <span className="font-bold text-blue-600">T - Trực ngày thường (Tự động điền công đi làm + bù 1 ngày)</span> },
                        { key: 'C', label: <span className="font-bold text-orange-600">C - Trực T7, Chủ Nhật (Tự động điền công + bù 1 ngày)</span> },
                        { key: 'L', label: <span className="font-extrabold text-purple-600">L - Trực Lễ (Tự động điền công + bù 2 ngày theo luật)</span> },
                        { key: 'Te', label: <span className="font-extrabold text-red-600">Te - Trực Tết (Tự động điền công + bù 2 ngày theo luật)</span> },
                        { type: 'divider' },
                        { key: '', label: <span className="text-rose-500">Xóa ca trực</span> }
                    ];

                    return (
                        <Dropdown
                            menu={{
                                items: items as any,
                                onClick: ({ key }) => {
                                    setSelectedDate(dayjs(d.dateStr));
                                    handleUpdateDutyCell(record.staffId, d.day, key);
                                }
                            }}
                            trigger={['click']}
                        >
                            <div className="cursor-pointer hover:bg-amber-50/80 rounded transition-colors">
                                {dutyNode}
                            </div>
                        </Dropdown>
                    );
                }
            };
        }),
        {
            title: 'Thường (T)',
            dataIndex: ['dutySummary', 'ngayThuong'],
            key: 'ngayThuong',
            width: 65,
            align: 'center',
            fixed: 'right',
            className: 'bg-blue-50/60 font-semibold text-blue-700'
        },
        {
            title: 'T7, CN (C)',
            dataIndex: ['dutySummary', 't7cn'],
            key: 't7cn',
            width: 65,
            align: 'center',
            fixed: 'right',
            className: 'bg-orange-50/60 font-semibold text-orange-700'
        },
        {
            title: 'Lễ Tết',
            dataIndex: ['dutySummary', 'leTet'],
            key: 'leTet',
            width: 65,
            align: 'center',
            fixed: 'right',
            className: 'bg-purple-50/60 font-semibold text-purple-700'
        },
        {
            title: 'Tổng Trực',
            dataIndex: ['dutySummary', 'tongSo'],
            key: 'tongSo',
            width: 70,
            align: 'center',
            fixed: 'right',
            className: 'bg-slate-100 font-bold text-slate-800'
        }
    ];

    // Cấu hình Bảng Sổ Đối Soát Nghỉ Bù
    const compensatoryLedgerColumns = [
        {
            title: 'STT',
            dataIndex: 'stt',
            key: 'stt',
            width: 50,
            align: 'center' as const
        },
        {
            title: 'Cán bộ CNTT',
            dataIndex: 'ho_ten',
            key: 'ho_ten',
            width: 180,
            render: (name: string, record: StaffMatrixData) => {
                const hasPosition = Boolean(record.chuc_vu && record.chuc_vu.trim() !== '' && record.chuc_vu.trim().toLowerCase() !== 'cán bộ');
                return (
                    <div className="py-0.5">
                        <span className="font-semibold text-slate-800 block leading-tight">{name}</span>
                        {hasPosition && <div className="text-[11px] text-blue-700 font-semibold mt-0.5 leading-none">{record.chuc_vu}</div>}
                    </div>
                );
            }
        },
        {
            title: 'Tổng Ca Trực Trong Tháng',
            dataIndex: ['dutySummary', 'tongSo'],
            key: 'tongSo',
            width: 110,
            align: 'center' as const,
            render: (val: number) => <Tag color="blue" className="font-bold text-sm">{val} ca</Tag>
        },
        {
            title: 'Hạn Mức Được Nghỉ Bù',
            dataIndex: ['dutySummary', 'totalAllowanceDays'],
            key: 'totalAllowanceDays',
            width: 130,
            align: 'center' as const,
            render: (val: number, record: StaffMatrixData) => (
                <div>
                    <span className="font-bold text-slate-700">{val} ngày</span>
                    {record.dutySummary.leTet > 0 && (
                        <div className="text-[10px] text-purple-600 font-medium">(Đã gồm ca Lễ bù 2 ngày)</div>
                    )}
                </div>
            )
        },
        {
            title: 'Đã Nghỉ Bù (Thực tế)',
            dataIndex: ['dutySummary', 'totalCompensatedDays'],
            key: 'totalCompensatedDays',
            width: 130,
            align: 'center' as const,
            render: (val: number) => <Tag color="green" className="font-bold">{val} ngày</Tag>
        },
        {
            title: 'Quỹ Ngày Trực Còn Dư Có Thể Bù',
            dataIndex: ['dutySummary', 'remainingCompensatoryDays'],
            key: 'remainingCompensatoryDays',
            width: 160,
            align: 'center' as const,
            render: (val: number) => {
                if (val <= 0) return <Tag color="default">Đã bù hết</Tag>;
                if (val <= 1) return <Tag color="warning" className="font-bold text-sm">Còn {val} ngày</Tag>;
                return <Tag color="error" className="font-bold text-sm">Còn {val} ngày</Tag>;
            }
        },
        {
            title: 'Thao tác nhanh',
            key: 'action',
            width: 140,
            align: 'center' as const,
            render: (_: any, record: StaffMatrixData) => (
                <Button
                    type="link"
                    size="small"
                    icon={<CalendarOutlined />}
                    onClick={() => {
                        setActiveTab('CHAM_CONG');
                    }}
                >
                    Chấm bù trên lịch
                </Button>
            )
        }
    ];

    // Cấu hình Bảng Chấm Thêm Giờ (Overtime)
    const overtimeColumns: any[] = [
        {
            title: 'STT',
            dataIndex: 'stt',
            key: 'stt',
            width: 45,
            fixed: 'left',
            align: 'center',
            className: 'bg-slate-50 font-medium'
        },
        {
            title: 'Họ và Tên',
            dataIndex: 'ho_ten',
            key: 'ho_ten',
            width: 170,
            fixed: 'left',
            className: 'bg-slate-50',
            render: (name: string, record: StaffMatrixData) => {
                const hasPosition = Boolean(record.chuc_vu && record.chuc_vu.trim() !== '' && record.chuc_vu.trim().toLowerCase() !== 'cán bộ');
                return (
                    <div className="py-0.5">
                        <span className="font-semibold text-slate-800 block leading-tight">{name}</span>
                        {hasPosition && (
                            <div className="text-[11px] text-blue-700 font-semibold mt-0.5 leading-none">{record.chuc_vu}</div>
                        )}
                    </div>
                );
            }
        },
        ...daysInfo.map(d => {
            const isSelected = d.dateStr === selectedDate.format('YYYY-MM-DD');
            const isToday = d.dateStr === dayjs().format('YYYY-MM-DD');

            return {
                title: (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(dayjs(d.dateStr));
                        }}
                        className={`text-center py-1 px-0.5 cursor-pointer select-none transition-all duration-200 rounded ${
                            isSelected
                                ? 'bg-amber-600 text-white font-bold shadow-md ring-2 ring-amber-400'
                                : d.isHoliday
                                ? 'bg-purple-200 text-purple-950 font-black hover:bg-purple-300 border-b-2 border-purple-500'
                                : d.isWeekend
                                ? 'bg-amber-200 text-amber-950 font-black hover:bg-amber-300 border-b-2 border-amber-400'
                                : 'text-slate-700 hover:bg-amber-50'
                        }`}
                        title={d.isHoliday && d.holidayName ? `Ngày Lễ: ${d.holidayName} (${d.day}/${selectedDate.format('MM/YYYY')})` : `Click để chọn ngày ${d.day}/${selectedDate.format('MM/YYYY')} (${d.dayOfWeek === 0 ? 'Chủ Nhật' : `Thứ ${d.dayOfWeek + 1}`})`}
                    >
                        <div className={`text-[10px] leading-3 ${isSelected ? 'text-amber-100 font-semibold' : d.isHoliday ? 'text-purple-800 font-black' : d.isWeekend ? 'text-red-700 font-black' : ''}`}>
                            {d.isHoliday ? 'Lễ' : d.dayOfWeek === 0 ? 'CN' : `T${d.dayOfWeek + 1}`}
                        </div>
                        <div className="text-xs font-bold leading-4 flex items-center justify-center gap-0.5">
                            {d.day}
                            {isToday && (
                                <span
                                    className={`inline-block w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-red-500'}`}
                                    title="Hôm nay"
                                />
                            )}
                        </div>
                        {isSelected && (
                            <div className="text-[9px] leading-tight text-amber-200 font-normal whitespace-nowrap scale-90">
                                {isToday ? 'Hôm nay' : 'Đang chọn'}
                            </div>
                        )}
                    </div>
                ),
                dataIndex: ['overtimeMap', d.day],
                key: `overtime_day_${d.day}`,
                width: isSelected ? 48 : 42,
                align: 'center',
                className: isSelected
                    ? 'bg-amber-50/90 border-x-2 border-amber-400 font-semibold shadow-inner'
                    : d.isHoliday
                    ? 'bg-purple-100/70 font-medium'
                    : d.isWeekend
                    ? 'bg-amber-100/80 font-medium'
                    : '',
                render: (ot: any, record: any) => {
                    const dutyOnThisDay = record.dutyMap?.[d.day];

                    // Nếu ngày này cán bộ đã có ca trực (T, C, L, Te) -> KHÔNG ĐƯỢC CHẤM THÊM GIỜ
                    if (dutyOnThisDay) {
                        return (
                            <Tooltip title={`Cán bộ đã có lịch trực (${dutyOnThisDay.dutyCode}). Theo quy định của Viện, không được chấm thêm giờ trùng ca trực!`}>
                                <div className="py-1 px-0.5 bg-slate-100/80 rounded border border-slate-200 text-slate-400 text-[10px] font-medium cursor-not-allowed select-none">
                                    Trực {dutyOnThisDay.dutyCode}
                                </div>
                            </Tooltip>
                        );
                    }

                    const hasOt = ot && ot.totalHours > 0;
                    const cellNode = (
                        <div className="py-1 flex items-center justify-center min-h-[26px]">
                            {hasOt ? (
                                <Tooltip title={`Làm thêm: ${ot.totalHours}h (Ngày: ${ot.dayHours || 0}h, Đêm: ${ot.nightHours || 0}h)${ot.note ? ` - ${ot.note}` : ''}`}>
                                    <Tag color={d.isWeekend ? 'volcano' : 'orange'} className="m-0 font-extrabold text-xs px-1.5 py-0.5 shadow-xs">
                                        {ot.totalHours}
                                    </Tag>
                                </Tooltip>
                            ) : (
                                <span className="text-slate-300 text-xs hover:text-amber-500 font-mono transition-colors">-</span>
                            )}
                        </div>
                    );

                    if (!canEditCurrentDept) {
                        return cellNode;
                    }

                    return (
                        <div
                            onClick={() => {
                                setSelectedDate(dayjs(d.dateStr));
                                setSelectedOvertimeCell({
                                    staffId: record.staffId,
                                    staffName: record.ho_ten,
                                    dateStr: d.dateStr,
                                    day: d.day,
                                    isWeekend: d.isWeekend,
                                    dayOfWeek: d.dayOfWeek,
                                    currentDayHours: ot?.dayHours || 0,
                                    currentNightHours: ot?.nightHours || 0,
                                    currentTotalHours: ot?.totalHours || 0,
                                    note: ot?.note || ''
                                });
                                setInputDayHours(ot?.dayHours || 0);
                                setInputNightHours(ot?.nightHours || 0);
                                setInputOtNote(ot?.note || '');
                                setOvertimeModalVisible(true);
                            }}
                            className="cursor-pointer hover:bg-amber-100/80 rounded transition-colors group"
                            title="Click để nhập số giờ làm thêm"
                        >
                            {cellNode}
                        </div>
                    );
                }
            };
        }),
        {
            title: 'Tổng ngày',
            dataIndex: ['overtimeSummary', 'totalDayHours'],
            key: 'totalDayHours',
            width: 75,
            align: 'center',
            fixed: 'right',
            className: 'bg-amber-50/70 font-bold text-amber-800'
        },
        {
            title: 'Tổng đêm',
            dataIndex: ['overtimeSummary', 'totalNightHours'],
            key: 'totalNightHours',
            width: 75,
            align: 'center',
            fixed: 'right',
            className: 'bg-indigo-50/70 font-bold text-indigo-800'
        },
        {
            title: 'Tổng cộng',
            dataIndex: ['overtimeSummary', 'totalOvertimeHours'],
            key: 'totalOvertimeHours',
            width: 80,
            align: 'center',
            fixed: 'right',
            className: 'bg-amber-200/60 font-black text-amber-950'
        }
    ];

    const exportMenuItems = [
        {
            key: 'export_cong',
            label: '1. Xuất Bảng Chấm Công',
            icon: <FileExcelOutlined className="text-emerald-600" />,
            onClick: () => handleExportExcel('CHAM_CONG')
        },
        {
            key: 'export_truc',
            label: '2. Xuất Bảng Chấm Trực',
            icon: <FileExcelOutlined className="text-blue-600" />,
            onClick: () => handleExportExcel('CHAM_TRUC')
        },
        {
            key: 'export_them_gio',
            label: '3. Xuất Bảng Chấm Thêm Giờ',
            icon: <FileExcelOutlined className="text-amber-600" />,
            onClick: () => handleExportExcel('CHAM_THEM_GIO')
        }
    ];

    return (
        <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
            {/* Header Màn hình - Tách 2 hàng rõ ràng để tiêu đề nằm trên 1 row duy nhất */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4">
                {/* HÀNG 1: Tiêu đề đầy đủ các nghiệp vụ (1 row) + Các nút tiện ích */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <ScheduleOutlined className="text-blue-600 text-2xl shrink-0" />
                        <h1 className="text-base md:text-lg lg:text-xl font-bold text-slate-800 m-0 truncate">
                            Quản Lý Chấm Công, Chấm Trực, Trực Kèm, Thêm Giờ, Độc Hại: {matrixData?.ten_khoa || 'Khoa / Phòng'}
                        </h1>
                        <Tag color="cyan" className="font-mono font-bold shrink-0">Mã: {selectedDept}</Tag>
                        {canEditCurrentDept ? (
                            <Tag color="success" className="font-medium shrink-0">🟢 Có quyền chấm công</Tag>
                        ) : (
                            <Tag color="default" className="font-medium shrink-0">👁️ Chế độ chỉ xem</Tag>
                        )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            type="text"
                            size="small"
                            icon={<InfoCircleOutlined className={showGuide ? "text-blue-600" : "text-slate-400"} />}
                            onClick={() => setShowGuide(!showGuide)}
                            className="text-slate-600 hover:text-blue-600 font-medium"
                        >
                            {showGuide ? 'Ẩn hướng dẫn' : 'Hướng dẫn thao tác'}
                        </Button>
                        <Link href="/staff/my-attendance">
                            <Button icon={<UserOutlined />} size="small">
                                Lịch Của Tôi
                            </Button>
                        </Link>
                        <Button icon={<ReloadOutlined />} onClick={fetchMatrix} loading={loading} size="small" title="Tải lại dữ liệu" />
                    </div>
                </div>

                {/* HÀNG 2: Toàn bộ bộ lọc & các nút tác vụ nghiệp vụ */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Bộ chọn Khoa / Phòng (Dành cho Admin hoặc chuyển đổi khoa) */}
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

                        {/* Bộ chọn Ngày/Tháng/Năm (Mặc định ngày hiện tại) */}
                        <DatePicker
                            value={selectedDate}
                            onChange={(val) => val && setSelectedDate(val)}
                            format="DD/MM/YYYY"
                            allowClear={false}
                            className="w-36 font-semibold border-blue-400 text-blue-700 shadow-sm"
                            placeholder="Chọn ngày chấm công"
                        />

                        {/* Bộ lọc Tìm kiếm theo Tên & Tên viết tắt (VD: "Nguyễn Thiện An" -> "nta") */}
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
                        {/* Nút Chấm Nhanh Theo Ngày Đang Chọn - Khóa vào Thứ 7, Chủ Nhật */}
                        {(() => {
                            const isSelectedWeekend = selectedDate.day() === 0 || selectedDate.day() === 6;
                            return (
                                <Tooltip
                                    title={
                                        isSelectedWeekend
                                            ? `Ngày nghỉ cuối tuần (${selectedDate.format('dddd, DD/MM/YYYY')}): Cán bộ không đi làm hành chính, không thể chấm nhanh cả khoa!`
                                            : !canEditCurrentDept
                                            ? 'Bạn không có quyền chấm công cho khoa này'
                                            : `Chấm nhanh đi làm cả khoa ngày ${selectedDate.format('DD/MM/YYYY')}`
                                    }
                                >
                                    <span>
                                        <Button
                                            type="primary"
                                            icon={<ThunderboltOutlined />}
                                            loading={bulkLoading}
                                            disabled={!canEditCurrentDept || isSelectedWeekend}
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
                            );
                        })()}

                        {/* Nút Khởi Tạo Công Cả Tháng */}
                        <Popconfirm
                            title="Khởi tạo công cả tháng?"
                            description={`Tự động điền công đi làm (${selectedDept === 'KP046' ? 'x' : '+'}) cho tất cả các ngày Thứ 2 - Thứ 6 trong tháng ${selectedDate.format('MM/YYYY')} (không ghi đè ô đã chấm).`}
                            onConfirm={handleInitMonth}
                            okText="Khởi tạo ngay"
                            cancelText="Hủy"
                            disabled={!canEditCurrentDept}
                        >
                            <Button
                                icon={<CarryOutOutlined />}
                                loading={initLoading}
                                disabled={!canEditCurrentDept}
                                className="bg-teal-50 border-teal-500 text-teal-700 hover:bg-teal-100 font-medium"
                                title="Khởi tạo sẵn công đi làm ngày thường (T2-T6) cho toàn bộ cán bộ trong tháng"
                            >
                                Khởi Tạo Công Cả Tháng
                            </Button>
                        </Popconfirm>

                        {/* Nút Xuất Excel */}
                        <Dropdown menu={{ items: exportMenuItems }}>
                            <Button type="primary" icon={<DownloadOutlined />} className="bg-emerald-600 hover:bg-emerald-500 font-medium">
                                Xuất Excel Chuẩn Mẫu
                            </Button>
                        </Dropdown>
                    </div>
                </div>
            </div>

            {/* Thông báo hướng dẫn nhanh - Mặc định ẩn, bật khi bấm 'Hướng dẫn thao tác' */}
            {showGuide && (
                <Alert
                    title="Hướng dẫn thao tác nhanh:"
                    description={
                        <div className="text-xs text-slate-600 grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
                            <div>• <b>Chấm Công:</b> Nhấp chuột trực tiếp vào ô để chọn ký hiệu (<Tag color="success">x</Tag> đi làm, <Tag color="warning">Nb</Tag> nghỉ bù, <Tag color="processing">P</Tag> phép, <Tag color="purple">L</Tag> lễ...).</div>
                            <div>• <b>Chấm Trực:</b> Chọn tab Bảng Chấm Trực, nhấp vào ô để chọn (<Tag color="blue">T</Tag> thường, <Tag color="volcano">C</Tag> thứ 7/CN, <Tag color="magenta">L ⭐2d</Tag> trực lễ nghỉ bù 2 ngày).</div>
                            <div>• <b>Đồng bộ CNTT:</b> Kỹ thuật viên khi được chấm đi làm hôm nay sẽ <b>tự động bật Nhận việc</b> tại Quản lý yêu cầu CNTT. Lãnh đạo không tự động ép nhận việc.</div>
                        </div>
                    }
                    type="info"
                    showIcon
                    closable
                    onClose={() => setShowGuide(false)}
                    className="mb-4"
                />
            )}

            {/* Tabs Nội Dung Chính */}
            <Card className="shadow-sm border-slate-200">
                <Tabs
                    activeKey={activeTab}
                    onChange={(k) => setActiveTab(k as any)}
                    type="card"
                    items={[
                        {
                            key: 'CHAM_CONG',
                            label: (
                                <span className="font-semibold px-2">
                                    <CalendarOutlined /> 1. Bảng Chấm Công
                                </span>
                            ),
                            children: (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-xs text-slate-500">
                                            Tổng quân số: <b className="text-slate-800">{filteredStaffData.length} cán bộ</b>
                                            {searchText.trim() && (
                                                <span className="text-blue-600 font-semibold ml-1">
                                                    (Lọc từ {matrixData?.staffData?.length || 0} cán bộ)
                                                </span>
                                            )} |
                                            Tổng công hưởng lương toàn phòng: <b className="text-emerald-700">{matrixData?.totalDeptAttendance?.luongThoiGian || 0} công</b>
                                        </div>
                                    </div>
                                    <Table
                                        columns={attendanceColumns}
                                        dataSource={filteredStaffData}
                                        rowKey="staffId"
                                        loading={loading}
                                        pagination={false}
                                        bordered
                                        size="small"
                                        className="attendance-matrix-table"
                                        scroll={{ x: 1780 }}
                                    />
                                </div>
                            )
                        },
                        {
                            key: 'CHAM_TRUC',
                            label: (
                                <span className="font-semibold px-2">
                                    <ClockCircleOutlined /> 2. Bảng Chấm Trực
                                </span>
                            ),
                            children: (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-xs text-slate-500">
                                            Tổng quân số: <b className="text-slate-800">{filteredStaffData.length} cán bộ</b>
                                            {searchText.trim() && (
                                                <span className="text-blue-600 font-semibold ml-1">
                                                    (Lọc từ {matrixData?.staffData?.length || 0} cán bộ)
                                                </span>
                                            )} |
                                            Tổng phiên trực toàn phòng trong tháng: <b className="text-blue-700">{matrixData?.totalDeptDuty?.tongSo || 0} phiên</b>
                                            (Thường: {matrixData?.totalDeptDuty?.ngayThuong || 0}, T7/CN: {matrixData?.totalDeptDuty?.t7cn || 0}, Lễ Tết: {matrixData?.totalDeptDuty?.leTet || 0})
                                        </div>
                                    </div>
                                    <Table
                                        columns={dutyColumns}
                                        dataSource={filteredStaffData}
                                        rowKey="staffId"
                                        loading={loading}
                                        pagination={false}
                                        bordered
                                        size="small"
                                        className="attendance-matrix-table"
                                        scroll={{ x: 1700 }}
                                    />
                                </div>
                            )
                        },
                        {
                            key: 'SO_NGHI_BU',
                            label: (
                                <span className="font-semibold px-2">
                                    <SwapOutlined /> 3. Sổ Theo Dõi & Đối Soát Nghỉ Bù
                                </span>
                            ),
                            children: (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-xs text-slate-500 mb-0">
                                            Bảng tổng hợp quỹ ngày trực và số ngày đã nghỉ bù của từng cán bộ trong tháng. Trực ngày Lễ được tính định mức nghỉ bù 2 ngày theo luật lao động.
                                        </p>
                                        <span className="text-xs text-slate-500 shrink-0">
                                            Quân số: <b className="text-slate-800">{filteredStaffData.length}</b>
                                            {searchText.trim() && <span className="text-blue-600 font-semibold ml-1">(Lọc từ {matrixData?.staffData?.length || 0})</span>} cán bộ
                                        </span>
                                    </div>
                                    <Table
                                        columns={compensatoryLedgerColumns}
                                        dataSource={filteredStaffData}
                                        rowKey="staffId"
                                        loading={loading}
                                        pagination={false}
                                        bordered
                                        size="middle"
                                        className="attendance-matrix-table"
                                    />
                                </div>
                            )
                        },
                        {
                            key: 'CHAM_THEM_GIO',
                            label: (
                                <span className="font-semibold px-2">
                                    <ClockCircleOutlined /> 4. Bảng Chấm Thêm Giờ
                                </span>
                            ),
                            children: (
                                <div>
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2 p-2 bg-amber-50/70 rounded-lg border border-amber-200">
                                        <div className="text-xs text-slate-700">
                                            Tổng quân số: <b className="text-slate-800">{filteredStaffData.length}</b>
                                            {searchText.trim() && <span className="text-blue-600 font-semibold ml-1">(Lọc từ {matrixData?.staffData?.length || 0})</span>} cán bộ |{' '}
                                            Tổng giờ làm thêm toàn phòng: <b className="text-amber-800 text-sm">{matrixData?.totalDeptOvertime?.totalOvertimeHours || 0} giờ</b>{' '}
                                            (Giờ ngày: <b className="text-amber-700">{matrixData?.totalDeptOvertime?.totalDayHours || 0}h</b>, Giờ đêm: <b className="text-indigo-700">{matrixData?.totalDeptOvertime?.totalNightHours || 0}h</b>)
                                        </div>
                                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center gap-1">
                                                <span className="w-3 h-3 bg-amber-200 border border-amber-400 inline-block rounded-xs" /> Thứ 7 & Chủ Nhật
                                            </span>
                                            <span>• Ngày thường tối đa <b>4h</b></span>
                                            <span>• Thứ 7/CN/Lễ tối đa <b>12h</b></span>
                                            <span className="text-rose-600 font-semibold">• Có lịch trực: Không được chấm thêm giờ</span>
                                        </div>
                                    </div>
                                    <Table
                                        columns={overtimeColumns}
                                        dataSource={filteredStaffData}
                                        rowKey="staffId"
                                        loading={loading}
                                        pagination={false}
                                        bordered
                                        size="small"
                                        className="attendance-matrix-table"
                                        scroll={{ x: 1750 }}
                                    />
                                </div>
                            )
                        }
                    ]}
                />
            </Card>

            {/* Custom CSS viền 1px đậm nét (#64748b) cho toàn bộ bảng */}
            <style dangerouslySetInnerHTML={{ __html: `
                .attendance-matrix-table .ant-table,
                .attendance-matrix-table .ant-table-container,
                .attendance-matrix-table .ant-table-cell,
                .attendance-matrix-table.ant-table-wrapper .ant-table-bordered th,
                .attendance-matrix-table.ant-table-wrapper .ant-table-bordered td,
                .attendance-matrix-table.ant-table-wrapper .ant-table-bordered .ant-table-container,
                .attendance-matrix-table.ant-table-wrapper .ant-table-bordered .ant-table-cell {
                    border-color: #64748b !important;
                    border-width: 1px !important;
                }
                .attendance-matrix-table .ant-table-thead > tr > th {
                    border-color: #64748b !important;
                    border-bottom: 1.5px solid #475569 !important;
                }
                .attendance-matrix-table .ant-table-cell-fix-left,
                .attendance-matrix-table .ant-table-cell-fix-right {
                    border-color: #64748b !important;
                }
                .attendance-matrix-table .ant-table-tbody > tr:hover > td {
                    background-color: #f1f5f9 !important;
                }
            `}} />

            {/* Modal Nhập Ghi Chú Tháng Cho Cán Bộ */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-blue-700 font-bold">
                        <EditOutlined /> Ghi Chú Tháng {selectedDate.format('MM/YYYY')}: {editingNoteStaff?.staffName}
                    </div>
                }
                open={Boolean(editingNoteStaff)}
                onCancel={() => setEditingNoteStaff(null)}
                onOk={handleSaveNote}
                confirmLoading={savingNote}
                okText="Lưu Ghi Chú"
                cancelText="Hủy"
                width={440}
            >
                <div className="py-2">
                    <p className="text-xs text-slate-500 mb-2">
                        Nhập ghi chú cho nhân sự trong tháng (ví dụ: <i>60% 15 N..., Nghỉ chế độ, Đi học, Thử việc...</i>). Ghi chú này sẽ được xuất vào cột <b>Ghi chú (AK)</b> của file Excel.
                    </p>
                    <Input.TextArea
                        rows={3}
                        value={tempNote}
                        onChange={(e) => setTempNote(e.target.value)}
                        placeholder="Nhập ghi chú (VD: 60% 15 N, Nghỉ thai sản...)"
                        maxLength={200}
                        showCount
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveNote();
                            }
                        }}
                    />
                </div>
            </Modal>

            {/* Modal Chấm Nghỉ Bù Thông Minh */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-amber-700 font-bold">
                        <SwapOutlined /> Chấm Nghỉ Bù (Nb) - Chọn Ca Trực Để Bù
                    </div>
                }
                open={compensatoryModalVisible}
                onOk={handleSaveCompensatoryLeave}
                onCancel={() => setCompensatoryModalVisible(false)}
                okText="Xác nhận Lưu Nghỉ Bù"
                cancelText="Hủy"
                confirmLoading={savingComp}
                width={560}
            >
                <div className="py-2">
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mb-4 text-xs">
                        <div>Cán bộ: <b className="text-slate-800 text-sm">{selectedCellForComp?.staffName}</b></div>
                        <div>Ngày xin nghỉ bù: <b className="text-slate-800">{selectedCellForComp?.dateStr}</b></div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            1. Chọn Ca Trực Cần Nghỉ Bù: <span className="text-rose-500">*</span>
                        </label>
                        {loadingDuties ? (
                            <Spin size="small" />
                        ) : availableDuties.length === 0 ? (
                            <Alert
                                type="error"
                                title="Cán bộ này không có ca trực nào còn dư quỹ ngày nghỉ bù!"
                                description="Quy tắc: Chỉ có trực mới được nghỉ bù. Cán bộ chưa có ca trực nào hoặc đã nghỉ bù hết các ca trước đó."
                                showIcon
                            />
                        ) : (
                            <Select
                                value={selectedDutyId}
                                onChange={setSelectedDutyId}
                                className="w-full"
                                options={availableDuties.map(d => ({
                                    value: d.id,
                                    label: d.label
                                }))}
                            />
                        )}
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            2. Chọn Phạm Vi Nghỉ Bù: <span className="text-rose-500">*</span>
                        </label>
                        <Radio.Group
                            value={compSession}
                            onChange={(e) => setCompSession(e.target.value)}
                            className="flex flex-col gap-2.5 mt-1"
                        >
                            <Radio value="FULL_DAY">
                                <span className="font-semibold text-slate-800">Nghỉ bù CẢ NGÀY (Ký hiệu: Nb)</span>
                                <span className="text-xs text-slate-500 block">Trừ 1.0 ngày bù từ ca trực. Hưởng 1 ngày công lương thời gian.</span>
                            </Radio>
                            <Radio value="MORNING">
                                <span className="font-semibold text-slate-800">Nghỉ bù buổi SÁNG, Chiều đi làm (Ký hiệu: Nb/x)</span>
                                <span className="text-xs text-slate-500 block">Trừ 0.5 ngày bù từ ca trực. Chiều đi làm hưởng lương đầy đủ.</span>
                            </Radio>
                            <Radio value="AFTERNOON">
                                <span className="font-semibold text-slate-800">Sáng đi làm, Nghỉ bù buổi CHIỀU (Ký hiệu: x/Nb)</span>
                                <span className="text-xs text-slate-500 block">Trừ 0.5 ngày bù từ ca trực. Sáng đi làm hưởng lương đầy đủ.</span>
                            </Radio>
                            <Radio value="HALF_ONLY">
                                <span className="font-semibold text-slate-800">Chỉ nghỉ bù NỬA NGÀY (Ký hiệu: 1/2Nb)</span>
                                <span className="text-xs text-slate-500 block">Trừ 0.5 ngày bù từ ca trực. Tính 0.5 công hưởng lương.</span>
                            </Radio>
                        </Radio.Group>
                    </div>
                </div>
            </Modal>

            {/* Modal Chấm Thêm Giờ (Overtime) */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-amber-700 font-bold">
                        <ClockCircleOutlined /> Chấm Làm Thêm Giờ (Overtime) - Ngày {selectedOvertimeCell?.dateStr}
                    </div>
                }
                open={overtimeModalVisible}
                onOk={handleSaveOvertime}
                onCancel={() => setOvertimeModalVisible(false)}
                okText="Lưu Giờ Làm Thêm"
                cancelText="Đóng"
                confirmLoading={savingOt}
                width={520}
            >
                <div className="py-2">
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mb-3 text-xs">
                        <div className="flex justify-between items-center">
                            <div>Cán bộ: <b className="text-slate-800 text-sm">{selectedOvertimeCell?.staffName}</b></div>
                            <Tag color={selectedOvertimeCell?.isWeekend ? 'volcano' : 'blue'}>
                                {selectedOvertimeCell?.dayOfWeek === 0 ? 'Chủ Nhật' : `Thứ ${Number(selectedOvertimeCell?.dayOfWeek) + 1}`}
                            </Tag>
                        </div>
                        <div className="mt-1 text-slate-600">
                            Quy định: {selectedOvertimeCell?.isWeekend ? 'Ngày nghỉ cuối tuần tối đa 12h' : 'Ngày hành chính tối đa 4h'}, tối thiểu 1h.
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                ☀️ Giờ làm thêm Ban Ngày:
                            </label>
                            <Space.Compact className="w-full">
                                <InputNumber
                                    min={0}
                                    max={selectedOvertimeCell?.isWeekend ? 12 : 4}
                                    step={0.5}
                                    value={inputDayHours}
                                    onChange={(val) => setInputDayHours(Number(val) || 0)}
                                    className="w-full"
                                    placeholder="Số giờ ngày"
                                />
                                <span className="inline-flex items-center px-3 bg-slate-100 border border-l-0 border-slate-300 text-slate-500 rounded-r-md text-xs select-none">
                                    giờ
                                </span>
                            </Space.Compact>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                🌙 Giờ làm thêm Ban Đêm:
                            </label>
                            <Space.Compact className="w-full">
                                <InputNumber
                                    min={0}
                                    max={selectedOvertimeCell?.isWeekend ? 12 : 4}
                                    step={0.5}
                                    value={inputNightHours}
                                    onChange={(val) => setInputNightHours(Number(val) || 0)}
                                    className="w-full"
                                    placeholder="Số giờ đêm"
                                />
                                <span className="inline-flex items-center px-3 bg-slate-100 border border-l-0 border-slate-300 text-slate-500 rounded-r-md text-xs select-none">
                                    giờ
                                </span>
                            </Space.Compact>
                        </div>
                    </div>

                    {/* Phím chọn nhanh */}
                    <div className="mb-3">
                        <span className="text-xs text-slate-500 mr-2">Chọn nhanh:</span>
                        <Space wrap size="small">
                            <Button size="small" onClick={() => { setInputDayHours(1); setInputNightHours(0); }}>1h</Button>
                            <Button size="small" onClick={() => { setInputDayHours(2); setInputNightHours(0); }}>2h</Button>
                            <Button size="small" onClick={() => { setInputDayHours(4); setInputNightHours(0); }}>4h</Button>
                            {selectedOvertimeCell?.isWeekend && (
                                <>
                                    <Button size="small" onClick={() => { setInputDayHours(8); setInputNightHours(0); }}>8h</Button>
                                    <Button size="small" onClick={() => { setInputDayHours(8); setInputNightHours(4); }}>12h (8d+4n)</Button>
                                </>
                            )}
                            <Button
                                size="small"
                                danger
                                onClick={() => { setInputDayHours(0); setInputNightHours(0); }}
                                title="Xóa giờ làm thêm về 0"
                            >
                                Xóa về 0h
                            </Button>
                        </Space>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 mb-3 text-xs flex justify-between items-center">
                        <span className="font-medium text-slate-700">Tổng cộng giờ làm thêm:</span>
                        <span className="text-base font-extrabold text-amber-700">
                            {Number(inputDayHours) + Number(inputNightHours)} giờ
                        </span>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Ghi chú công việc (nếu có):
                        </label>
                        <Input
                            value={inputOtNote}
                            onChange={(e) => setInputOtNote(e.target.value)}
                            placeholder="Ví dụ: Xử lý sự cố máy chủ, nâng cấp hệ thống..."
                            maxLength={100}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
