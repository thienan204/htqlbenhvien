'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Space, message, Tag, Popconfirm, Form, Input, DatePicker, Select, Card, Alert, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SwapOutlined, CheckCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

interface StaffWorkHistoryModalProps {
    open: boolean;
    onClose: () => void;
    staffId: string | null;
    staffName: string | null;
    currentDeptName?: string | null;
    onSuccess?: () => void;
}

export default function StaffWorkHistoryModal({
    open,
    onClose,
    staffId,
    staffName,
    currentDeptName,
    onSuccess
}: StaffWorkHistoryModalProps) {
    const [histories, setHistories] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [positions, setPositions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form Modal states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isTransferMode, setIsTransferMode] = useState(true); // true = Điều chuyển khoa mới (isCurrent = true), false = Thêm/Sửa mốc lịch sử cũ
    const [editingItem, setEditingItem] = useState<any>(null);
    const [form] = Form.useForm();

    const fetchHistories = async () => {
        if (!staffId) return;
        setLoading(true);
        try {
            const [histRes, deptRes, posRes] = await Promise.all([
                fetch(`/api/staff/work-history?staffId=${staffId}`),
                fetch('/api/departments'),
                fetch('/api/system-categories?type=CHUC_VU')
            ]);

            if (histRes.ok) setHistories(await histRes.json());
            if (deptRes.ok) setDepartments(await deptRes.json());
            if (posRes.ok) setPositions(await posRes.json());
        } catch (error) {
            console.error('Lỗi khi tải lịch sử công tác:', error);
            message.error('Lỗi hệ thống khi tải lịch sử công tác');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && staffId) {
            fetchHistories();
        }
    }, [open, staffId]);

    // Mở form điều chuyển khoa mới
    const handleOpenTransfer = () => {
        setIsTransferMode(true);
        setEditingItem(null);
        form.resetFields();
        form.setFieldsValue({
            tu_ngay: dayjs(),
            isCurrent: true
        });
        setIsFormOpen(true);
    };

    // Mở form thêm mốc quá khứ
    const handleOpenAddPast = () => {
        setIsTransferMode(false);
        setEditingItem(null);
        form.resetFields();
        form.setFieldsValue({
            isCurrent: false
        });
        setIsFormOpen(true);
    };

    // Mở form sửa mốc lịch sử
    const handleOpenEdit = (item: any) => {
        setIsTransferMode(item.isCurrent);
        setEditingItem(item);
        form.resetFields();
        form.setFieldsValue({
            ma_khoa: item.ma_khoa,
            chuc_vu_id: item.chuc_vu_id,
            tu_ngay: item.tu_ngay ? dayjs(item.tu_ngay) : undefined,
            den_ngay: item.den_ngay ? dayjs(item.den_ngay) : undefined,
            so_quyet_dinh: item.so_quyet_dinh,
            ngay_quyet_dinh: item.ngay_quyet_dinh ? dayjs(item.ngay_quyet_dinh) : undefined,
            ghi_chu: item.ghi_chu,
            isCurrent: item.isCurrent
        });
        setIsFormOpen(true);
    };

    // Lưu mốc lịch sử / Điều chuyển
    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);

            const payload = {
                id: editingItem?.id,
                staffId,
                ma_khoa: values.ma_khoa,
                chuc_vu_id: values.chuc_vu_id || null,
                tu_ngay: values.tu_ngay ? values.tu_ngay.toISOString() : null,
                den_ngay: values.den_ngay ? values.den_ngay.toISOString() : null,
                so_quyet_dinh: values.so_quyet_dinh || null,
                ngay_quyet_dinh: values.ngay_quyet_dinh ? values.ngay_quyet_dinh.toISOString() : null,
                ghi_chu: values.ghi_chu || null,
                isCurrent: isTransferMode ? true : Boolean(values.isCurrent)
            };

            const method = editingItem ? 'PUT' : 'POST';
            const res = await fetch('/api/staff/work-history', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success(isTransferMode ? 'Điều chuyển khoa phòng thành công!' : (editingItem ? 'Cập nhật thành công!' : 'Thêm mốc lịch sử thành công!'));
                setIsFormOpen(false);
                fetchHistories();
                if (onSuccess) onSuccess();
            } else {
                const err = await res.json();
                message.error(err.error || 'Thao tác thất bại');
            }
        } catch (error: any) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    // Xóa mốc lịch sử
    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/staff/work-history?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                message.success('Đã xóa mốc lịch sử');
                fetchHistories();
                if (onSuccess) onSuccess();
            } else {
                const err = await res.json();
                message.error(err.error || 'Xóa thất bại');
            }
        } catch (error) {
            message.error('Lỗi khi xóa');
        }
    };

    const currentHistory = histories.find(h => h.isCurrent);

    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 50,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => index + 1
        },
        {
            title: 'Khoa / Phòng',
            key: 'khoa',
            render: (_: any, r: any) => (
                <div>
                    <span className="font-semibold text-slate-800">{r.department?.ten_khoa || r.ma_khoa}</span>
                    <span className="text-xs text-slate-400 block">Mã: {r.ma_khoa}</span>
                </div>
            )
        },
        {
            title: 'Chức vụ',
            key: 'chuc_vu',
            width: 130,
            render: (_: any, r: any) => r.chuc_vu_ref ? <Tag color="blue">{r.chuc_vu_ref.name}</Tag> : <span className="text-slate-400 italic">-</span>
        },
        {
            title: 'Thời gian công tác',
            key: 'thoi_gian',
            width: 220,
            render: (_: any, r: any) => {
                const tuNgayStr = r.tu_ngay ? dayjs(r.tu_ngay).format('DD/MM/YYYY') : '?';
                const denNgayStr = r.den_ngay ? dayjs(r.den_ngay).format('DD/MM/YYYY') : null;

                if (r.isCurrent) {
                    return (
                        <div>
                            <span className="font-medium text-emerald-700">Từ {tuNgayStr}</span>
                            <span className="text-xs text-emerald-600 block">Đến nay (Hiện tại)</span>
                        </div>
                    );
                }
                return (
                    <span className="text-slate-600">
                        {tuNgayStr} → {denNgayStr || 'Chưa xác định'}
                    </span>
                );
            }
        },
        {
            title: 'Quyết định điều động',
            key: 'quyet_dinh',
            render: (_: any, r: any) => (
                <div>
                    {r.so_quyet_dinh ? (
                        <span className="font-medium text-slate-700 block">Số: {r.so_quyet_dinh}</span>
                    ) : (
                        <span className="text-slate-400 italic">Không có QĐ</span>
                    )}
                    {r.ngay_quyet_dinh && (
                        <span className="text-xs text-slate-400">Ngày: {dayjs(r.ngay_quyet_dinh).format('DD/MM/YYYY')}</span>
                    )}
                </div>
            )
        },
        {
            title: 'Ghi chú / Lý do',
            dataIndex: 'ghi_chu',
            key: 'ghi_chu',
            render: (text: string) => text ? <span className="text-slate-600">{text}</span> : <span className="text-slate-300 italic">-</span>
        },
        {
            title: 'Trạng thái',
            key: 'trang_thai',
            width: 140,
            align: 'center' as const,
            render: (_: any, r: any) => r.isCurrent ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>Đang làm việc</Tag>
            ) : (
                <Tag color="default">Đã chuyển đi</Tag>
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 120,
            align: 'center' as const,
            render: (_: any, r: any) => (
                <Space size="small">
                    <Button 
                        size="small" 
                        type="text" 
                        icon={<EditOutlined className="text-blue-600" />} 
                        onClick={() => handleOpenEdit(r)} 
                        title="Sửa mốc lịch sử"
                    />
                    {!r.isCurrent && (
                        <Popconfirm
                            title="Xóa mốc lịch sử này?"
                            onConfirm={() => handleDelete(r.id)}
                            okText="Xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                        >
                            <Button 
                                size="small" 
                                type="text" 
                                danger 
                                icon={<DeleteOutlined />} 
                                title="Xóa"
                            />
                        </Popconfirm>
                    )}
                </Space>
            )
        }
    ];

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-lg font-bold text-slate-800 border-b pb-3 mb-2">
                    <HistoryOutlined className="text-blue-600 text-xl" />
                    <span>Lịch sử Công tác & Điều chuyển Khoa phòng: <span className="text-blue-600">{staffName}</span></span>
                </div>
            }
            open={open}
            onCancel={onClose}
            width={1000}
            footer={[
                <Button key="close" onClick={onClose} type="primary">
                    Đóng
                </Button>
            ]}
            centered
        >
            <div className="space-y-4">
                {/* Banner khoa phòng hiện tại */}
                <Card className="bg-emerald-50 border-emerald-200 shadow-none">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                        <div>
                            <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wider block">Khoa / Phòng công tác hiện tại</span>
                            <span className="text-xl font-bold text-emerald-800">
                                {currentHistory?.department?.ten_khoa || currentDeptName || 'Chưa cập nhật'}
                            </span>
                            {currentHistory?.tu_ngay && (
                                <span className="text-xs text-emerald-600 block mt-0.5">
                                    Làm việc từ ngày: {dayjs(currentHistory.tu_ngay).format('DD/MM/YYYY')}
                                    {currentHistory.so_quyet_dinh ? ` (Theo QĐ: ${currentHistory.so_quyet_dinh})` : ''}
                                </span>
                            )}
                        </div>
                        <Space>
                            <Button
                                type="primary"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                icon={<SwapOutlined />}
                                onClick={handleOpenTransfer}
                            >
                                Điều chuyển khoa mới
                            </Button>
                            <Button
                                icon={<PlusOutlined />}
                                onClick={handleOpenAddPast}
                            >
                                Thêm mốc quá khứ
                            </Button>
                        </Space>
                    </div>
                </Card>

                {/* Bảng danh sách lịch sử */}
                <Table
                    dataSource={histories}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="middle"
                    bordered
                    rowClassName={(r) => r.isCurrent ? 'bg-emerald-50/40 font-medium' : ''}
                />
            </div>

            {/* Modal Form Thêm/Sửa/Điều chuyển */}
            <Modal
                title={
                    <span className="font-bold text-base">
                        {isTransferMode 
                            ? '⚡ Điều chuyển nhân sự sang Khoa/Phòng mới' 
                            : (editingItem ? 'Sửa thông tin mốc lịch sử công tác' : 'Thêm mốc lịch sử công tác quá khứ')}
                    </span>
                }
                open={isFormOpen}
                onCancel={() => setIsFormOpen(false)}
                onOk={handleSubmit}
                confirmLoading={submitting}
                okText={isTransferMode ? 'Xác nhận điều chuyển' : 'Lưu thông tin'}
                cancelText="Hủy"
                destroyOnHidden
            >
                {isTransferMode && (
                    <Alert
                        message="Lưu ý khi điều chuyển khoa mới"
                        description="Hệ thống sẽ tự động chốt ngày kết thúc ở khoa hiện tại cũ, cập nhật Khoa mới cho Nhân sự và đồng bộ sang Tài khoản đăng nhập tương ứng."
                        type="info"
                        showIcon
                        className="mb-4"
                    />
                )}
                <Form form={form} layout="vertical" className="mt-2">
                    <Form.Item
                        name="ma_khoa"
                        label={isTransferMode ? "Khoa / Phòng tiếp nhận mới" : "Khoa / Phòng"}
                        rules={[{ required: true, message: 'Vui lòng chọn Khoa/Phòng' }]}
                    >
                        <Select
                            placeholder="Chọn Khoa/Phòng"
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                            }
                            options={departments.map(d => ({
                                value: d.ma_khoa,
                                label: `${d.ten_khoa} (${d.ma_khoa})`
                            }))}
                        />
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            name="tu_ngay"
                            label={isTransferMode ? "Ngày bắt đầu công tác tại khoa mới" : "Từ ngày"}
                            rules={[{ required: true, message: 'Vui lòng chọn ngày bắt đầu' }]}
                        >
                            <DatePicker format="DD/MM/YYYY" className="w-full" placeholder="Chọn ngày" />
                        </Form.Item>

                        {!isTransferMode && (
                            <Form.Item
                                name="den_ngay"
                                label="Đến ngày"
                            >
                                <DatePicker format="DD/MM/YYYY" className="w-full" placeholder="Chọn ngày" />
                            </Form.Item>
                        )}

                        <Form.Item
                            name="chuc_vu_id"
                            label="Chức vụ tại khoa"
                        >
                            <Select
                                placeholder="Chọn chức vụ"
                                allowClear
                                options={positions.map(p => ({
                                    value: p.id,
                                    label: p.name
                                }))}
                            />
                        </Form.Item>

                        <Form.Item
                            name="so_quyet_dinh"
                            label="Số quyết định điều động"
                        >
                            <Input placeholder="Ví dụ: 123/QĐ-BV" />
                        </Form.Item>
                    </div>

                    <Form.Item
                        name="ngay_quyet_dinh"
                        label="Ngày ký quyết định"
                    >
                        <DatePicker format="DD/MM/YYYY" className="w-full" placeholder="Chọn ngày ký" />
                    </Form.Item>

                    <Form.Item
                        name="ghi_chu"
                        label="Lý do điều chuyển / Ghi chú"
                    >
                        <Input.TextArea rows={3} placeholder="Nhập lý do điều chuyển hoặc ghi chú bàn giao..." />
                    </Form.Item>
                </Form>
            </Modal>
        </Modal>
    );
}
