'use client';

import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Button, Alert, message, Row, Col } from 'antd';
import { EditOutlined, SaveOutlined } from '@ant-design/icons';

interface EditLeaveBalanceModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    recordData: any;
    year: number;
}

export const EditLeaveBalanceModal: React.FC<EditLeaveBalanceModalProps> = ({
    open,
    onClose,
    onSuccess,
    recordData,
    year
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = React.useState(false);

    useEffect(() => {
        if (open && recordData) {
            form.setFieldsValue({
                standardDays: recordData.standardDays ?? 12.0,
                seniorityDays: recordData.seniorityDays ?? 0.0,
                transferredDays: recordData.transferredDays ?? 0.0,
                totalAvailable: recordData.totalAvailable ?? 12.0,
                usedDays: recordData.usedDays ?? 0.0,
                remainingDays: recordData.remainingDays ?? 12.0,
                note: recordData.note || ''
            });
        }
    }, [open, recordData, form]);

    // Tự động tính toán lại khi người dùng thay đổi các giá trị
    const handleValuesChange = (changed: any, all: any) => {
        const std = Number(all.standardDays) || 0;
        const sen = Number(all.seniorityDays) || 0;
        const trans = Number(all.transferredDays) || 0;
        const total = std + sen + trans;

        if ('standardDays' in changed || 'seniorityDays' in changed || 'transferredDays' in changed) {
            const used = Number(all.usedDays) || 0;
            const remaining = Math.max(0, total - used);
            form.setFieldsValue({
                totalAvailable: total,
                remainingDays: remaining
            });
        } else if ('usedDays' in changed) {
            const used = Number(changed.usedDays) || 0;
            const remaining = Math.max(0, total - used);
            form.setFieldsValue({
                remainingDays: remaining
            });
        } else if ('remainingDays' in changed) {
            const rem = Number(changed.remainingDays) || 0;
            const used = Math.max(0, total - rem);
            form.setFieldsValue({
                usedDays: used
            });
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
                id: recordData.id,
                staffId: recordData.staffId || recordData.staff?.id,
                year,
                standardDays: values.standardDays,
                seniorityDays: values.seniorityDays,
                transferredDays: values.transferredDays,
                totalAvailable: values.totalAvailable,
                usedDays: values.usedDays,
                remainingDays: values.remainingDays,
                note: values.note
            };

            const res = await fetch('/api/staff/leave-management/balances', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok && data.success) {
                message.success(`Cập nhật số ngày phép năm ${year} cho ${recordData.staff?.ho_ten} thành công!`);
                onSuccess();
                onClose();
            } else {
                message.error(data.error || 'Cập nhật thất bại');
            }
        } catch (error: any) {
            console.error('Lỗi lưu số ngày phép:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!recordData) return null;

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title={
                <div className="flex items-center gap-2 text-base font-bold text-slate-800">
                    <EditOutlined className="text-blue-600" />
                    <span>Điều Chỉnh Quỹ Ngày Phép Năm {year}</span>
                </div>
            }
            width={580}
            footer={[
                <Button key="cancel" onClick={onClose} disabled={loading}>
                    Hủy Bỏ
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={loading}
                    onClick={handleSubmit}
                    className="bg-blue-600 hover:bg-blue-500 font-semibold"
                >
                    Lưu Điều Chỉnh
                </Button>
            ]}
        >
            <Alert
                type="info"
                showIcon
                className="mb-4 text-xs"
                title={
                    <div>
                        Cán bộ: <strong className="text-blue-700">{recordData.staff?.ho_ten}</strong> ({recordData.staff?.ma_nv}) - {recordData.staff?.ten_khoa}
                    </div>
                }
            />

            <Form
                form={form}
                layout="vertical"
                size="middle"
                onValuesChange={handleValuesChange}
            >
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        1. Cấu thành Tổng số ngày phép được hưởng
                    </div>
                    <Row gutter={12}>
                        <Col span={8}>
                            <Form.Item
                                name="standardDays"
                                label={<span className="text-xs">Tiêu chuẩn (Ngày)</span>}
                                rules={[{ required: true, message: 'Nhập tiêu chuẩn' }]}
                            >
                                <InputNumber min={0} max={30} step={0.5} className="w-full" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                name="seniorityDays"
                                label={<span className="text-xs">Thâm niên (Ngày)</span>}
                            >
                                <InputNumber min={0} max={20} step={1} className="w-full" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                name="transferredDays"
                                label={<span className="text-xs">Phép năm trước (Ngày)</span>}
                            >
                                <InputNumber min={0} max={30} step={0.5} className="w-full" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        name="totalAvailable"
                        label={<span className="text-xs font-bold text-slate-700">TỔNG NGÀY ĐƯỢC NGHỈ TRONG NĂM</span>}
                    >
                        <InputNumber disabled className="w-full font-bold text-blue-700 bg-white" />
                    </Form.Item>
                </div>

                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-200 mb-3">
                    <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">
                        2. Tình trạng Đã nghỉ & Còn lại thực tế
                    </div>
                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item
                                name="usedDays"
                                label={<span className="text-xs font-bold text-amber-800">Số Ngày ĐÃ NGHỈ Thực Tế</span>}
                                rules={[{ required: true, message: 'Nhập số ngày đã nghỉ' }]}
                            >
                                <InputNumber min={0} max={60} step={0.5} className="w-full text-base font-bold text-amber-700" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="remainingDays"
                                label={<span className="text-xs font-bold text-emerald-800">Số Ngày Phép CÒN LẠI</span>}
                                rules={[{ required: true, message: 'Nhập số ngày còn lại' }]}
                            >
                                <InputNumber min={0} max={60} step={0.5} className="w-full text-base font-bold text-emerald-700" />
                            </Form.Item>
                        </Col>
                    </Row>
                </div>

                <Form.Item
                    name="note"
                    label={<span className="text-xs">Ghi chú điều chỉnh / Quyết định liên quan</span>}
                >
                    <Input.TextArea rows={2} placeholder="Nhập lý do điều chỉnh số phép nếu có..." />
                </Form.Item>
            </Form>
        </Modal>
    );
};

