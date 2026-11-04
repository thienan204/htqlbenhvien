'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Radio, Select, Button, message, Alert, Divider } from 'antd';
import { FormOutlined, UserOutlined, TeamOutlined, SendOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface CreateLeaveModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    currentStaff: any;
    departmentStaffs: Array<{ id: string; ho_ten: string; chuc_vu?: string }>;
    remainingDays: number;
}

export const CreateLeaveModal: React.FC<CreateLeaveModalProps> = ({
    open,
    onClose,
    onSuccess,
    currentStaff,
    departmentStaffs,
    remainingDays
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [calculatedDays, setCalculatedDays] = useState<number>(1.0);

    // Xác định vai trò: Trưởng phòng hay Nhân viên/Phó phòng
    const chucVuName = (currentStaff?.chuc_vu || '').toLowerCase();
    const isDepartmentHead = chucVuName.includes('trưởng khoa') || 
                             chucVuName.includes('trưởng phòng') || 
                             chucVuName.includes('phụ trách');

    const formType = isDepartmentHead ? 'DEPARTMENT_HEAD' : 'STAFF_DEPUTY';

    useEffect(() => {
        if (open) {
            form.resetFields();
            form.setFieldsValue({
                session: 'FULL_DAY',
                contactPhone: currentStaff?.so_dien_thoai || '',
                dateRange: [dayjs().add(1, 'day'), dayjs().add(1, 'day')]
            });
            updateCalculatedDays([dayjs().add(1, 'day'), dayjs().add(1, 'day')], 'FULL_DAY');
        }
    }, [open, currentStaff]);

    const updateCalculatedDays = (dates: [Dayjs | null, Dayjs | null] | null, session: string) => {
        if (!dates || !dates[0] || !dates[1]) {
            setCalculatedDays(0);
            return;
        }

        if (session === 'MORNING' || session === 'AFTERNOON') {
            setCalculatedDays(0.5);
            return;
        }

        let cur = dates[0];
        const end = dates[1];
        let workDays = 0;

        while (cur.isBefore(end) || cur.isSame(end, 'day')) {
            const dayOfWeek = cur.day();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Bỏ qua T7, CN
                workDays += 1;
            }
            cur = cur.add(1, 'day');
        }

        setCalculatedDays(workDays);
    };

    const handleDatesChange = (dates: any) => {
        const session = form.getFieldValue('session') || 'FULL_DAY';
        updateCalculatedDays(dates, session);
    };

    const handleSessionChange = (e: any) => {
        const session = e.target.value;
        const dates = form.getFieldValue('dateRange');
        if ((session === 'MORNING' || session === 'AFTERNOON') && dates && dates[0]) {
            // Nửa ngày thì ngày kết thúc bằng ngày bắt đầu
            form.setFieldsValue({ dateRange: [dates[0], dates[0]] });
            updateCalculatedDays([dates[0], dates[0]], session);
        } else {
            updateCalculatedDays(dates, session);
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const [startDate, endDate] = values.dateRange;

            const payload = {
                staffId: currentStaff?.id,
                formType,
                requestedStartDate: startDate.format('YYYY-MM-DD'),
                requestedEndDate: endDate.format('YYYY-MM-DD'),
                requestedDays: calculatedDays,
                session: values.session,
                reason: values.reason,
                destination: values.destination,
                contactPhone: values.contactPhone,
                handoverStaffId: values.handoverStaffId || null,
                actingHeadStaffId: values.actingHeadStaffId || null
            };

            const res = await fetch('/api/staff/leave-management', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) {
                message.error(data.error || 'Gửi đơn nghỉ phép thất bại');
                return;
            }

            message.success('Đã gửi đơn xin nghỉ phép thành công!');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Lỗi nộp đơn:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title={
                <div className="flex items-center gap-2 text-blue-700">
                    <FormOutlined />
                    <span>
                        {isDepartmentHead
                            ? 'MẪU 2: ĐƠN XIN NGHỈ PHÉP (DÀNH CHO TRƯỞNG KHOA / PHÒNG)'
                            : 'MẪU 1: ĐƠN XIN NGHỈ PHÉP (DÀNH CHO CÁN BỘ / PHÓ TRƯỞNG ĐƠN VỊ)'}
                    </span>
                </div>
            }
            width={680}
            footer={[
                <Button key="back" onClick={onClose} disabled={loading}>
                    Đóng
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    icon={<SendOutlined />}
                    loading={loading}
                    onClick={handleSubmit}
                    className="bg-blue-600 hover:bg-blue-500"
                >
                    Gửi Đơn Nghỉ Phép
                </Button>
            ]}
        >
            <Alert
                type="info"
                showIcon
                className="mb-3 text-xs"
                message={
                    <div className="flex justify-between items-center">
                        <span>
                            Cán bộ làm đơn: <strong>{currentStaff?.ho_ten}</strong> ({currentStaff?.chuc_vu || 'Nhân viên'} - {currentStaff?.ten_khoa})
                        </span>
                        <span>
                            Quỹ phép còn: <strong className="text-blue-700 font-bold">{remainingDays} ngày</strong>
                        </span>
                    </div>
                }
            />

            <Form form={form} layout="vertical" size="small">
                {/* Mục Kính Gửi Chuẩn Bệnh Viện */}
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded mb-3 text-xs text-slate-700 space-y-1">
                    <div className="font-semibold text-slate-800">Kính gửi:</div>
                    <div className="pl-3">1. Ban Giám Đốc Bệnh Viện Đa Khoa Tỉnh Lạng Sơn</div>
                    <div className="pl-3">2. Phòng Tổ Chức Cán Bộ</div>
                    {!isDepartmentHead && (
                        <div className="pl-3 text-blue-700 font-medium">
                            3. Lãnh đạo Khoa/Phòng: {currentStaff?.ten_khoa || 'Đơn vị công tác'}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Form.Item
                        name="session"
                        label="Hình thức nghỉ ca"
                        rules={[{ required: true }]}
                    >
                        <Radio.Group onChange={handleSessionChange} className="w-full">
                            <Radio.Button value="FULL_DAY" className="w-1/3 text-center">Cả ngày (8h)</Radio.Button>
                            <Radio.Button value="MORNING" className="w-1/3 text-center">Sáng (4h)</Radio.Button>
                            <Radio.Button value="AFTERNOON" className="w-1/3 text-center">Chiều (4h)</Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item
                        name="dateRange"
                        label="Thời gian nghỉ (Từ ngày - Đến ngày)"
                        rules={[{ required: true, message: 'Vui lòng chọn thời gian nghỉ' }]}
                    >
                        <RangePicker
                            className="w-full"
                            format="DD/MM/YYYY"
                            onChange={handleDatesChange}
                        />
                    </Form.Item>
                </div>

                <div className="bg-blue-50/70 border border-blue-200 rounded p-2 mb-3 flex items-center justify-between text-xs">
                    <span className="text-slate-600">Tổng số ngày phép xin nghỉ:</span>
                    <span className="text-base font-bold text-blue-700 font-mono">
                        {calculatedDays} ngày
                    </span>
                </div>

                <Form.Item
                    name="reason"
                    label="Lý do xin nghỉ phép"
                    rules={[{ required: true, message: 'Vui lòng nhập lý do xin nghỉ' }]}
                >
                    <TextArea rows={2} placeholder="Nghỉ phép năm giải quyết công việc gia đình, khám sức khỏe..." />
                </Form.Item>

                <div className="grid grid-cols-2 gap-3">
                    <Form.Item name="destination" label="Nơi nghỉ phép (Địa chỉ)">
                        <Input placeholder="Tại gia đình (hoặc địa chỉ ngoại tỉnh...)" />
                    </Form.Item>
                    <Form.Item name="contactPhone" label="Số điện thoại liên hệ khi cần việc gấp">
                        <Input placeholder="Số điện thoại cá nhân" />
                    </Form.Item>
                </div>

                <Divider className="my-2" />

                {/* Điểm khác biệt quan trọng giữa Mẫu 1 và Mẫu 2 */}
                {isDepartmentHead ? (
                    <div className="bg-amber-50/80 border border-amber-300 p-2.5 rounded">
                        <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5 mb-1.5">
                            <TeamOutlined />
                            <span>Ủy Quyền / Phân Công Lãnh Đạo Phụ Trách Khoa Trong Thời Gian Nghỉ:</span>
                        </div>
                        <Form.Item
                            name="actingHeadStaffId"
                            label={<span className="text-xs">Đồng chí Phó Trưởng khoa/phòng phụ trách, điều hành đơn vị:</span>}
                            rules={[{ required: true, message: 'Vui lòng chọn đồng chí phụ trách thay' }]}
                            className="mb-1"
                        >
                            <Select
                                placeholder="-- Chọn Phó Trưởng phòng/khoa điều hành thay --"
                                showSearch
                                optionFilterProp="label"
                                options={departmentStaffs
                                    .filter(s => s.id !== currentStaff?.id)
                                    .map(s => ({
                                        value: s.id,
                                        label: `${s.ho_ten} (${s.chuc_vu || 'Phó Trưởng Đơn Vị'})`
                                    }))}
                            />
                        </Form.Item>
                    </div>
                ) : (
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded">
                        <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 mb-1.5">
                            <UserOutlined />
                            <span>Bàn Giao Công Việc Chuyên Môn / Trực Tại Khoa:</span>
                        </div>
                        <Form.Item
                            name="handoverStaffId"
                            label={<span className="text-xs">Cán bộ cùng khoa nhận bàn giao công việc:</span>}
                            rules={[{ required: true, message: 'Vui lòng chọn cán bộ nhận bàn giao' }]}
                            className="mb-1"
                        >
                            <Select
                                placeholder="-- Chọn cán bộ nhận bàn giao việc trong khoa --"
                                showSearch
                                optionFilterProp="label"
                                options={departmentStaffs
                                    .filter(s => s.id !== currentStaff?.id)
                                    .map(s => ({
                                        value: s.id,
                                        label: `${s.ho_ten} (${s.chuc_vu || 'Cán bộ cùng khoa'})`
                                    }))}
                            />
                        </Form.Item>
                    </div>
                )}
            </Form>
        </Modal>
    );
};
