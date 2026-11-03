'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, DatePicker, Checkbox, Button, message, Space, Tag } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, UsergroupAddOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useAttendance } from '../AttendanceContext';

const { RangePicker } = DatePicker;

interface AttendancePlanModalProps {
    open: boolean;
    onClose: () => void;
}

const ATTENDANCE_FORM_OPTIONS = [
    { value: 'x', label: 'x - Đi làm đủ ngày (8h)', color: 'green' },
    { value: 'x/2', label: 'x/2 - Đi làm nửa ngày (4h)', color: 'cyan' },
    { value: 'P', label: 'P - Nghỉ phép cả ngày', color: 'blue' },
    { value: 'P/2', label: 'P/2 - Nghỉ phép 1/2 ngày', color: 'geekblue' },
    { value: 'Nb', label: 'Nb - Nghỉ bù cả ngày', color: 'gold' },
    { value: 'Nb/2', label: 'Nb/2 - Nghỉ bù 1/2 ngày', color: 'orange' },
    { value: 'H', label: 'H - Đi học, tập huấn, hội nghị', color: 'purple' },
    { value: 'Ố', label: 'Ố - Nghỉ ốm (hưởng BHXH)', color: 'volcano' },
    { value: 'TS', label: 'TS - Nghỉ thai sản (hưởng BHXH)', color: 'magenta' },
    { value: 'L', label: 'L - Nghỉ Lễ hưởng lương', color: 'red' },
    { value: 'KL', label: 'KL - Nghỉ không lương', color: 'default' },
    { value: 'CLEAR', label: '🗑️ Xóa công trong khoảng ngày này', color: 'default' }
];

export const AttendancePlanModal: React.FC<AttendancePlanModalProps> = ({ open, onClose }) => {
    const { matrixData, selectedDate, selectedDept, fetchData } = useAttendance();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [selectAllStaff, setSelectAllStaff] = useState(false);

    const staffList = matrixData?.staffData || [];
    const watchedCode = Form.useWatch('code', form);
    const isNb = watchedCode === 'Nb' || watchedCode === 'Nb/2';

    // Danh sách cán bộ đủ điều kiện hưởng nghỉ bù (có hạn mức > 0)
    const eligibleStaffList = React.useMemo(() => {
        if (!isNb) return staffList;
        return staffList.filter(s => (s.dutySummary?.remainingCompensatoryDays ?? 0) > 0);
    }, [isNb, staffList]);

    // Tự động gán mặc định khi mở modal
    useEffect(() => {
        if (open) {
            const startOfMonth = selectedDate.startOf('month');
            const endOfMonth = selectedDate.endOf('month');
            form.setFieldsValue({
                staffIds: [],
                code: 'P', // Mặc định chọn Nghỉ phép
                dateRange: [startOfMonth, endOfMonth],
                skipWeekends: true,
                overwrite: true
            });
            setSelectAllStaff(false);
        }
    }, [open, selectedDate, form]);

    // Khi chuyển sang Nghỉ bù (Nb / Nb/2): Lọc bỏ ngay các cán bộ không có ca trực đã chọn trước đó
    useEffect(() => {
        if (isNb) {
            const currentSelected = form.getFieldValue('staffIds') || [];
            const validSelected = currentSelected.filter((id: string) => {
                const staff = staffList.find(s => s.staffId === id);
                return (staff?.dutySummary?.remainingCompensatoryDays ?? 0) > 0;
            });
            if (validSelected.length !== currentSelected.length) {
                form.setFieldsValue({ staffIds: validSelected });
            }
            setSelectAllStaff(validSelected.length === eligibleStaffList.length && eligibleStaffList.length > 0);
        }
    }, [isNb, staffList, eligibleStaffList, form]);

    const handleSelectAllChange = (checked: boolean) => {
        setSelectAllStaff(checked);
        if (checked) {
            form.setFieldsValue({
                staffIds: eligibleStaffList.map(s => s.staffId)
            });
        } else {
            form.setFieldsValue({
                staffIds: []
            });
        }
    };

    const handleStaffChange = (selected: string[]) => {
        form.setFieldsValue({ staffIds: selected });
        setSelectAllStaff(selected.length === eligibleStaffList.length && eligibleStaffList.length > 0);
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

            const res = await fetch(`${basePath}/api/staff/attendance/plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staffIds: values.staffIds,
                    startDate: startDayjs.format('YYYY-MM-DD'),
                    endDate: endDayjs.format('YYYY-MM-DD'),
                    code: values.code,
                    skipWeekends: values.skipWeekends,
                    overwrite: values.overwrite,
                    ma_khoa: selectedDept
                })
            });

            if (!res.ok) {
                try {
                    const errData = await res.json();
                    message.error(errData.error || 'Áp dụng kế hoạch thất bại');
                } catch {
                    message.error('Máy chủ phản hồi lỗi');
                }
                return;
            }

            const data = await res.json();
            if (data.success) {
                message.success(data.message || 'Đã áp dụng kế hoạch thành công!');
                onClose();
                fetchData();
            } else {
                message.error(data.error || 'Áp dụng kế hoạch thất bại');
            }
        } catch (err: any) {
            if (err?.errorFields) return; // Validate form lỗi
            console.error('Plan submit error:', err);
            message.error('Lỗi khi áp dụng kế hoạch chấm công');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-slate-800">
                    <CalendarOutlined className="text-blue-600 text-lg" />
                    <span>Lập Kế Hoạch Chấm Công Hàng Loạt</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            width={580}
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
                    Áp Dụng Kế Hoạch
                </Button>
            ]}
        >
            <div className="py-2">
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2.5 rounded-lg text-xs mb-4 flex items-start gap-2 shadow-xs">
                    <InfoCircleOutlined className="text-blue-600 mt-0.5 shrink-0 text-sm" />
                    <span className="leading-relaxed">Tính năng hỗ trợ phân công trước lịch công tác, đi học, nghỉ phép hoặc nghỉ bù cho một hoặc nhiều cán bộ cùng lúc mà không phải click từng ô.</span>
                </div>

                <Form form={form} layout="vertical">
                    {/* 1. Chọn Hình Thức */}
                    <Form.Item
                        label={<span className="font-semibold text-slate-700">1. Chọn hình thức chấm công / vắng</span>}
                        name="code"
                        rules={[{ required: true, message: 'Vui lòng chọn hình thức' }]}
                    >
                        <Select
                            options={ATTENDANCE_FORM_OPTIONS.map(opt => ({
                                value: opt.value,
                                label: (
                                    <div className="flex items-center gap-2">
                                        <Tag color={opt.color} className="font-bold min-w-[36px] text-center m-0">
                                            {opt.value}
                                        </Tag>
                                        <span className="text-sm">{opt.label}</span>
                                    </div>
                                )
                            }))}
                        />
                    </Form.Item>

                    {/* Cảnh báo quy tắc khi chọn Nghỉ bù */}
                    {isNb && (
                        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-3 py-2.5 rounded-lg text-xs -mt-2 mb-4 flex items-start gap-2 shadow-xs">
                            <InfoCircleOutlined className="text-amber-600 mt-0.5 shrink-0 text-sm" />
                            <div>
                                <p className="font-semibold text-amber-950">Quy định chấm Nghỉ bù ({watchedCode}):</p>
                                <p className="mt-0.5">
                                    Chỉ áp dụng cho cán bộ có ca trực hợp lệ và còn hạn mức nghỉ bù. Hệ thống đã tự động khóa các cán bộ chưa có ca trực (hiện có <b>{eligibleStaffList.length}/{staffList.length}</b> cán bộ đủ điều kiện).
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 2. Chọn Khoảng Ngày */}
                    <Form.Item
                        label={<span className="font-semibold text-slate-700">2. Chọn khoảng ngày áp dụng</span>}
                        name="dateRange"
                        rules={[{ required: true, message: 'Vui lòng chọn khoảng ngày' }]}
                    >
                        <RangePicker
                            className="w-full"
                            format="DD/MM/YYYY"
                            placeholder={['Từ ngày', 'Đến ngày']}
                        />
                    </Form.Item>

                    {/* 3. Chọn Nhân Viên */}
                    <Form.Item
                        label={
                            <div className="flex items-center justify-between w-full">
                                <span className="font-semibold text-slate-700">3. Chọn cán bộ nhân viên</span>
                                <Checkbox
                                    checked={selectAllStaff}
                                    onChange={(e) => handleSelectAllChange(e.target.checked)}
                                    className="text-xs text-blue-600 font-normal"
                                >
                                    Chọn tất cả {isNb ? `đủ điều kiện (${eligibleStaffList.length}/${staffList.length})` : `(${staffList.length} cán bộ)`}
                                </Checkbox>
                            </div>
                        }
                        name="staffIds"
                        rules={[{ required: true, message: 'Vui lòng chọn ít nhất một nhân viên' }]}
                    >
                        <Select
                            mode="multiple"
                            allowClear
                            placeholder={isNb ? "Chỉ chọn cán bộ có ca trực còn hạn mức..." : "Tìm kiếm và chọn cán bộ áp dụng..."}
                            onChange={handleStaffChange}
                            maxTagCount="responsive"
                            filterOption={(input, option) =>
                                (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={staffList.map(s => {
                                const remDays = s.dutySummary?.remainingCompensatoryDays ?? 0;
                                const isDisabled = isNb && remDays <= 0;
                                const dutyTag = isNb ? (
                                    remDays > 0 ? ` [Quỹ bù: ${remDays}d]` : ` [Chưa có ca trực]`
                                ) : (
                                    remDays > 0 ? ` (Quỹ bù: ${remDays}d)` : ''
                                );

                                return {
                                    value: s.staffId,
                                    label: `${s.ho_ten} (${s.ma_nv || 'Chưa có mã'})${s.chuc_vu ? ` - ${s.chuc_vu}` : ''}${dutyTag}`,
                                    disabled: isDisabled
                                };
                            })}
                        />
                    </Form.Item>

                    {/* 4. Tùy chọn an toàn */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col gap-2">
                        <Form.Item name="skipWeekends" valuePropName="checked" className="m-0">
                            <Checkbox defaultChecked className="text-xs text-slate-700">
                                <b>Bỏ qua Thứ 7 & Chủ Nhật</b> (Không áp dụng cho ngày nghỉ cuối tuần)
                            </Checkbox>
                        </Form.Item>
                        <Form.Item name="overwrite" valuePropName="checked" className="m-0">
                            <Checkbox defaultChecked className="text-xs text-slate-700">
                                <b>Ghi đè</b> lên các ngày đã có công (Nếu tắt: chỉ điền vào các ô còn trống)
                            </Checkbox>
                        </Form.Item>
                    </div>
                </Form>
            </div>
        </Modal>
    );
};
