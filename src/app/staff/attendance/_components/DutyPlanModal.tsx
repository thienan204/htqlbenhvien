'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, DatePicker, Checkbox, Button, message, Tag, Space } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, InfoCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useAttendance } from '../AttendanceContext';

const { RangePicker } = DatePicker;

interface DutyPlanModalProps {
    open: boolean;
    onClose: () => void;
}

const DUTY_FORM_OPTIONS = [
    { value: 'T', label: 'T - Trực ngày thường (1 ngày bù)', color: 'blue', desc: 'Trực ca 24h ngày thường T2-T6' },
    { value: 'C', label: 'C - Trực Thứ 7, Chủ Nhật (1 ngày bù)', color: 'volcano', desc: 'Trực ca 24h ngày nghỉ cuối tuần' },
    { value: 'L', label: 'L - Trực ngày Lễ (⭐ 2 ngày bù)', color: 'magenta', desc: 'Trực ca ngày Lễ hưởng 2 ngày bù' },
    { value: 'TE', label: 'TE - Trực ngày Tết (⭐ 2 ngày bù)', color: 'red', desc: 'Trực Tết hưởng 2 ngày bù' },
    { value: 'TK', label: 'TK - Trực kèm (1 ngày bù)', color: 'cyan', desc: 'Hỗ trợ trực chính / bác sĩ, KTV kèm' },
    { value: 'TT', label: 'TT - Trực thường trú (0 ngày bù)', color: 'geekblue', desc: 'Trực thường trú on-call sẵn sàng tại nhà' },
    { value: 'CLEAR', label: '🗑️ Xóa lịch trực trong các ngày này', color: 'default', desc: 'Hủy phân trực' }
];

const DAYS_OF_WEEK = [
    { label: 'Thứ 2', value: 1 },
    { label: 'Thứ 3', value: 2 },
    { label: 'Thứ 4', value: 3 },
    { label: 'Thứ 5', value: 4 },
    { label: 'Thứ 6', value: 5 },
    { label: 'Thứ 7', value: 6 },
    { label: 'Chủ Nhật', value: 0 }
];

export const DutyPlanModal: React.FC<DutyPlanModalProps> = ({ open, onClose }) => {
    const { matrixData, selectedDate, selectedDept, fetchData } = useAttendance();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [selectAllStaff, setSelectAllStaff] = useState(false);

    const staffList = matrixData?.staffData || [];

    // Tự động gán mặc định khi mở modal
    useEffect(() => {
        if (open) {
            const startOfMonth = selectedDate.startOf('month');
            const endOfMonth = selectedDate.endOf('month');
            form.setFieldsValue({
                staffIds: [],
                dutyCode: 'T',
                dateRange: [startOfMonth, endOfMonth],
                selectedDaysOfWeek: [1, 2, 3, 4, 5, 6, 0], // Mặc định tất cả các ngày
                overwrite: true,
                autoCreateAttendance: true
            });
            setSelectAllStaff(false);
        }
    }, [open, selectedDate, form]);

    const handleSelectAllChange = (checked: boolean) => {
        setSelectAllStaff(checked);
        if (checked) {
            form.setFieldsValue({
                staffIds: staffList.map(s => s.staffId)
            });
        } else {
            form.setFieldsValue({
                staffIds: []
            });
        }
    };

    const handleStaffChange = (selected: string[]) => {
        form.setFieldsValue({ staffIds: selected });
        setSelectAllStaff(selected.length === staffList.length && staffList.length > 0);
    };

    // Các preset chọn nhanh thứ trong tuần
    const setDayOfWeekPreset = (preset: 'ALL' | 'WEEKENDS' | 'WEEKDAYS') => {
        if (preset === 'ALL') {
            form.setFieldsValue({ selectedDaysOfWeek: [1, 2, 3, 4, 5, 6, 0] });
        } else if (preset === 'WEEKENDS') {
            form.setFieldsValue({ selectedDaysOfWeek: [6, 0] });
        } else if (preset === 'WEEKDAYS') {
            form.setFieldsValue({ selectedDaysOfWeek: [1, 2, 3, 4, 5] });
        }
    };

    const getBasePath = () => {
        if (typeof window !== 'undefined') {
            const parts = window.location.pathname.split('/staff');
            return parts.length > 1 ? parts[0] : '';
        }
        return '';
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            const [startDayjs, endDayjs]: [Dayjs, Dayjs] = values.dateRange;

            setLoading(true);
            const basePath = getBasePath();

            const res = await fetch(`${basePath}/api/staff/attendance/duty-plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staffIds: values.staffIds,
                    startDate: startDayjs.format('YYYY-MM-DD'),
                    endDate: endDayjs.format('YYYY-MM-DD'),
                    selectedDaysOfWeek: values.selectedDaysOfWeek,
                    dutyCode: values.dutyCode,
                    overwrite: values.overwrite,
                    autoCreateAttendance: values.autoCreateAttendance,
                    ma_khoa: selectedDept
                })
            });

            if (!res.ok) {
                try {
                    const errData = await res.json();
                    message.error(errData.error || 'Áp dụng phân trực thất bại');
                } catch {
                    message.error('Máy chủ phản hồi lỗi');
                }
                return;
            }

            const data = await res.json();
            if (data.success) {
                message.success(data.message || 'Đã áp dụng kế hoạch phân trực thành công!');
                onClose();
                fetchData();
            } else {
                message.error(data.error || 'Áp dụng phân trực thất bại');
            }
        } catch (err: any) {
            if (err?.errorFields) return;
            console.error('Duty plan submit error:', err);
            message.error('Lỗi khi áp dụng phân trực');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-slate-800">
                    <ClockCircleOutlined className="text-blue-600 text-lg" />
                    <span>Lập Kế Hoạch Phân Trực Hàng Loạt</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            width={620}
            destroyOnHidden
            footer={[
                <Button key="cancel" onClick={onClose} disabled={loading}>
                    Đóng
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={loading}
                    onClick={handleSubmit}
                    className="bg-blue-600 hover:bg-blue-500 font-medium"
                >
                    Áp Dụng Phân Trực
                </Button>
            ]}
        >
            <div className="py-2">
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2.5 rounded-lg text-xs mb-4 flex items-start gap-2 shadow-xs">
                    <InfoCircleOutlined className="text-blue-600 mt-0.5 shrink-0 text-sm" />
                    <span className="leading-relaxed">
                        Hỗ trợ xếp lịch trực chính (T, C, L, Te), trực kèm (Tk) hoặc trực thường trú (TT) cho một hoặc nhiều cán bộ cùng lúc theo chu kỳ ngày.
                    </span>
                </div>

                <Form form={form} layout="vertical">
                    {/* 1. Chọn Hình Thức Trực */}
                    <Form.Item
                        label={<span className="font-semibold text-slate-700">1. Chọn hình thức trực</span>}
                        name="dutyCode"
                        rules={[{ required: true, message: 'Vui lòng chọn hình thức trực' }]}
                    >
                        <Select
                            options={DUTY_FORM_OPTIONS.map(opt => ({
                                value: opt.value,
                                label: (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Tag color={opt.color} className="font-bold min-w-[36px] text-center m-0">
                                                {opt.value}
                                            </Tag>
                                            <span className="text-sm font-medium">{opt.label}</span>
                                        </div>
                                    </div>
                                )
                            }))}
                        />
                    </Form.Item>

                    {/* 2. Chọn Khoảng Ngày Áp Dụng */}
                    <Form.Item
                        label={<span className="font-semibold text-slate-700">2. Chọn khoảng ngày áp dụng</span>}
                        name="dateRange"
                        rules={[{ required: true, message: 'Vui lòng chọn khoảng ngày' }]}
                        className="mb-2"
                    >
                        <RangePicker
                            className="w-full"
                            format="DD/MM/YYYY"
                            placeholder={['Từ ngày', 'Đến ngày']}
                        />
                    </Form.Item>

                    {/* Bộ lọc Thứ trong tuần */}
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-slate-700">Chỉ áp dụng vào các thứ:</span>
                            <Space orientation="horizontal" size="small">
                                <Button size="small" type="link" onClick={() => setDayOfWeekPreset('ALL')} className="text-xs p-0 text-blue-600">
                                    Tất cả
                                </Button>
                                <span className="text-slate-300">|</span>
                                <Button size="small" type="link" onClick={() => setDayOfWeekPreset('WEEKENDS')} className="text-xs p-0 text-amber-600">
                                    Chỉ T7 & CN
                                </Button>
                                <span className="text-slate-300">|</span>
                                <Button size="small" type="link" onClick={() => setDayOfWeekPreset('WEEKDAYS')} className="text-xs p-0 text-teal-600">
                                    Chỉ T2 - T6
                                </Button>
                            </Space>
                        </div>
                        <Form.Item name="selectedDaysOfWeek" className="m-0">
                            <Checkbox.Group options={DAYS_OF_WEEK} className="text-xs grid grid-cols-4 sm:grid-cols-7 gap-1" />
                        </Form.Item>
                    </div>

                    {/* 3. Chọn Cán Bộ Nhân Viên */}
                    <Form.Item
                        label={
                            <div className="flex items-center justify-between w-full">
                                <span className="font-semibold text-slate-700">3. Chọn cán bộ trực</span>
                                <Checkbox
                                    checked={selectAllStaff}
                                    onChange={(e) => handleSelectAllChange(e.target.checked)}
                                    className="text-xs text-blue-600 font-normal"
                                >
                                    Chọn tất cả ({staffList.length} cán bộ)
                                </Checkbox>
                            </div>
                        }
                        name="staffIds"
                        rules={[{ required: true, message: 'Vui lòng chọn ít nhất một cán bộ' }]}
                    >
                        <Select
                            mode="multiple"
                            allowClear
                            placeholder="Tìm kiếm và chọn các cán bộ trực..."
                            onChange={handleStaffChange}
                            maxTagCount="responsive"
                            filterOption={(input, option) =>
                                (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={staffList.map(s => {
                                const currentDuties = s.dutySummary?.tongSo || 0;
                                return {
                                    value: s.staffId,
                                    label: `${s.ho_ten} (${s.ma_nv || 'Chưa có mã'})${s.chuc_vu ? ` - ${s.chuc_vu}` : ''} [Đã có ${currentDuties} ca trực]`
                                };
                            })}
                        />
                    </Form.Item>

                    {/* 4. Tùy Chọn An Toàn */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col gap-2">
                        <Form.Item name="overwrite" valuePropName="checked" className="m-0">
                            <Checkbox defaultChecked className="text-xs text-slate-700">
                                <b>Ghi đè</b> lên các ngày đã có ca trực (Nếu tắt: chỉ điền vào các ô chưa có lịch trực)
                            </Checkbox>
                        </Form.Item>
                        <Form.Item name="autoCreateAttendance" valuePropName="checked" className="m-0">
                            <Checkbox defaultChecked className="text-xs text-slate-700">
                                <b>Tự động điền công đi làm</b> (x/+) nếu ngày đó chưa chấm công
                            </Checkbox>
                        </Form.Item>
                    </div>
                </Form>
            </div>
        </Modal>
    );
};
