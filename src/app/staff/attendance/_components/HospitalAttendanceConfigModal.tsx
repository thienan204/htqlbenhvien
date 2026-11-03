'use client';

import React, { useState, useEffect } from 'react';
import { 
    Modal, 
    Tabs, 
    Table, 
    Button, 
    Input, 
    DatePicker, 
    Select, 
    Tag, 
    Space, 
    Popconfirm, 
    message, 
    Tooltip, 
    Alert, 
    Switch, 
    InputNumber 
} from 'antd';
import { 
    SettingOutlined, 
    PlusOutlined, 
    DeleteOutlined, 
    SaveOutlined, 
    InfoCircleOutlined, 
    CalendarOutlined, 
    ClockCircleOutlined,
    SearchOutlined,
    ApartmentOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useAttendance } from '../AttendanceContext';

const { RangePicker } = DatePicker;

interface HolidayItem {
    id: string;
    date: string; // 'YYYY-MM-DD'
    name: string;
    allowanceDays: number;
}

interface MakeupWorkdayItem {
    id: string;
    date: string; // 'YYYY-MM-DD'
    description: string;
}

interface WorkHoursConfig {
    morningStart: string;
    morningEnd: string;
    afternoonStart: string;
    afternoonEnd: string;
    standardDailyHours: number;
}

interface CheckInRulesConfig {
    checkInWindowMinutes: number;
    lateToleranceMinutes: number;
    cutOffMinutes: number;
    earlyLeaveToleranceMinutes: number;
    checkOutWindowEndHour: string;
    requireInternalNetwork: boolean;
    allowedSubnets: string;
    defaultMode: 'HYBRID' | 'WEB_ONLY' | 'BIOMETRIC_ONLY' | 'MANUAL';
}

interface DeptAttendanceConfig {
    mode: 'HYBRID' | 'WEB_ONLY' | 'BIOMETRIC_ONLY' | 'MANUAL';
    zkDeviceId?: string;
    allowedSubnets?: string;
}

interface DepartmentItem {
    ma_khoa: string;
    ten_khoa: string;
    type?: string;
}

interface HospitalAttendanceConfigModalProps {
    open: boolean;
    onClose: () => void;
}

export const HospitalAttendanceConfigModal: React.FC<HospitalAttendanceConfigModalProps> = ({ open, onClose }) => {
    const { fetchData } = useAttendance();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Dữ liệu cấu hình
    const [holidays, setHolidays] = useState<HolidayItem[]>([]);
    const [makeupWorkdays, setMakeupWorkdays] = useState<MakeupWorkdayItem[]>([]);
    const [workHours, setWorkHours] = useState<WorkHoursConfig>({
        morningStart: '07:00',
        morningEnd: '11:30',
        afternoonStart: '13:30',
        afternoonEnd: '17:00',
        standardDailyHours: 8.0
    });

    const [checkInRules, setCheckInRules] = useState<CheckInRulesConfig>({
        checkInWindowMinutes: 60,
        lateToleranceMinutes: 15,
        cutOffMinutes: 90,
        earlyLeaveToleranceMinutes: 15,
        checkOutWindowEndHour: '20:00',
        requireInternalNetwork: false,
        allowedSubnets: '',
        defaultMode: 'HYBRID'
    });

    const [departments, setDepartments] = useState<DepartmentItem[]>([]);
    const [departmentConfigs, setDepartmentConfigs] = useState<Record<string, DeptAttendanceConfig>>({});
    const [deptSearchText, setDeptSearchText] = useState('');

    // Form thêm ngày lễ
    const [holidayDateType, setHolidayDateType] = useState<'SINGLE' | 'RANGE'>('SINGLE');
    const [singleHolidayDate, setSingleHolidayDate] = useState<Dayjs | null>(null);
    const [rangeHolidayDates, setRangeHolidayDates] = useState<[Dayjs | null, Dayjs | null] | null>(null);
    const [holidayNameInput, setHolidayNameInput] = useState('');
    const [holidayAllowanceInput, setHolidayAllowanceInput] = useState<number>(2.0);

    // Form thêm ngày làm bù
    const [makeupDateInput, setMakeupDateInput] = useState<Dayjs | null>(null);
    const [makeupDescInput, setMakeupDescInput] = useState('');

    const getBasePath = () => {
        if (typeof window !== 'undefined') {
            const parts = window.location.pathname.split('/staff');
            return parts.length > 1 ? parts[0] : '';
        }
        return '';
    };

    const loadConfig = async () => {
        try {
            setLoading(true);
            const basePath = getBasePath();
            const res = await fetch(`${basePath}/api/staff/attendance/config`);
            if (res.ok) {
                const data = await res.json();
                if (data.config) {
                    setHolidays(data.config.holidays || []);
                    setMakeupWorkdays(data.config.makeupWorkdays || []);
                    if (data.config.workHours) setWorkHours(data.config.workHours);
                    if (data.config.checkInRules) setCheckInRules(data.config.checkInRules);
                    if (data.config.departmentConfigs) setDepartmentConfigs(data.config.departmentConfigs);
                }
                if (Array.isArray(data.departments)) {
                    setDepartments(data.departments);
                }
            } else {
                message.error('Không thể tải cấu hình toàn viện');
            }
        } catch (e) {
            console.error('Lỗi tải cấu hình:', e);
            message.error('Lỗi kết nối khi tải cấu hình');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadConfig();
        }
    }, [open]);

    // Thêm ngày lễ mới
    const handleAddHoliday = () => {
        if (!holidayNameInput.trim()) {
            message.warning('Vui lòng nhập tên ngày Lễ / Tết');
            return;
        }

        const newItems: HolidayItem[] = [];

        if (holidayDateType === 'SINGLE') {
            if (!singleHolidayDate) {
                message.warning('Vui lòng chọn ngày nghỉ Lễ');
                return;
            }
            const dateStr = singleHolidayDate.format('YYYY-MM-DD');
            if (holidays.some(h => h.date === dateStr)) {
                message.warning(`Ngày ${singleHolidayDate.format('DD/MM/YYYY')} đã có trong danh sách ngày lễ`);
                return;
            }
            newItems.push({
                id: `h_${Date.now()}`,
                date: dateStr,
                name: holidayNameInput.trim(),
                allowanceDays: holidayAllowanceInput
            });
        } else {
            if (!rangeHolidayDates || !rangeHolidayDates[0] || !rangeHolidayDates[1]) {
                message.warning('Vui lòng chọn dải ngày bắt đầu và kết thúc');
                return;
            }
            let curr = rangeHolidayDates[0].clone();
            const end = rangeHolidayDates[1].clone();
            let idx = 0;

            while (curr.isBefore(end) || curr.isSame(end, 'day')) {
                const dateStr = curr.format('YYYY-MM-DD');
                if (!holidays.some(h => h.date === dateStr) && !newItems.some(h => h.date === dateStr)) {
                    newItems.push({
                        id: `h_${Date.now()}_${idx++}`,
                        date: dateStr,
                        name: `${holidayNameInput.trim()} (Ngày ${curr.format('DD/MM')})`,
                        allowanceDays: holidayAllowanceInput
                    });
                }
                curr = curr.add(1, 'day');
            }
        }

        if (newItems.length === 0) {
            message.info('Các ngày bạn chọn đã có sẵn trong danh sách!');
            return;
        }

        const updated = [...holidays, ...newItems].sort((a, b) => a.date.localeCompare(b.date));
        setHolidays(updated);
        setHolidayNameInput('');
        setSingleHolidayDate(null);
        setRangeHolidayDates(null);
        message.success(`Đã thêm ${newItems.length} ngày nghỉ Lễ vào danh sách tạm!`);
    };

    // Xóa ngày lễ
    const handleDeleteHoliday = (id: string) => {
        setHolidays(prev => prev.filter(h => h.id !== id));
        message.info('Đã xóa ngày lễ khỏi danh sách');
    };

    // Thêm ngày làm bù
    const handleAddMakeupWorkday = () => {
        if (!makeupDateInput) {
            message.warning('Vui lòng chọn ngày Thứ Bảy hoặc Chủ Nhật làm bù');
            return;
        }
        const dateStr = makeupDateInput.format('YYYY-MM-DD');
        const dayOfWeek = makeupDateInput.day();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            message.warning('Chỉ ngày Thứ Bảy hoặc Chủ Nhật mới cần thiết lập làm bù!');
            return;
        }

        if (makeupWorkdays.some(m => m.date === dateStr)) {
            message.warning(`Ngày ${makeupDateInput.format('DD/MM/YYYY')} đã có trong danh sách làm bù`);
            return;
        }

        const newItem: MakeupWorkdayItem = {
            id: `m_${Date.now()}`,
            date: dateStr,
            description: makeupDescInput.trim() || `Làm bù ngày ${makeupDateInput.format('DD/MM/YYYY')}`
        };

        const updated = [...makeupWorkdays, newItem].sort((a, b) => a.date.localeCompare(b.date));
        setMakeupWorkdays(updated);
        setMakeupDateInput(null);
        setMakeupDescInput('');
        message.success('Đã thêm ngày làm bù Thứ 7, CN vào danh sách tạm!');
    };

    // Xóa ngày làm bù
    const handleDeleteMakeupWorkday = (id: string) => {
        setMakeupWorkdays(prev => prev.filter(m => m.id !== id));
        message.info('Đã xóa ngày làm bù khỏi danh sách');
    };

    // Cập nhật chế độ chấm công của 1 khoa
    const handleUpdateDeptMode = (ma_khoa: string, mode: 'HYBRID' | 'WEB_ONLY' | 'BIOMETRIC_ONLY' | 'MANUAL') => {
        setDepartmentConfigs(prev => ({
            ...prev,
            [ma_khoa]: {
                ...(prev[ma_khoa] || {}),
                mode
            }
        }));
    };

    // Cập nhật mã thiết bị ZK của 1 khoa
    const handleUpdateDeptZkDevice = (ma_khoa: string, zkDeviceId: string) => {
        setDepartmentConfigs(prev => ({
            ...prev,
            [ma_khoa]: {
                ...(prev[ma_khoa] || { mode: checkInRules.defaultMode || 'HYBRID' }),
                zkDeviceId
            }
        }));
    };

    // Thiết lập nhanh toàn bộ các khoa sang 1 chế độ
    const handleBulkApplyMode = (mode: 'HYBRID' | 'WEB_ONLY' | 'BIOMETRIC_ONLY' | 'MANUAL') => {
        const next: Record<string, DeptAttendanceConfig> = {};
        departments.forEach(dept => {
            next[dept.ma_khoa] = {
                ...(departmentConfigs[dept.ma_khoa] || {}),
                mode
            };
        });
        setDepartmentConfigs(next);
        message.success(`Đã áp dụng hình thức cho toàn bộ ${departments.length} khoa phòng!`);
    };

    // Lưu cấu hình
    const handleSaveConfig = async () => {
        try {
            setSaving(true);
            const basePath = getBasePath();
            const res = await fetch(`${basePath}/api/staff/attendance/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    holidays,
                    makeupWorkdays,
                    workHours,
                    checkInRules,
                    departmentConfigs
                })
            });

            if (!res.ok) {
                try {
                    const err = await res.json();
                    message.error(err.error || 'Lưu cấu hình thất bại');
                } catch {
                    message.error('Máy chủ phản hồi lỗi');
                }
                return;
            }

            const data = await res.json();
            if (data.success) {
                message.success('Đã lưu cấu hình và đồng bộ toàn viện thành công!');
                fetchData();
                onClose();
            } else {
                message.error(data.error || 'Lưu thất bại');
            }
        } catch (e) {
            console.error('Lỗi lưu cấu hình toàn viện:', e);
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setSaving(false);
        }
    };

    // Cột bảng Ngày Lễ
    const holidayColumns = [
        {
            title: 'STT',
            width: 50,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => index + 1
        },
        {
            title: 'Ngày Nghỉ Lễ',
            dataIndex: 'date',
            key: 'date',
            width: 120,
            render: (val: string) => {
                const d = dayjs(val);
                return (
                    <span className="font-bold text-slate-800">
                        {d.format('DD/MM/YYYY')}
                    </span>
                );
            }
        },
        {
            title: 'Thứ',
            dataIndex: 'date',
            key: 'dayOfWeek',
            width: 90,
            render: (val: string) => {
                const day = dayjs(val).day();
                if (day === 0) return <Tag color="error">Chủ Nhật</Tag>;
                if (day === 6) return <Tag color="warning">Thứ Bảy</Tag>;
                return <span className="text-slate-600 font-medium">Thứ {day + 1}</span>;
            }
        },
        {
            title: 'Tên Dịp Lễ / Tết',
            dataIndex: 'name',
            key: 'name',
            render: (val: string) => (
                <span className="font-semibold text-purple-900">
                    🎉 {val}
                </span>
            )
        },
        {
            title: 'Chế Độ Nghỉ Bù',
            dataIndex: 'allowanceDays',
            key: 'allowanceDays',
            width: 140,
            render: (val: number) => (
                val >= 2.0 ? (
                    <Tag color="magenta" className="font-bold">⭐ Bù 2 ngày (300%)</Tag>
                ) : (
                    <Tag color="blue" className="font-medium">1 ngày bù</Tag>
                )
            )
        },
        {
            title: 'Thao Tác',
            key: 'action',
            width: 80,
            align: 'center' as const,
            render: (_: any, record: HolidayItem) => (
                <Popconfirm
                    title="Xóa ngày nghỉ lễ này?"
                    okText="Xóa"
                    cancelText="Hủy"
                    onConfirm={() => handleDeleteHoliday(record.id)}
                >
                    <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                    />
                </Popconfirm>
            )
        }
    ];

    // Cột bảng Làm Bù
    const makeupColumns = [
        {
            title: 'STT',
            width: 50,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => index + 1
        },
        {
            title: 'Ngày Làm Bù',
            dataIndex: 'date',
            key: 'date',
            width: 130,
            render: (val: string) => {
                const d = dayjs(val);
                return (
                    <span className="font-bold text-emerald-800">
                        💼 {d.format('DD/MM/YYYY')}
                    </span>
                );
            }
        },
        {
            title: 'Thứ',
            dataIndex: 'date',
            key: 'dayOfWeek',
            width: 100,
            render: (val: string) => {
                const day = dayjs(val).day();
                return day === 0 ? <Tag color="error">Chủ Nhật</Tag> : <Tag color="warning">Thứ Bảy</Tag>;
            }
        },
        {
            title: 'Lý Do Làm Bù / Nội Dung',
            dataIndex: 'description',
            key: 'description',
            render: (val: string) => <span className="font-medium text-slate-700">{val}</span>
        },
        {
            title: 'Thao Tác',
            key: 'action',
            width: 80,
            align: 'center' as const,
            render: (_: any, record: MakeupWorkdayItem) => (
                <Popconfirm
                    title="Xóa ngày làm bù này?"
                    okText="Xóa"
                    cancelText="Hủy"
                    onConfirm={() => handleDeleteMakeupWorkday(record.id)}
                >
                    <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                    />
                </Popconfirm>
            )
        }
    ];

    // Lọc danh sách khoa phòng
    const filteredDepartments = departments.filter(d => {
        if (!deptSearchText.trim()) return true;
        const q = deptSearchText.toLowerCase();
        return (d.ma_khoa || '').toLowerCase().includes(q) || (d.ten_khoa || '').toLowerCase().includes(q);
    });

    // Cột bảng cấu hình theo khoa phòng
    const deptColumns = [
        {
            title: 'STT',
            width: 50,
            align: 'center' as const,
            render: (_: any, __: any, idx: number) => idx + 1
        },
        {
            title: 'Mã Khoa',
            dataIndex: 'ma_khoa',
            key: 'ma_khoa',
            width: 90,
            render: (val: string) => <span className="font-bold text-blue-700">{val}</span>
        },
        {
            title: 'Tên Khoa / Phòng',
            dataIndex: 'ten_khoa',
            key: 'ten_khoa',
            render: (val: string, record: DepartmentItem) => (
                <div>
                    <span className="font-semibold text-slate-800">{val}</span>
                    {record.type && (
                        <span className="ml-2 text-[11px] text-slate-400">({record.type})</span>
                    )}
                </div>
            )
        },
        {
            title: 'Hình Thức Chấm Công Áp Dụng',
            key: 'mode',
            width: 280,
            render: (_: any, record: DepartmentItem) => {
                const currentMode = departmentConfigs[record.ma_khoa]?.mode || checkInRules.defaultMode || 'HYBRID';
                return (
                    <Select
                        value={currentMode}
                        onChange={(val: any) => handleUpdateDeptMode(record.ma_khoa, val)}
                        className="w-full text-xs"
                        options={[
                            {
                                value: 'HYBRID',
                                label: <span className="text-emerald-700 font-semibold">⚡ Cả Web và ZKTeco (Linh hoạt)</span>
                            },
                            {
                                value: 'WEB_ONLY',
                                label: <span className="text-blue-700 font-semibold">🌐 Chỉ dùng Web (Nút bấm)</span>
                            },
                            {
                                value: 'BIOMETRIC_ONLY',
                                label: <span className="text-purple-700 font-semibold">👆 Chỉ Máy vân tay ZKTeco</span>
                            },
                            {
                                value: 'MANUAL',
                                label: <span className="text-slate-500 font-medium">📝 Chấm tay / Quản lý chấm</span>
                            }
                        ]}
                    />
                );
            }
        },
        {
            title: 'Mã Máy ZKTeco (Vân tay)',
            key: 'zkDeviceId',
            width: 160,
            render: (_: any, record: DepartmentItem) => {
                const val = departmentConfigs[record.ma_khoa]?.zkDeviceId || '';
                return (
                    <Input
                        size="small"
                        placeholder="VD: ZK-CC-01"
                        value={val}
                        onChange={e => handleUpdateDeptZkDevice(record.ma_khoa, e.target.value)}
                        className="text-xs font-mono"
                    />
                );
            }
        }
    ];

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                    <SettingOutlined className="text-blue-600" />
                    <span>Cấu Hình Chấm Công, Ngày Nghỉ Lễ & Quy Định Khoa Phòng Toàn Viện</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            width={940}
            destroyOnHidden
            footer={[
                <Button key="cancel" onClick={onClose} disabled={saving}>
                    Đóng
                </Button>,
                <Button
                    key="save"
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={handleSaveConfig}
                    className="bg-blue-600 hover:bg-blue-500 font-medium"
                >
                    Lưu Cấu Hình Toàn Viện
                </Button>
            ]}
        >
            <div className="py-2">
                <Alert
                    type="info"
                    showIcon
                    icon={<InfoCircleOutlined className="text-blue-600" />}
                    title={<span className="font-semibold text-blue-900">Cấu hình cấp Bệnh viện (Áp dụng cho tất cả các khoa/phòng)</span>}
                    description={
                        <span className="text-xs text-blue-800">
                            Các quy định về khung giờ, ngày nghỉ lễ và hình thức tự chấm công (Web/Vân tay ZKTeco) cấu hình tại đây sẽ <b>tự động liên thông</b> sang Bảng Chấm Công, Bảng Chấm Trực và chức năng tự chấm công của từng nhân viên.
                        </span>
                    }
                    className="mb-4 bg-blue-50/80 border-blue-200"
                />

                <Tabs
                    type="card"
                    items={[
                        {
                            key: 'HOLIDAYS',
                            label: (
                                <span className="font-semibold px-2">
                                    🏖️ 1. Ngày Nghỉ Lễ, Tết & Hoán Đổi ({holidays.length})
                                </span>
                            ),
                            children: (
                                <div className="space-y-4">
                                    {/* Khung Thêm Ngày Lễ */}
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                                        <div className="font-semibold text-slate-700 text-xs flex items-center justify-between">
                                            <span>➕ Thêm Ngày Nghỉ Lễ / Tết Mới Vào Lịch Toàn Viện:</span>
                                            <Space size="small">
                                                <Button
                                                    size="small"
                                                    type={holidayDateType === 'SINGLE' ? 'primary' : 'default'}
                                                    onClick={() => setHolidayDateType('SINGLE')}
                                                    className="text-xs"
                                                >
                                                    Chọn 1 ngày
                                                </Button>
                                                <Button
                                                    size="small"
                                                    type={holidayDateType === 'RANGE' ? 'primary' : 'default'}
                                                    onClick={() => setHolidayDateType('RANGE')}
                                                    className="text-xs"
                                                >
                                                    Chọn dải ngày (Nghỉ Tết)
                                                </Button>
                                            </Space>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                                            <div className="md:col-span-5">
                                                {holidayDateType === 'SINGLE' ? (
                                                    <DatePicker
                                                        className="w-full"
                                                        format="DD/MM/YYYY"
                                                        placeholder="Chọn ngày Lễ"
                                                        value={singleHolidayDate}
                                                        onChange={val => setSingleHolidayDate(val)}
                                                    />
                                                ) : (
                                                    <RangePicker
                                                        className="w-full"
                                                        format="DD/MM/YYYY"
                                                        placeholder={['Từ ngày', 'Đến ngày']}
                                                        value={rangeHolidayDates}
                                                        onChange={val => setRangeHolidayDates(val)}
                                                    />
                                                )}
                                            </div>
                                            <div className="md:col-span-4">
                                                <Input
                                                    placeholder="Tên ngày Lễ (VD: Tết Nguyên Đán, Giỗ Tổ Hùng Vương...)"
                                                    value={holidayNameInput}
                                                    onChange={e => setHolidayNameInput(e.target.value)}
                                                    onPressEnter={handleAddHoliday}
                                                />
                                            </div>
                                            <div className="md:col-span-3 flex items-center gap-2">
                                                <Select
                                                    value={holidayAllowanceInput}
                                                    onChange={val => setHolidayAllowanceInput(val)}
                                                    className="w-28 text-xs"
                                                    options={[
                                                        { value: 2.0, label: '⭐ 2 ngày bù' },
                                                        { value: 1.0, label: '1 ngày bù' }
                                                    ]}
                                                />
                                                <Button
                                                    type="primary"
                                                    icon={<PlusOutlined />}
                                                    onClick={handleAddHoliday}
                                                    className="bg-purple-600 hover:bg-purple-500 font-medium"
                                                >
                                                    Thêm
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bảng Danh Sách Ngày Lễ */}
                                    <Table
                                        columns={holidayColumns}
                                        dataSource={holidays}
                                        rowKey="id"
                                        size="small"
                                        pagination={{ pageSize: 8, showSizeChanger: true }}
                                        bordered
                                        loading={loading}
                                    />
                                </div>
                            )
                        },
                        {
                            key: 'MAKEUP_WORKDAYS',
                            label: (
                                <span className="font-semibold px-2">
                                    💼 2. Ngày Làm Bù Thứ 7, CN ({makeupWorkdays.length})
                                </span>
                            ),
                            children: (
                                <div className="space-y-4">
                                    {/* Khung Thêm Ngày Làm Bù */}
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                                        <div className="font-semibold text-slate-700 text-xs">
                                            ➕ Thêm Ngày Làm Bù Thứ Bảy, Chủ Nhật:
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                                            <div className="md:col-span-4">
                                                <DatePicker
                                                    className="w-full"
                                                    format="DD/MM/YYYY"
                                                    placeholder="Chọn ngày T7/CN làm bù"
                                                    value={makeupDateInput}
                                                    onChange={val => setMakeupDateInput(val)}
                                                />
                                            </div>
                                            <div className="md:col-span-6">
                                                <Input
                                                    placeholder="Nội dung làm bù (VD: Làm bù Thứ Bảy cho dịp 30/4)"
                                                    value={makeupDescInput}
                                                    onChange={e => setMakeupDescInput(e.target.value)}
                                                    onPressEnter={handleAddMakeupWorkday}
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <Button
                                                    type="primary"
                                                    icon={<PlusOutlined />}
                                                    onClick={handleAddMakeupWorkday}
                                                    className="w-full bg-emerald-600 hover:bg-emerald-500 font-medium"
                                                >
                                                    Thêm
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bảng Danh Sách Ngày Làm Bù */}
                                    <Table
                                        columns={makeupColumns}
                                        dataSource={makeupWorkdays}
                                        rowKey="id"
                                        size="small"
                                        pagination={{ pageSize: 8 }}
                                        bordered
                                        loading={loading}
                                    />
                                </div>
                            )
                        },
                        {
                            key: 'WORK_HOURS',
                            label: (
                                <span className="font-semibold px-2">
                                    ⏰ 3. Khung Giờ Hành Chính Chuẩn
                                </span>
                            ),
                            children: (
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 text-xs">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                                <span>☀️ Ca Sáng:</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={workHours.morningStart}
                                                    onChange={e => setWorkHours(prev => ({ ...prev, morningStart: e.target.value }))}
                                                    className="text-center font-bold text-blue-700 w-24"
                                                    placeholder="07:00"
                                                />
                                                <span>đến</span>
                                                <Input
                                                    value={workHours.morningEnd}
                                                    onChange={e => setWorkHours(prev => ({ ...prev, morningEnd: e.target.value }))}
                                                    className="text-center font-bold text-blue-700 w-24"
                                                    placeholder="11:30"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                                <span>🌤️ Ca Chiều:</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={workHours.afternoonStart}
                                                    onChange={e => setWorkHours(prev => ({ ...prev, afternoonStart: e.target.value }))}
                                                    className="text-center font-bold text-blue-700 w-24"
                                                    placeholder="13:30"
                                                />
                                                <span>đến</span>
                                                <Input
                                                    value={workHours.afternoonEnd}
                                                    onChange={e => setWorkHours(prev => ({ ...prev, afternoonEnd: e.target.value }))}
                                                    className="text-center font-bold text-blue-700 w-24"
                                                    placeholder="17:00"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200 text-blue-900 leading-relaxed">
                                        <p className="font-semibold mb-1">🏥 Quy định ca trực Bệnh viện:</p>
                                        <p>• Ca trực chính bệnh viện được tính <b>24/24</b> (từ 07:00 sáng hôm nay đến 07:00 sáng hôm sau).</p>
                                        <p>• Trực ngày Lễ/Tết hưởng <b>2 ngày nghỉ bù (hoặc phụ cấp 300%)</b> theo QĐ 73/2011/QĐ-TTg của Thủ tướng Chính phủ.</p>
                                    </div>
                                </div>
                            )
                        },
                        {
                            key: 'DEPT_ATTENDANCE',
                            label: (
                                <span className="font-semibold px-2 text-indigo-700">
                                    🏢 4. Quy Định & Cấu Hình Theo Khoa/Phòng ({departments.length})
                                </span>
                            ),
                            children: (
                                <div className="space-y-4 text-xs">
                                    {/* Khung Quy Định Dung Sai Thời Gian Chấm Công */}
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                            <ClockCircleOutlined className="text-blue-600" />
                                            <span>Quy định Khung giờ, Dung sai Đi muộn / Về sớm (Áp dụng toàn viện):</span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200">
                                            <div>
                                                <label className="text-slate-600 block mb-1 font-medium">
                                                    Mở bấm Vào ca trước giờ làm:
                                                </label>
                                                <div className="flex items-center gap-1.5">
                                                    <InputNumber
                                                        min={10}
                                                        max={180}
                                                        value={checkInRules.checkInWindowMinutes}
                                                        onChange={val => setCheckInRules(prev => ({ ...prev, checkInWindowMinutes: val || 60 }))}
                                                        className="w-24"
                                                    />
                                                    <span className="text-slate-500">phút (VD: từ 06:00)</span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-slate-600 block mb-1 font-medium">
                                                    Dung sai Đi muộn (vẫn tính đúng):
                                                </label>
                                                <div className="flex items-center gap-1.5">
                                                    <InputNumber
                                                        min={0}
                                                        max={60}
                                                        value={checkInRules.lateToleranceMinutes}
                                                        onChange={val => setCheckInRules(prev => ({ ...prev, lateToleranceMinutes: val || 15 }))}
                                                        className="w-24 font-bold text-emerald-700"
                                                    />
                                                    <span className="text-slate-500">phút (đến 07:15)</span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-slate-600 block mb-1 font-medium">
                                                    Giờ chót tự bấm Vào ca:
                                                </label>
                                                <div className="flex items-center gap-1.5">
                                                    <InputNumber
                                                        min={30}
                                                        max={240}
                                                        value={checkInRules.cutOffMinutes}
                                                        onChange={val => setCheckInRules(prev => ({ ...prev, cutOffMinutes: val || 90 }))}
                                                        className="w-24 font-bold text-rose-700"
                                                    />
                                                    <span className="text-slate-500">phút (sau đó khóa)</span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-slate-600 block mb-1 font-medium">
                                                    Cho phép về sớm tối đa:
                                                </label>
                                                <div className="flex items-center gap-1.5">
                                                    <InputNumber
                                                        min={0}
                                                        max={60}
                                                        value={checkInRules.earlyLeaveToleranceMinutes}
                                                        onChange={val => setCheckInRules(prev => ({ ...prev, earlyLeaveToleranceMinutes: val || 15 }))}
                                                        className="w-24"
                                                    />
                                                    <span className="text-slate-500">phút (từ 16:45)</span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-slate-600 block mb-1 font-medium">
                                                    Giờ kết thúc khung bấm Tan ca:
                                                </label>
                                                <Input
                                                    value={checkInRules.checkOutWindowEndHour}
                                                    onChange={e => setCheckInRules(prev => ({ ...prev, checkOutWindowEndHour: e.target.value }))}
                                                    className="w-24 text-center font-bold text-blue-700"
                                                    placeholder="20:00"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-slate-600 block mb-1 font-medium">
                                                    Chế độ mặc định khoa chưa cấu hình:
                                                </label>
                                                <Select
                                                    value={checkInRules.defaultMode}
                                                    onChange={(val: any) => setCheckInRules(prev => ({ ...prev, defaultMode: val }))}
                                                    className="w-full"
                                                    options={[
                                                        { value: 'HYBRID', label: '⚡ Cả Web và ZKTeco (Linh hoạt)' },
                                                        { value: 'WEB_ONLY', label: '🌐 Chỉ dùng Web (Nút bấm)' },
                                                        { value: 'BIOMETRIC_ONLY', label: '👆 Chỉ Máy vân tay ZKTeco' },
                                                        { value: 'MANUAL', label: '📝 Chấm tay / Quản lý chấm' }
                                                    ]}
                                                />
                                            </div>
                                        </div>

                                        {/* Kiểm tra IP Mạng nội bộ */}
                                        <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-slate-800 flex items-center gap-2">
                                                    <span>🔒 Bắt buộc kết nối WiFi / Mạng LAN Bệnh viện:</span>
                                                    <Switch
                                                        checked={checkInRules.requireInternalNetwork}
                                                        onChange={checked => setCheckInRules(prev => ({ ...prev, requireInternalNetwork: checked }))}
                                                    />
                                                </div>
                                                <p className="text-slate-500 text-[11px]">
                                                    Nếu bật, nhân viên chỉ có thể tự chấm công khi đang kết nối mạng nội bộ của viện (chống chấm hộ từ xa).
                                                </p>
                                            </div>

                                            {checkInRules.requireInternalNetwork && (
                                                <div className="w-full md:w-72">
                                                    <Input
                                                        placeholder="Dải IP nội bộ (VD: 192.168.1., 10.0.)"
                                                        value={checkInRules.allowedSubnets}
                                                        onChange={e => setCheckInRules(prev => ({ ...prev, allowedSubnets: e.target.value }))}
                                                        size="small"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bảng Danh Sách Khoa Phòng */}
                                    <div className="space-y-2">
                                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    prefix={<SearchOutlined className="text-slate-400" />}
                                                    placeholder="Tìm theo mã hoặc tên khoa..."
                                                    value={deptSearchText}
                                                    onChange={e => setDeptSearchText(e.target.value)}
                                                    className="w-64"
                                                    size="small"
                                                    allowClear
                                                />
                                                <span className="text-slate-500 text-xs">
                                                    ({filteredDepartments.length} khoa/phòng)
                                                </span>
                                            </div>

                                            {/* Nút áp dụng nhanh */}
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-slate-500 text-xs">Áp dụng nhanh:</span>
                                                <Button size="small" onClick={() => handleBulkApplyMode('HYBRID')} className="text-xs">
                                                    Tất cả: Cả 2 (A+B)
                                                </Button>
                                                <Button size="small" onClick={() => handleBulkApplyMode('WEB_ONLY')} className="text-xs">
                                                    Tất cả: Web (A)
                                                </Button>
                                                <Button size="small" onClick={() => handleBulkApplyMode('BIOMETRIC_ONLY')} className="text-xs">
                                                    Tất cả: ZK Vân tay (B)
                                                </Button>
                                            </div>
                                        </div>

                                        <Table
                                            columns={deptColumns}
                                            dataSource={filteredDepartments}
                                            rowKey="ma_khoa"
                                            size="small"
                                            pagination={{ pageSize: 8, showSizeChanger: true }}
                                            bordered
                                            loading={loading}
                                        />
                                    </div>
                                </div>
                            )
                        }
                    ]}
                />
            </div>
        </Modal>
    );
};
