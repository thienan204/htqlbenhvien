'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import dayjs from 'dayjs';
import { message } from 'antd';
import { useAuth } from '@/contexts/AuthContext';

export interface DayInfo {
    day: number;
    dateStr: string;
    dayOfWeek: number;
    isWeekend: boolean;
    isHoliday: boolean;
    holidayName?: string;
    isMakeupWorkday?: boolean;
    makeupDescription?: string | null;
}

export interface StaffMatrixData {
    stt: number;
    staffId: string;
    ma_nv: string;
    ho_ten: string;
    so_dien_thoai?: string | null;
    chuc_vu?: string;
    chuc_danh?: string;
    bac_luong?: string;
    he_so_luong?: string;
    userId?: string | null;
    username?: string | null;
    isAvailable?: boolean;
    attendanceMap: Record<number, any>;
    dutyMap: Record<number, any>;
    overtimeMap: Record<number, any>;
    monthlyNote?: string;
    attendanceSummary: {
        luongThoiGian: number;
        nghiKhongLuong: number;
        huongBHXH: number;
        tongCong: number;
    };
    dutySummary: {
        ngayThuong: number;
        t7cn: number;
        leTet: number;
        trucKem: number;
        thuongTru: number;
        tongSo: number;
        totalAllowanceDays: number;
        totalCompensatedDays: number;
        remainingCompensatoryDays: number;
        uncompensatedDuties?: Array<{
            id: string;
            dutyDate: string;
            dutyCode: string;
            dutyType: string;
            allowanceDays: number;
            compensatedDays: number;
            remainingDays: number;
            shortDate: string;
            label: string;
        }>;
        dutyDatesText?: string;
    };
    overtimeSummary: {
        totalDayHours: number;
        totalNightHours: number;
        totalOvertimeHours: number;
    };
}

export interface AttendanceMatrixResponse {
    monthYear: string;
    year: number;
    month: number;
    ma_khoa: string;
    ten_khoa: string;
    departments: { ma_khoa: string; ten_khoa: string }[];
    daysInMonth: number;
    daysInfo: DayInfo[];
    staffData: StaffMatrixData[];
    totalDeptAttendance: {
        luongThoiGian: number;
        nghiKhongLuong: number;
        huongBHXH: number;
    };
    totalDeptDuty: {
        ngayThuong: number;
        t7cn: number;
        leTet: number;
        trucKem: number;
        thuongTru: number;
        tongSo: number;
    };
    totalDeptOvertime: {
        totalDayHours: number;
        totalNightHours: number;
        totalOvertimeHours: number;
    };
    lockMap: Record<string, any>;
}

export const removeVietnameseTones = (str: string): string => {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
};

export const getInitials = (name: string): string => {
    const cleanName = removeVietnameseTones(name).trim();
    if (!cleanName) return '';
    const words = cleanName.split(/\s+/);
    return words.map(w => w[0] || '').join('').toLowerCase();
};

interface AttendanceContextType {
    selectedDate: dayjs.Dayjs;
    setSelectedDate: (d: dayjs.Dayjs) => void;
    selectedDept: string;
    setSelectedDept: (dept: string) => void;
    searchText: string;
    setSearchText: (txt: string) => void;
    loading: boolean;
    matrixData: AttendanceMatrixResponse | null;
    filteredStaffData: StaffMatrixData[];
    canEditCurrentDept: boolean;
    fetchData: () => Promise<void>;
    handleUpdateAttendanceCell: (staffId: string, day: number, code: string, dutyRecordId?: string, session?: string) => Promise<void>;
    handleUpdateDutyCell: (staffId: string, day: number, dutyCode: string) => Promise<void>;
    handleUpdateOvertimeCell: (staffId: string, day: number, dayHours: number, nightHours: number, note?: string) => Promise<void>;
    handleSaveNote: (staffId: string, noteText: string) => Promise<void>;
    editingNoteStaff: StaffMatrixData | null;
    setEditingNoteStaff: (st: StaffMatrixData | null) => void;
    tempNoteText: string;
    setTempNoteText: (t: string) => void;
    isSavingNote: boolean;
    showLockModal: boolean;
    setShowLockModal: (b: boolean) => void;
    showQuickModal: boolean;
    setShowQuickModal: (b: boolean) => void;
    showGuide: boolean;
    setShowGuide: (b: boolean) => void;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const AttendanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
    const [selectedDept, setSelectedDept] = useState<string>('KP046');
    const [searchText, setSearchText] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [matrixData, setMatrixData] = useState<AttendanceMatrixResponse | null>(null);

    // Modal state
    const [editingNoteStaff, setEditingNoteStaff] = useState<StaffMatrixData | null>(null);
    const [tempNoteText, setTempNoteText] = useState<string>('');
    const [isSavingNote, setIsSavingNote] = useState<boolean>(false);
    const [showLockModal, setShowLockModal] = useState<boolean>(false);
    const [showQuickModal, setShowQuickModal] = useState<boolean>(false);
    const [showGuide, setShowGuide] = useState<boolean>(false);

    // Khởi tạo khoa phòng theo user
    useEffect(() => {
        if (user?.ma_khoa && user.role !== 'ADMIN') {
            setSelectedDept(user.ma_khoa);
        }
    }, [user]);

    // Quyền chỉnh sửa khoa phòng
    const canEditCurrentDept = useMemo(() => {
        if (!user) return false;
        if (user.role === 'ADMIN') return true;
        if (!user.ma_khoa) return false;
        return user.ma_khoa === selectedDept;
    }, [user, selectedDept]);

    const getBasePath = () => {
        if (typeof window !== 'undefined') {
            const parts = window.location.pathname.split('/staff');
            return parts.length > 1 ? parts[0] : '';
        }
        return '';
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const monthYear = selectedDate.format('YYYY-MM');
            const basePath = getBasePath();
            const res = await fetch(`${basePath}/api/staff/attendance/matrix?monthYear=${monthYear}&ma_khoa=${selectedDept}`);
            if (!res.ok) {
                try {
                    const errData = await res.json();
                    message.error(errData.error || 'Lỗi tải dữ liệu chấm công');
                } catch {
                    message.error('Máy chủ phản hồi không đúng định dạng');
                }
                return;
            }
            const data = await res.json();
            setMatrixData(data);
        } catch (error) {
            console.error('Fetch error:', error);
            message.error('Không thể kết nối máy chủ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedDate.format('YYYY-MM'), selectedDept]);

    // Bộ lọc thông minh theo tên viết tắt, họ tên, mã NV, chức vụ
    const filteredStaffData = useMemo(() => {
        if (!matrixData?.staffData) return [];
        const rawKeyword = searchText.trim().toLowerCase();
        if (!rawKeyword) return matrixData.staffData;

        const cleanKeyword = removeVietnameseTones(rawKeyword);

        return matrixData.staffData.filter(staff => {
            const fullNameClean = removeVietnameseTones(staff.ho_ten).toLowerCase();
            const initials = getInitials(staff.ho_ten);
            const maNvClean = (staff.ma_nv || '').toLowerCase();
            const chucVuClean = removeVietnameseTones(staff.chuc_vu || '').toLowerCase();

            if (initials.includes(cleanKeyword)) return true;
            if (fullNameClean.includes(cleanKeyword)) return true;
            if (maNvClean.includes(rawKeyword)) return true;
            if (chucVuClean.includes(cleanKeyword)) return true;

            return false;
        });
    }, [matrixData?.staffData, searchText]);

    // Cập nhật ô Chấm Công
    const handleUpdateAttendanceCell = async (staffId: string, day: number, code: string, dutyRecordId?: string, session?: string) => {
        try {
            const basePath = getBasePath();
            const dateStr = `${selectedDate.format('YYYY-MM')}-${String(day).padStart(2, '0')}`;
            const res = await fetch(`${basePath}/api/staff/attendance/update-cell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'ATTENDANCE',
                    staffId,
                    date: dateStr,
                    code,
                    session: session || undefined,
                    ma_khoa: selectedDept,
                    dutyRecordId: dutyRecordId || undefined
                })
            });
            if (!res.ok) {
                try {
                    const errData = await res.json();
                    message.error(errData.error || 'Cập nhật chấm công thất bại');
                } catch {
                    message.error('Lỗi máy chủ khi chấm công');
                }
                return;
            }
            const data = await res.json();
            if (data.success) {
                fetchData();
            } else {
                message.error(data.error || 'Cập nhật chấm công thất bại');
            }
        } catch (err) {
            message.error('Lỗi kết nối khi chấm công');
        }
    };

    // Cập nhật ô Chấm Trực (hỗ trợ T, C, L, Te, TK, TT)
    const handleUpdateDutyCell = async (staffId: string, day: number, dutyCode: string) => {
        try {
            const basePath = getBasePath();
            const dateStr = `${selectedDate.format('YYYY-MM')}-${String(day).padStart(2, '0')}`;
            const cleanCode = (dutyCode || '').trim().toUpperCase();
            let dutyType = 'TRUC_CHINH';
            if (cleanCode === 'TK') dutyType = 'TRUC_KEM';
            else if (cleanCode === 'TT') dutyType = 'TRUC_THUONG_TRU';

            const res = await fetch(`${basePath}/api/staff/attendance/update-cell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'DUTY',
                    staffId,
                    date: dateStr,
                    dutyCode: cleanCode,
                    dutyType,
                    ma_khoa: selectedDept
                })
            });
            if (!res.ok) {
                try {
                    const errData = await res.json();
                    message.error(errData.error || 'Cập nhật chấm trực thất bại');
                } catch {
                    message.error('Lỗi máy chủ khi chấm trực');
                }
                return;
            }
            const data = await res.json();
            if (data.success) {
                fetchData();
            } else {
                message.error(data.error || 'Cập nhật chấm trực thất bại');
            }
        } catch (err) {
            message.error('Lỗi kết nối khi chấm trực');
        }
    };

    // Cập nhật ô Chấm Thêm Giờ (Overtime)
    const handleUpdateOvertimeCell = async (staffId: string, day: number, dayHours: number, nightHours: number, note?: string) => {
        try {
            const basePath = getBasePath();
            const dateStr = `${selectedDate.format('YYYY-MM')}-${String(day).padStart(2, '0')}`;
            const res = await fetch(`${basePath}/api/staff/overtime/update-cell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staffId,
                    date: dateStr,
                    dayHours,
                    nightHours,
                    note,
                    ma_khoa: selectedDept
                })
            });
            if (!res.ok) {
                try {
                    const errData = await res.json();
                    message.error(errData.error || 'Lưu giờ làm thêm thất bại');
                } catch {
                    message.error('Lỗi máy chủ khi lưu làm thêm giờ');
                }
                return;
            }
            const data = await res.json();
            if (data.success) {
                message.success('Đã lưu giờ làm thêm');
                fetchData();
            } else {
                message.error(data.error || 'Lưu giờ làm thêm thất bại');
            }
        } catch (err) {
            message.error('Lỗi kết nối khi chấm làm thêm giờ');
        }
    };

    // Lưu Ghi Chú Tháng
    const handleSaveNote = async (staffId: string, noteText: string) => {
        try {
            setIsSavingNote(true);
            const basePath = getBasePath();
            const monthYear = selectedDate.format('YYYY-MM');
            const res = await fetch(`${basePath}/api/staff/attendance/update-note`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staffId,
                    monthYear,
                    ma_khoa: selectedDept,
                    note: noteText
                })
            });
            if (!res.ok) {
                try {
                    const errData = await res.json();
                    message.error(errData.error || 'Lỗi khi lưu ghi chú');
                } catch {
                    message.error('Lỗi máy chủ khi lưu ghi chú');
                }
                return;
            }
            const data = await res.json();
            if (data.success) {
                message.success('Đã lưu ghi chú thành công');
                setEditingNoteStaff(null);
                setTempNoteText('');
                fetchData();
            } else {
                message.error(data.error || 'Lỗi khi lưu ghi chú');
            }
        } catch (err) {
            message.error('Lỗi kết nối khi lưu ghi chú');
        } finally {
            setIsSavingNote(false);
        }
    };

    return (
        <AttendanceContext.Provider
            value={{
                selectedDate,
                setSelectedDate,
                selectedDept,
                setSelectedDept,
                searchText,
                setSearchText,
                loading,
                matrixData,
                filteredStaffData,
                canEditCurrentDept,
                fetchData,
                handleUpdateAttendanceCell,
                handleUpdateDutyCell,
                handleUpdateOvertimeCell,
                handleSaveNote,
                editingNoteStaff,
                setEditingNoteStaff,
                tempNoteText,
                setTempNoteText,
                isSavingNote,
                showLockModal,
                setShowLockModal,
                showQuickModal,
                setShowQuickModal,
                showGuide,
                setShowGuide
            }}
        >
            {children}
        </AttendanceContext.Provider>
    );
};

export const useAttendance = () => {
    const context = useContext(AttendanceContext);
    if (!context) {
        throw new Error('useAttendance must be used within an AttendanceProvider');
    }
    return context;
};
