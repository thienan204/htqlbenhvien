'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Tag, Input, Button, DatePicker, Select, Switch, Space, Tooltip, Spin, Card, message, Radio } from 'antd';
import {
    LeftOutlined,
    RightOutlined,
    CalendarOutlined,
    SearchOutlined,
    FileExcelOutlined,
    PrinterOutlined,
    ReloadOutlined,
    TableOutlined,
    PhoneOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import Link from 'next/link';

dayjs.extend(isoWeek);

interface DutyStaff {
    id: string;
    dutyRecordId: string;
    ho_ten: string;
    so_dien_thoai?: string;
    chuc_vu?: string;
    chuc_danh?: string;
    trinh_do?: string;
    dutyCode: string;
    dutyType: string;
    allowanceDays?: number;
    note?: string;
}

interface DaySchedule {
    trucChinh: DutyStaff[];
    trucKem: DutyStaff[];
    thuongTru: DutyStaff[];
}

interface DepartmentScheduleItem {
    stt: number;
    ma_khoa: string;
    ten_khoa: string;
    totalDuties: number;
    schedule: Record<string, DaySchedule>;
}

// Dòng hiển thị cho Mẫu 2: Danh sách chi tiết ca trực theo ngày/khoa
interface DetailedScheduleRow {
    key: string;
    stt: number;
    ma_khoa: string;
    ten_khoa: string;
    dateStr: string;
    dayOfWeek: number;
    dayName: string;
    formattedDate: string;
    trucChinh: DutyStaff[];
    thuongTru: DutyStaff[];
    trucKem: DutyStaff[];
}

// Helper lấy tên hiển thị theo định dạng: [Trình độ / Chức danh] - [Họ tên]
const getStaffDisplayName = (person: DutyStaff) => {
    const title = person.trinh_do || person.chuc_danh || person.chuc_vu || '';
    return title ? `${title} - ${person.ho_ten}` : person.ho_ten;
};

// Helper hiển thị danh sách cán bộ trực có dấu * đầu dòng dạng văn bản thuần
const renderStaffList = (staffList: DutyStaff[]) => {
    if (!staffList || staffList.length === 0) {
        return <span className="text-slate-300 select-none font-mono text-xs">-</span>;
    }
    return (
        <div className="space-y-1 py-1">
            {staffList.map((person) => (
                <div key={person.dutyRecordId} className="text-[12px] leading-snug text-slate-900 font-medium">
                    <span className="font-bold text-slate-700 mr-1.5">*</span>
                    <span>{getStaffDisplayName(person)}</span>
                </div>
            ))}
        </div>
    );
};

export default function DutySchedulePage() {
    // Chế độ xem: 'DETAILED_LIST' (Mẫu 2: Chi tiết ca trực) hoặc 'WEEK_MATRIX' (Mẫu 1: Ma trận tuần)
    const [viewTemplate, setViewTemplate] = useState<'DETAILED_LIST' | 'WEEK_MATRIX'>('DETAILED_LIST');
    // Bộ lọc ngày của Mẫu 2: 'TODAY' (Hôm nay), 'ALL' (Cả tuần), hoặc 'YYYY-MM-DD'
    const [detailedDayFilter, setDetailedDayFilter] = useState<string>('TODAY');

    // Mặc định tuần hiện tại chứa ngày hôm nay
    const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedDept, setSelectedDept] = useState<string>('ALL');
    const [onlyWithDuties, setOnlyWithDuties] = useState<boolean>(true);

    const [scheduleData, setScheduleData] = useState<{
        startDate: string;
        endDate: string;
        todayStr: string;
        weekDays: any[];
        totalDuties: number;
        totalDepartmentsWithDuties: number;
        totalAllDepartments: number;
        departments: DepartmentScheduleItem[];
    } | null>(null);

    // Tính toán thứ 2 và chủ nhật của tuần đang chọn
    const mondayStr = useMemo(() => currentDate.startOf('isoWeek').format('YYYY-MM-DD'), [currentDate]);
    const sundayStr = useMemo(() => currentDate.endOf('isoWeek').format('YYYY-MM-DD'), [currentDate]);

    const getBasePath = () => {
        if (typeof window !== 'undefined') {
            const parts = window.location.pathname.split('/staff');
            return parts.length > 1 ? parts[0] : '';
        }
        return '';
    };

    const fetchSchedule = useCallback(async () => {
        setLoading(true);
        try {
            const basePath = getBasePath();
            const queryParams = new URLSearchParams({
                startDate: mondayStr,
                endDate: sundayStr,
                ma_khoa: selectedDept,
                onlyWithDuties: String(onlyWithDuties)
            });

            const res = await fetch(`${basePath}/api/staff/attendance/duty-schedule?${queryParams.toString()}`);
            if (!res.ok) {
                const text = await res.text();
                let errMsg = 'Lỗi tải lịch trực';
                try {
                    const err = JSON.parse(text);
                    if (err.error) errMsg = err.error;
                } catch {}
                throw new Error(errMsg);
            }
            const text = await res.text();
            let data: any = null;
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error('Máy chủ phản hồi không đúng định dạng JSON');
            }
            if (data) {
                setScheduleData(data);
            }
        } catch (err: any) {
            console.error('Lỗi fetchSchedule:', err);
            message.error(err.message || 'Không thể tải lịch trực kế hoạch');
        } finally {
            setLoading(false);
        }
    }, [mondayStr, sundayStr, selectedDept, onlyWithDuties]);

    useEffect(() => {
        fetchSchedule();
    }, [fetchSchedule]);

    // Chuyển tuần
    const handlePrevWeek = () => setCurrentDate(prev => prev.subtract(1, 'week'));
    const handleNextWeek = () => setCurrentDate(prev => prev.add(1, 'week'));
    const handleCurrentWeek = () => setCurrentDate(dayjs());

    // Xuất Excel
    const handleExportExcel = () => {
        const basePath = getBasePath();
        const url = `${basePath}/api/staff/attendance/export-excel?startDate=${mondayStr}&endDate=${sundayStr}&ma_khoa=${selectedDept}&type=LICH_TRUC_TUAN`;
        window.open(url, '_blank');
    };

    // In ấn
    const handlePrint = () => {
        window.print();
    };

    const weekDays = scheduleData?.weekDays || [];
    const departments = scheduleData?.departments || [];

    // Lọc theo từ khóa tìm kiếm
    const filteredDepartments = useMemo(() => {
        if (!searchText || searchText.trim() === '') return departments;
        const kw = searchText.trim().toLowerCase();

        return departments.filter(dept => {
            if (dept.ten_khoa.toLowerCase().includes(kw) || dept.ma_khoa.toLowerCase().includes(kw)) {
                return true;
            }
            // Tìm trong ca trực của các ngày
            return Object.values(dept.schedule).some(daySch => {
                const allStaff = [...daySch.trucChinh, ...daySch.trucKem, ...daySch.thuongTru];
                return allStaff.some(s =>
                    s.ho_ten.toLowerCase().includes(kw) ||
                    (s.trinh_do && s.trinh_do.toLowerCase().includes(kw)) ||
                    (s.chuc_danh && s.chuc_danh.toLowerCase().includes(kw)) ||
                    (s.chuc_vu && s.chuc_vu.toLowerCase().includes(kw))
                );
            });
        });
    }, [departments, searchText]);

    // Xây dựng danh sách lựa chọn khoa phòng
    const deptOptions = useMemo(() => {
        const list = [{ label: '🏢 Tất cả các khoa/phòng', value: 'ALL' }];
        departments.forEach(d => {
            list.push({ label: `${d.ten_khoa} (${d.ma_khoa})`, value: d.ma_khoa });
        });
        return list;
    }, [departments]);

    // Định nghĩa cột bảng
    const columns: any[] = useMemo(() => {
        const cols: any[] = [
            {
                title: 'STT',
                dataIndex: 'stt',
                key: 'stt',
                width: 48,
                fixed: 'left',
                align: 'center',
                className: 'bg-slate-50 font-medium'
            },
            {
                title: 'Tên Khoa / Phòng',
                dataIndex: 'ten_khoa',
                key: 'ten_khoa',
                width: 190,
                fixed: 'left',
                className: 'bg-slate-50 font-bold',
                render: (name: string) => (
                    <div className="py-1">
                        <span className="text-slate-900 font-bold block leading-snug">{name}</span>
                    </div>
                )
            }
        ];

        // 7 cột Thứ 2 -> Chủ Nhật
        weekDays.forEach(d => {
            const isToday = d.isToday;
            const isWeekend = d.isWeekend;

            cols.push({
                title: (
                    <div
                        className={`text-center py-1 px-1 rounded transition-colors select-none ${
                            isToday
                                ? 'bg-blue-600 text-white font-black shadow-sm ring-2 ring-blue-400'
                                : d.isHoliday
                                ? 'bg-purple-200 text-purple-950 font-black'
                                : isWeekend
                                ? 'bg-amber-100 text-amber-950 font-black'
                                : 'text-slate-800'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-1">
                            <span className="text-xs uppercase">{d.dayName}</span>
                            {isToday && (
                                <span className="bg-amber-400 text-blue-950 text-[9px] font-black px-1 rounded-full uppercase tracking-tighter">
                                    Hôm nay
                                </span>
                            )}
                        </div>
                        <div className={`text-[11px] font-semibold ${isToday ? 'text-blue-100' : 'text-slate-500'}`}>
                            {d.formattedDate}
                        </div>
                    </div>
                ),
                key: d.dateStr,
                width: 155,
                className: isToday ? 'bg-blue-50/70 font-medium' : isWeekend ? 'bg-amber-50/40' : '',
                render: (_: any, record: DepartmentScheduleItem) => {
                    const daySch: DaySchedule = record.schedule?.[d.dateStr] || {
                        trucChinh: [],
                        trucKem: [],
                        thuongTru: []
                    };

                    const hasChinh = daySch.trucChinh && daySch.trucChinh.length > 0;
                    const hasKem = daySch.trucKem && daySch.trucKem.length > 0;
                    const hasThuongTru = daySch.thuongTru && daySch.thuongTru.length > 0;

                    // Nếu hoàn toàn không có ca trực nào ngày này
                    if (!hasChinh && !hasKem && !hasThuongTru) {
                        return (
                            <div className="py-2 text-center text-slate-300 text-xs font-mono select-none">
                                -
                            </div>
                        );
                    }

                    // HIỂN THỊ CÁC CA TRỰC: Dạng văn bản thuần (không background, không viền thẻ, không SĐT)
                    // Định dạng: [Trình độ / Chức danh] - [Họ tên]
                    // TH1: Nếu chỉ có Trực chính (phổ biến nhất)
                    if (hasChinh && !hasKem && !hasThuongTru) {
                        return (
                            <div className="py-1 px-1.5 space-y-0.5">
                                {daySch.trucChinh.map(person => (
                                    <div
                                        key={person.dutyRecordId}
                                        className="text-[11px] leading-tight text-slate-900 font-medium py-0.5"
                                        title={getStaffDisplayName(person)}
                                    >
                                        {getStaffDisplayName(person)}
                                    </div>
                                ))}
                            </div>
                        );
                    }

                    // TH2: Nếu có thêm Trực kèm hoặc Thường trú -> Phân tách rõ bằng tiền tố [Kèm] / [T.Trú]
                    return (
                        <div className="py-1 px-1.5 space-y-0.5">
                            {/* Khối Trực chính */}
                            {hasChinh && daySch.trucChinh.map(person => (
                                <div
                                    key={person.dutyRecordId}
                                    className="text-[11px] leading-tight text-slate-900 font-medium py-0.5"
                                    title={getStaffDisplayName(person)}
                                >
                                    {getStaffDisplayName(person)}
                                </div>
                            ))}

                            {/* Khối Trực kèm */}
                            {hasKem && daySch.trucKem.map(person => (
                                <div
                                    key={person.dutyRecordId}
                                    className="text-[11px] leading-tight text-blue-900 font-medium py-0.5"
                                    title={`Trực kèm: ${getStaffDisplayName(person)}`}
                                >
                                    <span className="text-blue-600 font-bold mr-1">[Kèm]</span>
                                    {getStaffDisplayName(person)}
                                </div>
                            ))}

                            {/* Khối Thường trú */}
                            {hasThuongTru && daySch.thuongTru.map(person => (
                                <div
                                    key={person.dutyRecordId}
                                    className="text-[11px] leading-tight text-purple-900 font-medium py-0.5"
                                    title={`Thường trú: ${getStaffDisplayName(person)}`}
                                >
                                    <span className="text-purple-600 font-bold mr-1">[T.Trú]</span>
                                    {getStaffDisplayName(person)}
                                </div>
                            ))}
                        </div>
                    );
                }
            });
        });

        return cols;
    }, [weekDays]);

    // Dữ liệu cho Mẫu 2: Danh sách chi tiết ca trực theo ngày/khoa
    const detailedRows = useMemo(() => {
        const rows: DetailedScheduleRow[] = [];
        let count = 0;

        let targetDays = weekDays;
        if (detailedDayFilter === 'TODAY') {
            const todayItem = weekDays.find((d: any) => d.isToday);
            targetDays = todayItem ? [todayItem] : (weekDays.length > 0 ? [weekDays[0]] : []);
        } else if (detailedDayFilter !== 'ALL') {
            targetDays = weekDays.filter((d: any) => d.dateStr === detailedDayFilter);
        }

        targetDays.forEach((day: any) => {
            filteredDepartments.forEach((dept: DepartmentScheduleItem) => {
                const daySch: DaySchedule = dept.schedule?.[day.dateStr] || {
                    trucChinh: [],
                    trucKem: [],
                    thuongTru: []
                };

                const hasDuties =
                    (daySch.trucChinh && daySch.trucChinh.length > 0) ||
                    (daySch.thuongTru && daySch.thuongTru.length > 0) ||
                    (daySch.trucKem && daySch.trucKem.length > 0);

                if (onlyWithDuties && !hasDuties) return;

                count++;
                rows.push({
                    key: `${dept.ma_khoa}_${day.dateStr}`,
                    stt: count,
                    ma_khoa: dept.ma_khoa,
                    ten_khoa: dept.ten_khoa,
                    dateStr: day.dateStr,
                    dayOfWeek: day.dayOfWeek,
                    dayName: day.dayName,
                    formattedDate: dayjs(day.dateStr).format('DD/MM/YYYY'),
                    trucChinh: daySch.trucChinh || [],
                    thuongTru: daySch.thuongTru || [],
                    trucKem: daySch.trucKem || []
                });
            });
        });

        return rows;
    }, [weekDays, filteredDepartments, detailedDayFilter, onlyWithDuties]);

    // Định nghĩa cột cho Mẫu 2: Chuẩn 7 cột theo mẫu ảnh bệnh viện
    const detailedColumns: any[] = useMemo(() => [
        {
            title: 'STT',
            dataIndex: 'stt',
            key: 'stt',
            width: 50,
            align: 'center',
            className: 'bg-slate-50 font-medium'
        },
        {
            title: 'Khoa phòng',
            dataIndex: 'ten_khoa',
            key: 'ten_khoa',
            width: 200,
            className: 'font-bold text-slate-900',
            render: (name: string) => (
                <span className="font-bold text-slate-900 block leading-snug">{name}</span>
            )
        },
        {
            title: 'Thứ',
            dataIndex: 'dayName',
            key: 'dayName',
            width: 85,
            align: 'center',
            className: 'font-semibold text-slate-800'
        },
        {
            title: 'Ngày trực',
            dataIndex: 'formattedDate',
            key: 'formattedDate',
            width: 105,
            align: 'center',
            className: 'font-medium text-slate-700'
        },
        {
            title: 'Nhân viên trực',
            dataIndex: 'trucChinh',
            key: 'trucChinh',
            render: (list: DutyStaff[]) => renderStaffList(list)
        },
        {
            title: 'Trực thường trú',
            dataIndex: 'thuongTru',
            key: 'thuongTru',
            width: 230,
            render: (list: DutyStaff[]) => renderStaffList(list)
        },
        {
            title: 'Trực kèm',
            dataIndex: 'trucKem',
            key: 'trucKem',
            width: 230,
            render: (list: DutyStaff[]) => renderStaffList(list)
        }
    ], []);

    return (
        <div className="p-4 space-y-3 bg-slate-50 min-h-screen">
            {/* Header & Thanh điều hướng */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Link href="/staff/attendance/duty">
                        <Button icon={<TableOutlined />} className="font-medium text-xs">
                            ← Quay lại Bảng Chấm Trực Tháng
                        </Button>
                    </Link>
                    <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                    <div>
                        <h1 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2 m-0">
                            <CalendarOutlined className="text-blue-600" />
                            <span>LỊCH TRỰC BỆNH VIỆN (KẾ HOẠCH TOÀN VIỆN)</span>
                        </h1>
                        <div className="text-xs text-slate-500 mt-0.5">
                            Tuần: <strong>{dayjs(mondayStr).format('DD/MM/YYYY')}</strong> đến <strong>{dayjs(sundayStr).format('DD/MM/YYYY')}</strong>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Chuyển đổi qua lại giữa 2 mẫu lịch trực */}
                    <Radio.Group
                        value={viewTemplate}
                        onChange={(e) => setViewTemplate(e.target.value)}
                        buttonStyle="solid"
                        size="middle"
                        className="schedule-view-mode"
                    >
                        <Radio.Button value="DETAILED_LIST">
                            📋 Mẫu Chi Tiết (Khoa - Ngày)
                        </Radio.Button>
                        <Radio.Button value="WEEK_MATRIX">
                            📅 Mẫu Ma Trận Tuần (Thứ 2 - CN)
                        </Radio.Button>
                    </Radio.Group>

                    <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                    <Button
                        icon={<FileExcelOutlined className="text-emerald-600" />}
                        onClick={handleExportExcel}
                        className="font-medium text-xs hover:border-emerald-500 hover:text-emerald-600"
                    >
                        Xuất Excel
                    </Button>
                    <Button
                        icon={<PrinterOutlined className="text-blue-600" />}
                        onClick={handlePrint}
                        className="font-medium text-xs hover:border-blue-500 hover:text-blue-600"
                    >
                        In Lịch Trực
                    </Button>
                </div>
            </div>

            {/* Thanh công cụ lọc & tìm kiếm */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Điều hướng tuần */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-200">
                        <Button
                            size="small"
                            icon={<LeftOutlined />}
                            onClick={handlePrevWeek}
                            title="Tuần trước"
                        />
                        <Button
                            size="small"
                            type={currentDate.isSame(dayjs(), 'week') ? 'primary' : 'default'}
                            onClick={handleCurrentWeek}
                            className="font-semibold text-xs"
                        >
                            Hôm nay (Tuần này)
                        </Button>
                        <Button
                            size="small"
                            icon={<RightOutlined />}
                            onClick={handleNextWeek}
                            title="Tuần sau"
                        />
                    </div>

                    <DatePicker
                        picker="week"
                        value={currentDate}
                        onChange={(d) => d && setCurrentDate(d)}
                        format="[Tuần] w / YYYY"
                        allowClear={false}
                        className="w-40 text-xs"
                    />

                    {/* Chọn ngày xem chi tiết nếu đang ở Mẫu 2 */}
                    {viewTemplate === 'DETAILED_LIST' && (
                        <div className="flex items-center gap-1.5 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-200">
                            <span className="text-xs font-bold text-blue-900">Xem ngày:</span>
                            <Select
                                value={detailedDayFilter}
                                onChange={setDetailedDayFilter}
                                className="w-52 text-xs"
                                options={[
                                    { label: `⭐ Hôm nay (${dayjs().format('DD/MM')})`, value: 'TODAY' },
                                    { label: `📅 Cả tuần (${dayjs(mondayStr).format('DD/MM')} - ${dayjs(sundayStr).format('DD/MM')})`, value: 'ALL' },
                                    ...weekDays.map((d: any) => ({
                                        label: `${d.dayName} (${d.formattedDate})` + (d.isToday ? ' (Hôm nay)' : ''),
                                        value: d.dateStr
                                    }))
                                ]}
                            />
                        </div>
                    )}

                    {/* Lọc khoa */}
                    <Select
                        value={selectedDept}
                        onChange={setSelectedDept}
                        options={deptOptions}
                        className="w-64 text-xs"
                        showSearch
                        optionFilterProp="label"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Switch: Chỉ hiện khoa có lịch trực */}
                    <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded border border-slate-200 text-xs">
                        <Switch
                            checked={onlyWithDuties}
                            onChange={setOnlyWithDuties}
                            size="small"
                            className="bg-slate-300"
                        />
                        <span className="font-semibold text-slate-700">Chỉ hiện khoa có lịch trực</span>
                    </div>

                    {/* Ô tìm kiếm nhanh */}
                    <Input
                        placeholder="Tìm Bác sĩ, ĐD, Tên cán bộ, Khoa..."
                        prefix={<SearchOutlined className="text-slate-400" />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        allowClear
                        className="w-64 text-xs"
                    />

                    <Button
                        icon={<ReloadOutlined />}
                        onClick={fetchSchedule}
                        loading={loading}
                        size="middle"
                        title="Tải lại dữ liệu"
                    />
                </div>
            </div>

            {/* Thống kê nhanh */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-900 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-4">
                    <span>
                        🏢 Khoa có lịch trực: <strong className="text-blue-950 font-black">{departments.length}</strong> khoa
                        {scheduleData && !onlyWithDuties && (
                            <span className="text-slate-500 font-normal"> / {scheduleData.totalAllDepartments} khoa toàn viện</span>
                        )}
                    </span>
                    <span className="text-blue-300">|</span>
                    <span>
                        📅 Tổng số lượt phân trực: <strong className="text-emerald-700 font-black">{scheduleData?.totalDuties ?? 0}</strong> lượt
                    </span>
                    <span className="text-blue-300">|</span>
                    <span className="text-slate-600 italic">
                        💡 Hiển thị theo định dạng: <strong>[Trình độ / Chức danh] - [Họ tên]</strong>.
                    </span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" />
                        <span>Trực chính</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="text-blue-600 font-bold">[Kèm]</span>
                        <span>Trực kèm</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="text-purple-600 font-bold">[T.Trú]</span>
                        <span>Thường trú</span>
                    </span>
                </div>
            </div>

            {/* Bảng lịch trực (Hiển thị Mẫu 2 hoặc Mẫu 1 tương ứng) */}
            <Spin spinning={loading}>
                <div className="bg-white rounded-lg overflow-hidden print-table-container">
                    {viewTemplate === 'DETAILED_LIST' ? (
                        <Table
                            columns={detailedColumns}
                            dataSource={detailedRows}
                            rowKey="key"
                            pagination={false}
                            size="small"
                            bordered
                            scroll={{ x: 'max-content', y: 650 }}
                            className="duty-schedule-table"
                            locale={{
                                emptyText: (
                                    <div className="py-8 text-center text-slate-500 text-xs">
                                        <div className="text-2xl mb-1">📅</div>
                                        <div>Không có ca trực nào trong ngày/khoa được chọn.</div>
                                        <div className="text-slate-400 mt-1">
                                            Hãy thử chọn ngày khác hoặc tắt tùy chọn <em>"Chỉ hiện khoa có lịch trực"</em>.
                                        </div>
                                    </div>
                                )
                            }}
                        />
                    ) : (
                        <Table
                            columns={columns}
                            dataSource={filteredDepartments}
                            rowKey="ma_khoa"
                            pagination={false}
                            size="small"
                            bordered
                            scroll={{ x: 'max-content', y: 650 }}
                            className="duty-schedule-table"
                            locale={{
                                emptyText: (
                                    <div className="py-8 text-center text-slate-500 text-xs">
                                        <div className="text-2xl mb-1">📅</div>
                                        <div>Không tìm thấy khoa/phòng nào có lịch trực trong tuần này.</div>
                                        <div className="text-slate-400 mt-1">
                                            Hãy thử tắt tùy chọn <em>"Chỉ hiện khoa có lịch trực"</em> hoặc chọn tuần khác.
                                        </div>
                                    </div>
                                )
                            }}
                        />
                    )}
                </div>
            </Spin>

            {/* CSS Tùy chỉnh màu viền đen #000 & In ấn */}
            <style dangerouslySetInnerHTML={{ __html: `
                /* Triệt tiêu hoàn toàn dòng ẩn đo đạc của Ant Design */
                .duty-schedule-table tr.ant-table-measure-row,
                .duty-schedule-table tr.ant-table-measure-row td,
                .duty-schedule-table tr.ant-table-measure-row th {
                    padding: 0 !important;
                    border: none !important;
                    height: 0 !important;
                    font-size: 0 !important;
                    line-height: 0 !important;
                    visibility: hidden !important;
                }

                /* 1. Thiết lập viền đen sắc nét đúng 1px duy nhất cho toàn bộ bảng */
                .duty-schedule-table.ant-table-wrapper .ant-table-container {
                    border-top: 1px solid #000000 !important;
                    border-left: 1px solid #000000 !important;
                    border-right: none !important;
                    border-bottom: none !important;
                }

                .duty-schedule-table tr:not(.ant-table-measure-row) > .ant-table-cell {
                    border-color: #000000 !important;
                }

                .duty-schedule-table.ant-table-wrapper .ant-table.ant-table-bordered > .ant-table-container > .ant-table-header > table > thead > tr > th,
                .duty-schedule-table.ant-table-wrapper .ant-table.ant-table-bordered > .ant-table-container > .ant-table-body > table > tbody > tr:not(.ant-table-measure-row) > td,
                .duty-schedule-table.ant-table-wrapper .ant-table.ant-table-bordered > .ant-table-container > .ant-table-content > table > thead > tr > th,
                .duty-schedule-table.ant-table-wrapper .ant-table.ant-table-bordered > .ant-table-container > .ant-table-content > table > tbody > tr:not(.ant-table-measure-row) > td,
                .duty-schedule-table .ant-table-thead > tr > th,
                .duty-schedule-table .ant-table-tbody > tr:not(.ant-table-measure-row) > td {
                    border-right: 1px solid #000000 !important;
                    border-bottom: 1px solid #000000 !important;
                    border-top: none !important;
                    border-left: none !important;
                }

                .duty-schedule-table .ant-table-thead > tr > th {
                    background-color: #f8fafc !important;
                    color: #0f172a !important;
                }

                /* Cột cố định STT và Tên khoa phòng */
                .duty-schedule-table .ant-table-cell-fix-left,
                .duty-schedule-table .ant-table-cell-fix-left-last {
                    border-right: 1px solid #000000 !important;
                }

                .duty-schedule-table .ant-table-cell-fix-left-last::after {
                    border-right: 1px solid #000000 !important;
                    box-shadow: none !important;
                }

                @media print {
                    body {
                        background: white !important;
                    }
                    /* Ẩn các nút điều khiển khi in */
                    button, .ant-btn, .ant-input-affix-wrapper, .ant-select, .ant-switch, .no-print {
                        display: none !important;
                    }
                    .print-table-container {
                        box-shadow: none !important;
                        border: none !important;
                    }
                    .duty-schedule-table .ant-table {
                        font-size: 10px !important;
                        border: 1px solid #000000 !important;
                    }
                    .duty-schedule-table .ant-table-cell {
                        border: 1px solid #000000 !important;
                    }
                }
            ` }} />
        </div>
    );
}

