'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, Input, DatePicker, Button, message, Alert, Radio, Divider } from 'antd';
import { CheckOutlined, CloseOutlined, PrinterOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface TccbReviewModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onOpenPrint: (req: any) => void;
    requestData: any;
}

export const TccbReviewModal: React.FC<TccbReviewModalProps> = ({
    open,
    onClose,
    onSuccess,
    onOpenPrint,
    requestData
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [rejectMode, setRejectMode] = useState(false);

    useEffect(() => {
        if (open && requestData) {
            setRejectMode(false);
            const start = requestData.approvedStartDate || requestData.requestedStartDate;
            const end = requestData.approvedEndDate || requestData.requestedEndDate;
            const days = typeof requestData.approvedDays === 'number' ? requestData.approvedDays : requestData.requestedDays;

            form.setFieldsValue({
                approvedDays: days,
                dateRange: [dayjs(start), dayjs(end)],
                tccbNote: requestData.tccbNote || '',
                rejectReasonType: 'THIEU_NHAN_LUC',
                rejectNote: ''
            });
        }
    }, [open, requestData]);

    if (!requestData) return null;

    const staff = requestData.staff || {};

    const handleApprove = async () => {
        try {
            const values = await form.validateFields(['approvedDays', 'dateRange', 'tccbNote']);
            setLoading(true);

            const [start, end] = values.dateRange;

            const res = await fetch('/api/staff/leave-management/review', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: requestData.id,
                    action: 'TCCB_REVIEW',
                    approvedDays: Number(values.approvedDays),
                    approvedStartDate: start.format('YYYY-MM-DD'),
                    approvedEndDate: end.format('YYYY-MM-DD'),
                    tccbNote: values.tccbNote
                })
            });

            const data = await res.json();
            if (!res.ok) {
                message.error(data.error || 'Thẩm tra đơn thất bại');
                return;
            }

            message.success('Đã thẩm tra xong! Đơn đã chuyển sang trạng thái sẵn sàng in trình Lãnh đạo ký.');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Lỗi thẩm tra:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        try {
            const values = await form.validateFields(['rejectReasonType', 'rejectNote']);
            setLoading(true);

            const res = await fetch('/api/staff/leave-management/review', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: requestData.id,
                    action: 'TCCB_REJECT',
                    rejectReasonType: values.rejectReasonType,
                    rejectNote: values.rejectNote
                })
            });

            const data = await res.json();
            if (!res.ok) {
                message.error(data.error || 'Từ chối đơn thất bại');
                return;
            }

            message.warning(
                values.rejectReasonType === 'THIEU_NHAN_LUC'
                    ? 'Đã từ chối đơn do thiếu nhân lực (Đã ghi nhận để đề xuất BV thanh toán tiền phép).'
                    : 'Đã từ chối đơn nghỉ phép.'
            );
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Lỗi từ chối:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title={
                <div className="flex items-center gap-2 text-indigo-700">
                    <EditOutlined />
                    <span>PHÒNG TCCB THẨM TRA & ĐIỀU CHỈNH SỐ NGÀY ĐƯỢC NGHỈ PHÉP</span>
                </div>
            }
            width={650}
            footer={
                rejectMode ? [
                    <Button key="cancel-rej" onClick={() => setRejectMode(false)}>
                        Hủy
                    </Button>,
                    <Button
                        key="confirm-rej"
                        danger
                        type="primary"
                        loading={loading}
                        onClick={handleReject}
                    >
                        Xác Nhận Từ Chối Đơn
                    </Button>
                ] : [
                    <Button
                        key="print"
                        icon={<PrinterOutlined />}
                        onClick={() => onOpenPrint(requestData)}
                    >
                        In Mẫu Phiếu Kết Quả
                    </Button>,
                    <Button
                        key="reject"
                        danger
                        onClick={() => setRejectMode(true)}
                    >
                        Từ Chối
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        icon={<CheckOutlined />}
                        loading={loading}
                        onClick={handleApprove}
                        className="bg-indigo-600 hover:bg-indigo-500"
                    >
                        Lưu & Sẵn Sàng Trình Ký
                    </Button>
                ]
            }
        >
            <Alert
                type="info"
                showIcon
                className="mb-3 text-xs"
                title={
                    <div>
                        <div>Cán bộ: <strong>{staff.ho_ten}</strong> ({staff.chuc_vu_ref?.name || 'Nhân viên'} - {staff.department?.ten_khoa})</div>
                        <div className="mt-0.5 text-slate-600">
                            Xin nghỉ: <strong>{requestData.requestedDays} ngày</strong> (Từ {requestData.requestedStartDate} đến {requestData.requestedEndDate})
                        </div>
                        <div className="mt-0.5 italic text-slate-500">Lý do xin: {requestData.reason}</div>
                    </div>
                }
            />

            <Form form={form} layout="vertical" size="small">
                {!rejectMode ? (
                    <>
                        <div className="bg-indigo-50/70 border border-indigo-200 rounded p-3 mb-3">
                            <div className="text-xs font-semibold text-indigo-900 mb-2">
                                ✏️ Thẩm Tra & Điều Chỉnh Số Ngày Thực Tế Cho Phép Nghỉ:
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Form.Item
                                    name="approvedDays"
                                    label={<span className="font-semibold text-xs">Số ngày được duyệt nghỉ:</span>}
                                    rules={[{ required: true, message: 'Vui lòng nhập số ngày duyệt nghỉ' }]}
                                >
                                    <InputNumber
                                        min={0.5}
                                        max={30}
                                        step={0.5}
                                        className="w-full font-bold text-blue-700"
                                    />
                                </Form.Item>

                                <Form.Item
                                    name="dateRange"
                                    label={<span className="font-semibold text-xs">Thời gian duyệt nghỉ:</span>}
                                    rules={[{ required: true }]}
                                >
                                    <RangePicker className="w-full" format="DD/MM/YYYY" />
                                </Form.Item>
                            </div>

                            <Form.Item
                                name="tccbNote"
                                label={<span className="text-xs">Ý kiến thẩm tra của Phòng TCCB:</span>}
                                className="mb-0"
                            >
                                <Input placeholder="Ví dụ: Đồng ý giải quyết 3 ngày theo kế hoạch; 2 ngày còn lại bố trí sau..." />
                            </Form.Item>
                        </div>
                    </>
                ) : (
                    <div className="bg-rose-50 border border-rose-300 rounded p-3 mb-3">
                        <div className="text-xs font-bold text-rose-800 mb-2">
                            ⚠️ Xác Nhận Lý Do Không Cho Nghỉ Phép:
                        </div>
                        <Form.Item
                            name="rejectReasonType"
                            label={<span className="text-xs">Lý do từ chối:</span>}
                            rules={[{ required: true }]}
                        >
                            <Radio.Group>
                                <Radio value="THIEU_NHAN_LUC">
                                    <span className="font-semibold text-rose-700">Do thiếu nhân lực / Yêu cầu công tác</span>
                                    <span className="block text-[11px] text-slate-500">(Đủ điều kiện để Bệnh viện chi trả tiền phép nếu BGD duyệt)</span>
                                </Radio>
                                <Radio value="LY_DO_KHAC" className="mt-2">
                                    <span>Lý do khác (Đơn không hợp lệ, chưa đúng kế hoạch...)</span>
                                </Radio>
                            </Radio.Group>
                        </Form.Item>

                        <Form.Item
                            name="rejectNote"
                            label={<span className="text-xs">Chi tiết lý do từ chối:</span>}
                            rules={[{ required: true, message: 'Vui lòng nhập lý do từ chối' }]}
                            className="mb-0"
                        >
                            <TextArea rows={2} placeholder="Nhập lý do cụ thể..." />
                        </Form.Item>
                    </div>
                )}
            </Form>
        </Modal>
    );
};

