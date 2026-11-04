'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Switch, Table, Tag, Button, message, Alert, Divider } from 'antd';
import { SettingOutlined, SaveOutlined, DollarOutlined } from '@ant-design/icons';

interface LeavePolicyConfigModalProps {
    open: boolean;
    onClose: () => void;
}

export const LeavePolicyConfigModal: React.FC<LeavePolicyConfigModalProps> = ({
    open,
    onClose
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [eligibleList, setEligibleList] = useState<any[]>([]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/staff/leave-management/config');
            const data = await res.json();
            if (data.success) {
                form.setFieldsValue({
                    carryOverCutoffDate: data.config?.carryOverCutoffDate || '03-30',
                    allowCashCompensationOnShortage: data.config?.allowCashCompensationOnShortage !== false
                });
                setEligibleList(data.eligibleCashRequests || []);
            }
        } catch (err) {
            console.error('Lỗi đọc cấu hình:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchData();
        }
    }, [open]);

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const res = await fetch('/api/staff/leave-management/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });

            const data = await res.json();
            if (!res.ok) {
                message.error(data.error || 'Lưu cấu hình thất bại');
                return;
            }

            message.success('Đã lưu cấu hình chính sách nghỉ phép thành công!');
            onClose();
        } catch (err) {
            console.error('Lỗi lưu cấu hình:', err);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Họ và Tên',
            dataIndex: ['staff', 'ho_ten'],
            key: 'ho_ten',
            render: (text: string, r: any) => (
                <div>
                    <div className="font-semibold text-slate-800">{text}</div>
                    <div className="text-[11px] text-slate-400">{r.staff?.department?.ten_khoa}</div>
                </div>
            )
        },
        {
            title: 'Số Ngày Xin Nghỉ',
            dataIndex: 'requestedDays',
            key: 'requestedDays',
            render: (d: number) => <span className="font-bold text-rose-600">{d} ngày</span>
        },
        {
            title: 'Khoảng Ngày',
            key: 'range',
            render: (_: any, r: any) => (
                <span className="text-xs text-slate-600">
                    {r.requestedStartDate} → {r.requestedEndDate}
                </span>
            )
        },
        {
            title: 'Lý Do Không Cho Nghỉ',
            dataIndex: 'rejectNote',
            key: 'rejectNote',
            render: (t: string) => <span className="text-xs text-amber-800 italic">{t || 'Thiếu nhân lực trực chuyên môn'}</span>
        },
        {
            title: 'Tình Trạng',
            key: 'status',
            render: () => <Tag color="volcano">Đủ điều kiện thanh toán</Tag>
        }
    ];

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title={
                <div className="flex items-center gap-2 text-slate-800">
                    <SettingOutlined className="text-blue-600" />
                    <span>CẤU HÌNH CHÍNH SÁCH NGHỈ PHÉP & ĐỐI SOÁT TIỀN PHÉP DO THIẾU NHÂN LỰC</span>
                </div>
            }
            width={800}
            footer={[
                <Button key="back" onClick={onClose}>
                    Đóng
                </Button>,
                <Button
                    key="save"
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={loading}
                    onClick={handleSave}
                    className="bg-blue-600 hover:bg-blue-500"
                >
                    Lưu Cấu Hình
                </Button>
            ]}
        >
            <Form form={form} layout="vertical" size="small">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded mb-3 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                        <Form.Item
                            name="carryOverCutoffDate"
                            label={<span className="font-medium text-xs">Hạn chốt sử dụng phép năm trước (Định dạng MM-DD):</span>}
                            rules={[{ required: true, message: 'Nhập ngày chốt (VD: 03-30)' }]}
                            extra="Mặc định là ngày 30 tháng 3 năm kế tiếp (03-30). Sau ngày này, phép tồn không nghỉ xem như cống hiến."
                        >
                            <Input placeholder="03-30" />
                        </Form.Item>

                        <Form.Item
                            name="allowCashCompensationOnShortage"
                            label={<span className="font-medium text-xs">Chế độ trả tiền không nghỉ phép do thiếu nhân lực:</span>}
                            valuePropName="checked"
                            extra="Bắt buộc phải có phê duyệt chính thức của Ban Giám Đốc."
                        >
                            <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                        </Form.Item>
                    </div>
                </div>

                <Divider className="my-2" />

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                            <DollarOutlined />
                            <span>DANH SÁCH CÁN BỘ BỊ TỪ CHỐI DO THIẾU NHÂN LỰC (ĐỀ XUẤT BAN GIÁM ĐỐC DUYỆT TRẢ TIỀN):</span>
                        </div>
                        <span className="text-xs text-slate-500">
                            Tổng cộng: <strong>{eligibleList.length} lượt</strong>
                        </span>
                    </div>

                    <Table
                        columns={columns}
                        dataSource={eligibleList}
                        rowKey="id"
                        size="small"
                        pagination={{ pageSize: 5 }}
                        bordered
                    />
                </div>
            </Form>
        </Modal>
    );
};
