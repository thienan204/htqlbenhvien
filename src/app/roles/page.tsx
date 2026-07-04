'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Card, Popconfirm, Tag, Checkbox, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

// Các quyền menu sẽ được tải động từ DB

interface Role {
    id: string;
    code: string;
    name: string;
    description: string | null;
    permissions?: any;
    createdAt: string;
}

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [form] = Form.useForm();
    const [menuPermissions, setMenuPermissions] = useState<{label: string, value: string}[]>([]);

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/roles');
            if (res.ok) {
                const data = await res.json();
                setRoles(data);
            } else {
                message.error('Không thể tải danh sách Role');
            }
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    const fetchMenus = async () => {
        try {
            const res = await fetch('/api/menus');
            if (res.ok) {
                const data = await res.json();
                const perms = data
                    .filter((m: any) => m.permissionCode && m.permissionCode.trim() !== '')
                    .map((m: any) => ({ label: m.title, value: m.permissionCode }));
                
                const uniquePerms = Array.from(new Map(perms.map((item: any) => [item.value, item])).values());
                setMenuPermissions(uniquePerms as any);
            }
        } catch (error) {
            console.error('Failed to fetch menus for permissions', error);
        }
    };

    useEffect(() => {
        fetchRoles();
        fetchMenus();
    }, []);

    const handleSave = async (values: any) => {
        const isUpdate = !!selectedRole;
        const url = '/api/roles';
        const method = isUpdate ? 'PUT' : 'POST';
        
        const payload = {
            id: selectedRole?.id,
            ...values
        };

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success(`${isUpdate ? 'Cập nhật' : 'Tạo'} Role thành công!`);
                setIsModalVisible(false);
                fetchRoles();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi lưu Role');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/roles?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                message.success('Xóa Role thành công!');
                fetchRoles();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi xóa Role');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const openModal = (role: Role | null = null) => {
        setSelectedRole(role);
        if (role) {
            let normalizedPermissions: any = {};
            if (Array.isArray(role.permissions)) {
                role.permissions.forEach(code => {
                    normalizedPermissions[code] = { VIEW: true, EDIT: false, DELETE: false };
                });
            } else if (typeof role.permissions === 'object' && role.permissions !== null) {
                normalizedPermissions = role.permissions;
            }

            form.setFieldsValue({
                code: role.code,
                name: role.name,
                description: role.description,
                permissions: normalizedPermissions
            });
        } else {
            form.resetFields();
        }
        setIsModalVisible(true);
    };

    const columns = [
        {
            title: 'Mã Role',
            dataIndex: 'code',
            key: 'code',
            render: (text: string) => <Tag color="blue" className="font-bold">{text}</Tag>
        },
        {
            title: 'Tên hiển thị',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <span className="font-semibold text-slate-700">{text}</span>
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            key: 'description',
            render: (text: string) => text || <span className="text-slate-400 italic">Không có mô tả</span>
        },
        {
            title: 'Quyền (Menus)',
            key: 'permissions',
            render: (_: any, record: Role) => {
                if (record.code === 'ADMIN') return <Tag color="red">Toàn quyền (Full)</Tag>;
                let count = 0;
                if (Array.isArray(record.permissions)) {
                    count = record.permissions.length;
                } else if (typeof record.permissions === 'object' && record.permissions !== null) {
                    count = Object.values(record.permissions).filter((p: any) => p?.VIEW || p?.EDIT || p?.DELETE).length;
                }
                return <Tag color={count > 0 ? 'green' : 'default'}>{count} menu</Tag>;
            }
        },
        {
            title: 'Ngày tạo',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (text: string) => dayjs(text).format('DD/MM/YYYY')
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: Role) => {
                const isSystemRole = ['ADMIN', 'CNTT', 'KHOA', 'VTYT', 'HCQT'].includes(record.code);
                return (
                    <Space>
                        <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => openModal(record)} />
                        <Popconfirm
                            title="Bạn có chắc chắn muốn xóa Role này?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Xóa"
                            cancelText="Hủy"
                            disabled={isSystemRole}
                        >
                            <Button size="small" danger icon={<DeleteOutlined />} disabled={isSystemRole} title={isSystemRole ? "Không thể xóa Role hệ thống" : ""} />
                        </Popconfirm>
                    </Space>
                );
            }
        }
    ];

    return (
        <div className="w-full max-w-[1200px] mx-auto px-[30px] py-6 space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-2xl">
                        <SafetyCertificateOutlined />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">Quản lý Vai trò (Role)</h1>
                        <p className="text-slate-500 m-0">Định nghĩa các chức danh và nhóm quyền trong hệ thống.</p>
                    </div>
                </div>
                <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => openModal()} className="bg-purple-600 hover:bg-purple-700 border-none">
                    Tạo Role mới
                </Button>
            </div>

            <Card className="shadow-sm rounded-2xl overflow-hidden border-slate-100" styles={{ body: { padding: 0 } }}>
                <Table 
                    dataSource={roles} 
                    columns={columns} 
                    rowKey="id" 
                    loading={loading}
                    pagination={{ defaultPageSize: 10 }}
                />
            </Card>

            <Modal
                title={selectedRole ? "Cập nhật Role" : "Tạo Role mới"}
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                onOk={() => form.submit()}
                okText="Lưu"
                cancelText="Hủy"
                width={700}
            >
                <Form 
                    form={form} 
                    layout="vertical" 
                    onFinish={handleSave}
                    onValuesChange={(changedValues) => {
                        if (changedValues.permissions) {
                            const changedMenu = Object.keys(changedValues.permissions)[0];
                            if (changedMenu) {
                                const perms = changedValues.permissions[changedMenu];
                                if (perms.EDIT === true || perms.DELETE === true) {
                                    form.setFieldValue(['permissions', changedMenu, 'VIEW'], true);
                                }
                                if (perms.VIEW === false) {
                                    form.setFieldValue(['permissions', changedMenu, 'EDIT'], false);
                                    form.setFieldValue(['permissions', changedMenu, 'DELETE'], false);
                                }
                            }
                        }
                    }}
                >
                    <Form.Item name="code" label="Mã Role (Viết liền không dấu, in hoa)" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
                        <Input disabled={!!selectedRole && ['ADMIN', 'CNTT', 'KHOA', 'VTYT', 'HCQT'].includes(selectedRole.code)} placeholder="Ví dụ: GIAM_DOC, KE_TOAN..." />
                    </Form.Item>

                    <Form.Item name="name" label="Tên hiển thị" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
                        <Input placeholder="Ví dụ: Giám đốc, Kế toán..." />
                    </Form.Item>

                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea rows={2} placeholder="Mô tả ngắn gọn về vai trò này" />
                    </Form.Item>

                    {selectedRole?.code !== 'ADMIN' && (
                        <>
                            <Divider className="my-2" />
                            <div className="font-bold mb-3 text-base">Phân quyền hiển thị Menu Sidebar</div>
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <div className="grid grid-cols-12 gap-2 bg-slate-50 p-3 border-b border-slate-200 font-semibold text-slate-700 text-sm">
                                    <div className="col-span-6">Chức năng</div>
                                    <div className="col-span-2 text-center">Xem</div>
                                    <div className="col-span-2 text-center">Sửa</div>
                                    <div className="col-span-2 text-center">Xóa</div>
                                </div>
                                <div className="max-h-[350px] overflow-y-auto p-3 space-y-3">
                                    {menuPermissions.map(menu => (
                                        <div key={menu.value} className="grid grid-cols-12 gap-2 items-center hover:bg-slate-50 p-1 rounded-md transition-colors">
                                            <div className="col-span-6 text-sm text-slate-700 font-medium">{menu.label}</div>
                                            <div className="col-span-2 flex justify-center">
                                                <Form.Item name={['permissions', menu.value, 'VIEW']} valuePropName="checked" className="mb-0">
                                                    <Checkbox />
                                                </Form.Item>
                                            </div>
                                            <div className="col-span-2 flex justify-center">
                                                <Form.Item name={['permissions', menu.value, 'EDIT']} valuePropName="checked" className="mb-0">
                                                    <Checkbox />
                                                </Form.Item>
                                            </div>
                                            <div className="col-span-2 flex justify-center">
                                                <Form.Item name={['permissions', menu.value, 'DELETE']} valuePropName="checked" className="mb-0">
                                                    <Checkbox />
                                                </Form.Item>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </Form>
            </Modal>
        </div>
    );
}
