'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Button, message, Alert } from 'antd';
import { CheckCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface DirectorSignModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    requestData: any;
}

export const DirectorSignModal: React.FC<DirectorSignModalProps> = ({
    open,
    onClose,
    onSuccess,
    requestData
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && requestData) {
            form.setFieldsValue({
                directorSignerName: 'Giám Đốc Bệnh Viện',
                directorPaperCode: `PB-${dayjs().format('YYYY')}/${requestData.id.slice(-4).toUpperCase()}`,
                directorSignedAt: dayjs()
            });
        }
    }, [open, requestData]);

    if (!requestData) return null;

    const staff = requestData.staff || {};
    const finalDays = typeof requestData.approvedDays === 'number' ? requestData.approvedDays : requestData.requestedDays;
    const startDateStr = requestData.approvedStartDate || requestData.requestedStartDate;
    const endDateStr = requestData.approvedEndDate || requestData.requestedEndDate;

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const res = await fetch('/api/staff/leave-management/confirm-signed', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: requestData.id,
                    directorSignerName: values.directorSignerName,
                    directorPaperCode: values.directorPaperCode,
                    directorSignedAt: values.directorSignedAt.toISOString()
                })
            });

            const data = await res.json();
            if (!res.ok) {
                message.error(data.error || 'Xác nhận chữ ký thất bại');
                return;
            }

            message.success('Đã xác nhận ký duyệt thành công! Công nghỉ phép P đã được tự động điền vào Bảng Chấm Công.');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Lỗi xác nhận chữ ký:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title={
                <div className="flex items-center gap-2 text-emerald-700">
                    <SafetyCertificateOutlined />
                    <span>XÁC NHẬN LÃNH ĐẠO ĐÃ KÝ PHÊ DUYỆT VĂN BẢN GIẤY</span>
                </div>
            }
            width={580}
            footer={[
                <Button key="back" onClick={onClose} disabled={loading}>
                    Đóng
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={loading}
                    onClick={handleSubmit}
                    className="bg-emerald-600 hover:bg-emerald-500"
                >
                    Xác Nhận & Tự Động Đồng Bộ Vào Bảng Chấm Công
                </Button>
            ]}
        >
            <Alert
                type="success"
                showIcon
                className="mb-3 text-xs"
                title={
                    <div>
                        <div className="font-semibold text-emerald-900">
                            Cán bộ: {staff.ho_ten} ({staff.chuc_vu_ref?.name || 'Nhân viên'} - {staff.department?.ten_khoa})
                        </div>
                        <div className="mt-0.5 text-slate-700">
                            Số ngày chính thức được duyệt: <strong className="text-emerald-700 underline">{finalDays} ngày</strong> (Từ {dayjs(startDateStr).format('DD/MM/YYYY')} đến {dayjs(endDateStr).format('DD/MM/YYYY')})
                        </div>
                    </div>
                }
            />

            <Form form={form} layout="vertical" size="small">
                <Form.Item
                    name="directorSignerName"
                    label="Lãnh đạo ký văn bản giấy:"
                    rules={[{ required: true, message: 'Vui lòng nhập người ký' }]}
                >
                    <Input placeholder="Ví dụ: Giám Đốc Bệnh Viện hoặc Phó Giám Đốc" />
                </Form.Item>

                <div className="grid grid-cols-2 gap-3">
                    <Form.Item
                        name="directorPaperCode"
                        label="Số hiệu phiếu kết quả đã ký:"
                        rules={[{ required: true, message: 'Vui lòng nhập số hiệu phiếu' }]}
                    >
                        <Input placeholder="Ví dụ: 12/PB-TCCB" />
                    </Form.Item>

                    <Form.Item
                        name="directorSignedAt"
                        label="Ngày Lãnh đạo ký văn bản:"
                        rules={[{ required: true }]}
                    >
                        <DatePicker className="w-full" format="DD/MM/YYYY" />
                    </Form.Item>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-2.5 rounded text-xs leading-relaxed">
                    💡 <strong>Tác vụ tự động sau khi bấm xác nhận:</strong>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        <li>Hệ thống tự động trừ <strong>{finalDays} ngày</strong> vào Quỹ ngày phép năm của cán bộ.</li>
                        <li>Tự động ghi nhận mã <strong>P</strong> hoặc <strong>P/2</strong> vào các ngày tương ứng trên Bảng Chấm Công.</li>
                    </ul>
                </div>
            </Form>
        </Modal>
    );
};

