'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Table, Button, Input, DatePicker, Select, Tag, Space, Popconfirm, message, Tooltip, Alert } from 'antd';
import { SettingOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, InfoCircleOutlined, CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
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
                    if (data.config.workHours) {
                        setWorkHours(data.config.workHours);
                    }
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
                message.warning(`Ngày ${singleHolidayDate.format('DD/MM/YYYY')} đã có trong danh mục`);
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
                message.warning('Vui lòng chọn khoảng ngày nghỉ Lễ');
                return;
            }
            let curr = rangeHolidayDates[0].clone();
            const end = rangeHolidayDates[1].clone();
            let idx = 0;
            while (curr.isBefore(end) || curr.isSame(end, 'day')) {
                const dateStr = curr.format('YYYY-MM-DD');
                if (!holidays.some(h => h.date === dateStr)) {
                    newItems.push({
                        id: `h_${Date.now()}_${idx}`,
                        date: dateStr,
                        name: holidayNameInput.trim(),
                        allowanceDays: holidayAllowanceInput
                    });
                }
                curr = curr.add(1, 'day');
                idx++;
            }
        }

        if (newItems.length === 0) {
            message.info('Các ngày bạn chọn đều đã tồn tại trong danh sách');
            return;
        }

        setHolidays(prev => [...prev, ...newItems].sort((a, b) => a.date.localeCompare(b.date)));
        setHolidayNameInput('');
        setSingleHolidayDate(null);
        setRangeHolidayDates(null);
        message.success(`Đã thêm ${newItems.length} ngày Lễ vào danh sách! Bấm "Lưu Cấu Hình" để áp dụng toàn viện.`);
    };

    // Xóa ngày lễ
    const handleDeleteHoliday = (id: string) => {
        setHolidays(prev => prev.filter(h => h.id !== id));
    };

    // Thêm ngày làm bù
    const handleAddMakeupWorkday = () => {
        if (!makeupDateInput) {
            message.warning('Vui lòng chọn ngày Thứ 7 / Chủ Nhật đi làm bù');
            return;
        }
        const dateStr = makeupDateInput.format('YYYY-MM-DD');
        if (makeupWorkdays.some(m => m.date === dateStr)) {
            message.warning(`Ngày ${makeupDateInput.format('DD/MM/YYYY')} đã có trong danh sách làm bù`);
            return;
        }

        const newItem: MakeupWorkdayItem = {
            id: `m_${Date.now()}`,
            date: dateStr,
            description: makeupDescInput.trim() || 'Làm bù Thứ Bảy/Chủ Nhật'
        };

        setMakeupWorkdays(prev => [...prev, newItem].sort((a, b) => a.date.localeCompare(b.date)));
        setMakeupDateInput(null);
        setMakeupDescInput('');
        message.success(`Đã thêm ngày làm bù ${makeupDateInput.format('DD/MM/YYYY')}! Bấm "Lưu Cấu Hình" để áp dụng.`);
    };

    // Xóa ngày làm bù
    const handleDeleteMakeupWorkday = (id: string) => {
        setMakeupWorkdays(prev => prev.filter(m => m.id !== id));
    };

    // Lưu cấu hình toàn viện
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
                    workHours
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
                fetchData(); // Cập nhật lại Bảng Chấm Công
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
            width: 80,
            render: (val: string) => {
                const d = dayjs(val);
                const day = d.day();
                const dayName = day === 0 ? 'Chủ Nhật' : `Thứ ${day + 1}`;
                const isWk = day === 0 || day === 6;
                return (
                    <span className={`text-xs font-semibold ${isWk ? 'text-red-600' : 'text-slate-600'}`}>
                        {dayName}
                    </span>
                );
            }
        },
        {
            title: 'Tên Ngày Lễ / Sự Kiện',
            dataIndex: 'name',
            key: 'name',
            render: (val: string) => (
                <div className="flex items-center gap-1.5">
                    <Tag color="purple" className="font-bold text-xs">
                        Lễ
                    </Tag>
                    <span className="font-medium text-slate-800">{val}</span>
                </div>
            )
        },
        {
            title: 'Chế độ trực',
            dataIndex: 'allowanceDays',
            key: 'allowanceDays',
            width: 130,
            align: 'center' as const,
            render: (val: number) => (
                <Tag color={val >= 2 ? 'volcano' : 'blue'} className="font-bold">
                    {val >= 2 ? '⭐ Trực Lễ (+2d bù)' : 'Trực thường (+1d bù)'}
                </Tag>
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 70,
            align: 'center' as const,
            render: (_: any, record: HolidayItem) => (
                <Popconfirm
                    title="Xóa ngày nghỉ lễ này?"
                    description={`Xóa ngày ${dayjs(record.date).format('DD/MM/YYYY')} (${record.name}) khỏi danh mục ngày Lễ toàn viện?`}
                    onConfirm={() => handleDeleteHoliday(record.id)}
                    okText="Xóa"
                    cancelText="Hủy"
                >
                    <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                </Popconfirm>
            )
        }
    ];

    // Cột bảng Ngày làm bù
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
                    <span className="font-bold text-emerald-700">
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
                const d = dayjs(val);
                const day = d.day();
                return (
                    <span className="text-xs font-bold text-blue-700">
                        {day === 0 ? 'Chủ Nhật' : `Thứ ${day + 1}`}
                    </span>
                );
            }
        },
        {
            title: 'Nội Dung Làm Bù',
            dataIndex: 'description',
            key: 'description',
            render: (val: string) => (
                <div className="flex items-center gap-1.5">
                    <Tag color="green" className="font-bold text-xs">
                        Đi làm bù
                    </Tag>
                    <span className="text-slate-800">{val}</span>
                </div>
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 70,
            align: 'center' as const,
            render: (_: any, record: MakeupWorkdayItem) => (
                <Popconfirm
                    title="Xóa ngày làm bù này?"
                    description={`Xóa ngày ${dayjs(record.date).format('DD/MM/YYYY')} khỏi danh sách làm bù?`}
                    onConfirm={() => handleDeleteMakeupWorkday(record.id)}
                    okText="Xóa"
                    cancelText="Hủy"
                >
                    <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                </Popconfirm>
            )
        }
    ];

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-slate-800">
                    <SettingOutlined className="text-blue-600 text-lg" />
                    <span className="font-bold">Cấu Hình Chấm Công, Ngày Nghỉ Lễ & Khung Giờ Toàn Viện</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            width={780}
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
                            Các ngày nghỉ Lễ/Tết và ngày làm bù cấu hình tại đây sẽ <b>tự động liên thông</b> sang Bảng Chấm Công, Bảng Chấm Trực và các nút tính năng tự động (Khởi tạo cả tháng, Chấm nhanh, Lập kế hoạch) của toàn bệnh viện.
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
                                                        placeholder="Chọn ngày nghỉ Lễ"
                                                        value={singleHolidayDate}
                                                        onChange={val => setSingleHolidayDate(val)}
                                                    />
                                                ) : (
                                                    <RangePicker
                                                        className="w-full"
                                                        format="DD/MM/YYYY"
                                                        placeholder={['Từ ngày', 'Đến ngày']}
                                                        value={rangeHolidayDates}
                                                        onChange={val => setRangeHolidayDates(val as any)}
                                                    />
                                                )}
                                            </div>

                                            <div className="md:col-span-4">
                                                <Input
                                                    placeholder="Tên ngày Lễ (VD: Nghỉ Tết Âm Lịch, Giỗ Tổ...)"
                                                    value={holidayNameInput}
                                                    onChange={e => setHolidayNameInput(e.target.value)}
                                                    onPressEnter={handleAddHoliday}
                                                />
                                            </div>

                                            <div className="md:col-span-3 flex items-center gap-1.5">
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
                        }
                    ]}
                />
            </div>
        </Modal>
    );
};
