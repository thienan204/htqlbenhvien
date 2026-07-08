
'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, message, Spin, Modal, Form, Input, Select, Checkbox, Row, Col, Space, Popconfirm, Tag, Switch, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import { createDuplicateRule, deleteDuplicateRule, getDuplicateRules, updateDuplicateRule } from '@/actions/duplicate-rules';
import { getCurrentUser, type UserPayload } from '@/actions/auth';
import { useRouter } from 'next/navigation';

interface DuplicateRule {
    id: string;
    name: string;
    machineCols: string[];
    serviceCol?: string;
    startCol: string;
    endCol: string;
    ignoreMaMayMinusOne: boolean;
    active?: boolean;
    serviceValues?: string[];
    excludedServiceValues?: string[];
    ignoreIfSameField?: string;
}

export default function ExcelRulesPage() {
    const [rules, setRules] = useState<DuplicateRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState<UserPayload | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<DuplicateRule | null>(null);

    const router = useRouter();
    const [form] = Form.useForm();

    const fetchRules = async () => {
        setLoading(true);
        try {
            const res = await getDuplicateRules();
            if (res && res.success && res.data) {
                setRules(res.data as unknown as DuplicateRule[]);
            } else {
                message.error("Không thể tải danh sách quy tắc.");
            }
        } catch (error) {
            console.error("fetchRules failed:", error);
            message.error("Lỗi kết nối khi tải quy tắc.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRules();
        getCurrentUser().then(user => setCurrentUser(user));
    }, []);

    const handleCreateRule = async (values: any) => {
        setLoading(true);
        const res = await createDuplicateRule({
            ...values,
            ignoreMaMayMinusOne: values.ignoreMaMayMinusOne || false,
            active: values.active !== undefined ? values.active : true,
            ignoreIfSameField: values.ignoreIfSameField || ''
        });

        if (res.success) {
            message.success("Đã tạo quy tắc mới.");
            setIsModalOpen(false);
            form.resetFields();
            fetchRules();
        } else {
            message.error("Lỗi khi tạo quy tắc.");
        }
        setLoading(false);
    };

    const handleUpdateRule = async (values: any) => {
        if (!editingRule) return;
        setLoading(true);
        const res = await updateDuplicateRule(editingRule.id, {
            ...values,
            ignoreMaMayMinusOne: values.ignoreMaMayMinusOne || false,
            ignoreIfSameField: values.ignoreIfSameField || ''
        });

        if (res.success) {
            message.success("Đã cập nhật quy tắc.");
            setIsModalOpen(false);
            setEditingRule(null);
            form.resetFields();
            fetchRules();
        } else {
            message.error("Lỗi khi cập nhật quy tắc.");
        }
        setLoading(false);
    };

    const handleDeleteRule = async (id: string) => {
        setLoading(true);
        const res = await deleteDuplicateRule(id);
        if (res.success) {
            message.success("Đã xóa quy tắc.");
            fetchRules();
        } else {
            message.error("Lỗi khi xóa quy tắc.");
        }
        setLoading(false);
    };

    const openCreateModal = () => {
        if (!currentUser) {
            message.warning("Vui lòng đăng nhập để thực hiện chức năng này.");
            return;
        }
        setEditingRule(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const openEditModal = (rule: DuplicateRule) => {
        if (!currentUser) return;
        setEditingRule(rule);
        form.setFieldsValue(rule);
        setIsModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-12">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Cấu hình Quy tắc Excel</h1>
                        <p className="text-slate-500 font-medium">Quản lý các quy tắc kiểm tra trùng lặp cho file Excel</p>
                    </div>
                    {currentUser && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200">
                            Thêm quy tắc mới
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {loading && <div className="text-center py-12"><Spin size="large" /></div>}

                    {!loading && rules.map(rule => (
                        <Card key={rule.id} className="shadow-sm border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-blue-500"></div>
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-lg text-slate-800">{rule.name}</h3>
                                        {rule.active === false ? <Tag color="default">Đã ẩn</Tag> : <Tag color="green">Hoạt động</Tag>}
                                    </div>
                                    <div className="text-sm text-slate-500 space-y-1">
                                        <p><span className="font-semibold text-slate-700">Cột định danh (Gộp nhóm):</span> {rule.machineCols.join(', ')}</p>
                                        <p><span className="font-semibold text-slate-700">Mốc thời gian:</span> {rule.startCol} - {rule.endCol}</p>
                                        {rule.serviceCol && <p><span className="font-semibold text-slate-700">Lọc theo dịch vụ:</span> {rule.serviceCol} {rule.serviceValues?.length ? `(${rule.serviceValues.join(', ')})` : ''}</p>}
                                        {rule.ignoreMaMayMinusOne && <p className="text-orange-600 italic">Caution: Bỏ qua nếu giá trị = -1</p>}
                                    </div>
                                </div>

                                <Space className="opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        icon={<EditOutlined />}
                                        onClick={() => openEditModal(rule)}
                                        disabled={!currentUser}
                                    />
                                    <Popconfirm title="Bạn có chắc chắn muốn xóa?" onConfirm={() => handleDeleteRule(rule.id)} disabled={!currentUser}>
                                        <Button danger icon={<DeleteOutlined />} disabled={!currentUser} />
                                    </Popconfirm>
                                </Space>
                            </div>
                        </Card>
                    ))}

                    {!loading && rules.length === 0 && (
                        <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                            Chưa có quy tắc nào. Hãy thêm mới!
                        </div>
                    )}
                </div>
            </div>

            <Modal
                title={editingRule ? "Chỉnh sửa Quy tắc" : "Tạo Quy tắc Mới"}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                width={800}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={editingRule ? handleUpdateRule : handleCreateRule}
                    initialValues={{ ignoreMaMayMinusOne: false, active: true }}
                >
                    <Form.Item
                        label="Tên Quy tắc"
                        name="name"
                        rules={[{ required: true, message: 'Vui lòng nhập tên quy tắc' }]}
                    >
                        <Input placeholder="Ví dụ: Kiểm tra trùng máy..." />
                    </Form.Item>

                    <Form.Item name="active" valuePropName="checked">
                        <Switch checkedChildren="Đang hoạt động" unCheckedChildren="Đã ẩn" />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={24}>
                            <div className="bg-blue-50 p-3 mb-4 rounded border border-blue-100 text-blue-700 text-sm">
                                Nhập chính xác tên cột trong file Excel (Case-sensitive)
                            </div>
                        </Col>
                        <Col span={24}>
                            <Form.Item
                                label="Cột Định danh (Machine)"
                                name="machineCols"
                                rules={[{ required: true, message: 'Nhập ít nhất 1 cột' }]}
                            >
                                <Select mode="tags" placeholder="Nhập tên cột rồi ấn Enter..." />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Cột Bắt đầu (Start Time)" name="startCol" rules={[{ required: true }]}>
                                <Input placeholder="VD: NGAY_VAO" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Cột Kết thúc (End Time)" name="endCol" rules={[{ required: true }]}>
                                <Input placeholder="VD: NGAY_RA" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Cột Dịch vụ (Tùy chọn)" name="serviceCol">
                                <Input placeholder="VD: MA_DICH_VU" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Giá trị Dịch vụ (Bao gồm)" name="serviceValues">
                                <Select mode="tags" placeholder="Nhập giá trị..." />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Giá trị Dịch vụ (Loại trừ)" name="excludedServiceValues">
                                <Select mode="tags" placeholder="Nhập giá trị cần loại trừ..." />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item name="ignoreMaMayMinusOne" valuePropName="checked">
                                <Checkbox>Bỏ qua nếu giá trị định danh = -1</Checkbox>
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item label="Giá trị cần bỏ qua nếu trùng (Tuỳ chọn)" name="ignoreIfSameField">
                                <Input placeholder="VD: MA_BN (Bỏ qua báo lỗi nếu 2 đối tượng cùng chung giá trị trường này)" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <div className="flex justify-end gap-2 mt-4">
                        <Button onClick={() => setIsModalOpen(false)}>Hủy</Button>
                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                            {editingRule ? "Cập nhật" : "Lưu Quy tắc"}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}
