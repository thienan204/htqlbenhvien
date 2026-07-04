'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, message, Card, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface User {
    id: string;
    username: string;
    name: string | null;
    role: string;
    ma_khoa: string | null;
    staffId: string | null;
    telegram_id: string | null;
    createdAt: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [allStaffs, setAllStaffs] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [form] = Form.useForm();
    const [selectedRole, setSelectedRole] = useState<string>('USER');
    const [mounted, setMounted] = useState(false);
    
    // Filters
    const [searchText, setSearchText] = useState('');
    const [filterRole, setFilterRole] = useState<string | null>(null);
    const [filterDept, setFilterDept] = useState<string | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            } else {
                message.error('Không thể tải danh sách tài khoản');
            }
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    const fetchDepartments = async () => {
        try {
            const res = await fetch('/api/departments');
            if (res.ok) {
                const data = await res.json();
                setDepartments(data);
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách khoa', error);
        }
    };

    const fetchRoles = async () => {
        try {
            const res = await fetch('/api/roles');
            if (res.ok) {
                const data = await res.json();
                setRoles(data);
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách Role', error);
        }
    };

    const fetchAllStaffs = async () => {
        try {
            const res = await fetch('/api/staff');
            if (res.ok) {
                const data = await res.json();
                setAllStaffs(data);
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách Nhân viên', error);
        }
    };

    useEffect(() => {
        setMounted(true);
        fetchUsers();
        fetchDepartments();
        fetchRoles();
        fetchAllStaffs();
    }, []);

    const handleSave = async (values: any) => {
        const isUpdate = !!selectedUser;
        const url = '/api/users';
        const method = isUpdate ? 'PUT' : 'POST';
        
        const payload = {
            id: selectedUser?.id,
            ...values
        };

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success(`${isUpdate ? 'Cập nhật' : 'Tạo'} tài khoản thành công!`);
                setIsModalVisible(false);
                fetchUsers();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi lưu tài khoản');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/users?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                message.success('Xóa tài khoản thành công!');
                fetchUsers();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi xóa tài khoản');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const openModal = (user: User | null = null) => {
        setSelectedUser(user);
        if (user) {
            setSelectedRole(user.role);
            form.setFieldsValue({
                username: user.username,
                name: user.name,
                role: user.role,
                ma_khoa: user.ma_khoa,
                staffId: user.staffId,
                telegram_id: user.telegram_id,
                password: '' // Không show password cũ
            });
        } else {
            setSelectedRole('KHOA'); // Default
            form.resetFields();
            form.setFieldsValue({ role: 'KHOA' });
        }
        setIsModalVisible(true);
    };

    const columns = [
        {
            title: 'Tài khoản',
            dataIndex: 'username',
            key: 'username',
            render: (text: string) => <span className="font-semibold text-blue-600">{text}</span>
        },
        {
            title: 'Họ tên',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => text || <span className="text-slate-400 italic">Chưa có</span>
        },
        {
            title: 'Vai trò (Role)',
            dataIndex: 'role',
            key: 'role',
            render: (roleCode: string) => {
                const foundRole = roles.find(r => r.code === roleCode);
                let color = 'default';
                if (roleCode === 'ADMIN') color = 'red';
                else if (roleCode === 'CNTT') color = 'blue';
                else if (roleCode === 'VTYT') color = 'green';
                else if (roleCode === 'HCQT') color = 'orange';
                else if (roleCode === 'KHOA') color = 'green';
                return <Tag color={color}>{foundRole ? foundRole.name : roleCode}</Tag>;
            }
        },
        {
            title: 'Khoa / Phòng',
            dataIndex: 'ma_khoa',
            key: 'ma_khoa',
            render: (text: string, record: User) => {
                if (record.role !== 'KHOA') return '-';
                const dept = departments.find(d => d.ma_khoa === text);
                return dept ? `${dept.ten_khoa} (${text})` : text || <span className="text-red-500 italic">Chưa gán</span>;
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
            render: (_: any, record: User) => (
                <Space>
                    <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => openModal(record)} />
                    <Popconfirm
                        title="Bạn có chắc chắn muốn xóa tài khoản này?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Button size="small" danger icon={<DeleteOutlined />} disabled={record.username === 'admin'} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const filteredUsers = users.filter(u => {
        const matchText = (u.username?.toLowerCase().includes(searchText.toLowerCase())) || 
                          (u.name && u.name.toLowerCase().includes(searchText.toLowerCase()));
        const matchRole = filterRole ? u.role === filterRole : true;
        const matchDept = filterDept ? u.ma_khoa === filterDept : true;
        return matchText && matchRole && matchDept;
    });

    return (
        <div className="w-full max-w-[1200px] mx-auto px-[30px] py-6 space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl">
                        <UserOutlined />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">Quản lý Tài khoản</h1>
                        <p className="text-slate-500 m-0">Thêm, sửa, xóa và phân quyền người dùng trong hệ thống.</p>
                    </div>
                </div>
                <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => openModal()}>
                    Tạo Tài khoản mới
                </Button>
            </div>

            <Card className="shadow-sm rounded-2xl overflow-hidden border-slate-100" styles={{ body: { padding: 0 } }}>
                <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 bg-slate-50/50">
                    <Input 
                        placeholder="Tìm kiếm tài khoản, họ tên..." 
                        prefix={<SearchOutlined className="text-slate-400" />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="max-w-md rounded-lg"
                        size="large"
                    />
                    <Select
                        placeholder="Lọc Vai trò (Role)"
                        allowClear
                        showSearch
                        size="large"
                        className="min-w-[200px]"
                        value={filterRole}
                        onChange={setFilterRole}
                        options={roles.map(r => ({ label: `${r.name} (${r.code})`, value: r.code }))}
                        optionFilterProp="label"
                    />
                    <Select
                        placeholder="Lọc Khoa/Phòng"
                        allowClear
                        showSearch
                        size="large"
                        className="min-w-[200px]"
                        value={filterDept}
                        onChange={setFilterDept}
                        options={departments.map(d => ({ label: `${d.ten_khoa} (${d.ma_khoa})`, value: d.ma_khoa }))}
                        optionFilterProp="label"
                    />
                </div>
                <Table 
                    dataSource={filteredUsers} 
                    columns={columns} 
                    rowKey="id" 
                    loading={loading}
                    pagination={{ defaultPageSize: 10 }}
                />
            </Card>

            {mounted && (
                <Modal
                    title={selectedUser ? "Cập nhật Tài khoản" : "Tạo Tài khoản mới"}
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                onOk={() => form.submit()}
                okText="Lưu"
                cancelText="Hủy"
                forceRender
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
                        <Input disabled={!!selectedUser && selectedUser.username === 'admin'} />
                    </Form.Item>

                    <Form.Item 
                        name="password" 
                        label={selectedUser ? "Mật khẩu (Bỏ trống nếu không muốn đổi)" : "Mật khẩu"} 
                        rules={[{ required: !selectedUser, message: 'Bắt buộc nhập' }]}
                    >
                        <Input.Password />
                    </Form.Item>

                    <Form.Item name="name" label="Họ và tên">
                        <Input />
                    </Form.Item>

                    <Form.Item name="role" label="Vai trò (Role)" rules={[{ required: true, message: 'Bắt buộc chọn' }]}>
                        <Select onChange={(value) => setSelectedRole(value)} disabled={!!selectedUser && selectedUser.username === 'admin'} showSearch optionFilterProp="children">
                            {roles.map(r => (
                                <Select.Option key={r.code} value={r.code}>{r.name} ({r.code})</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {selectedRole === 'KHOA' && (
                        <Form.Item name="ma_khoa" label="Phân quyền vào Khoa" rules={[{ required: true, message: 'Bắt buộc chọn Khoa' }]}>
                            <Select showSearch optionFilterProp="children" placeholder="Chọn khoa...">
                                {departments.map(d => (
                                    <Select.Option key={d.ma_khoa} value={d.ma_khoa}>
                                        {d.ten_khoa} ({d.ma_khoa})
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    )}

                    <Form.Item name="staffId" label="Liên kết với Nhân viên (Tài khoản cá nhân)" help="Chọn để gán tài khoản này cho một nhân viên cụ thể (giúp tự động chốt tên khi báo lỗi).">
                        <Select 
                            showSearch 
                            optionFilterProp="children" 
                            placeholder="Chọn nhân viên..." 
                            allowClear
                            onChange={(val) => {
                                if (val) {
                                    const staff = allStaffs.find(s => s.id === val);
                                    if (staff && !form.getFieldValue('name')) {
                                        form.setFieldsValue({ name: staff.ho_ten });
                                    }
                                }
                            }}
                        >
                            {allStaffs.map(s => (
                                <Select.Option key={s.id} value={s.id}>
                                    {s.ho_ten} {s.chuc_danh ? `(${s.chuc_danh})` : ''} - {departments.find(d => d.ma_khoa === s.ma_khoa)?.ten_khoa || s.ma_khoa}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="telegram_id" label="Tài khoản Telegram (@username hoặc ID)" help="Chỉ dành cho phòng IT để Bot tag tên trên nhóm khi có yêu cầu mới (ví dụ: @mocthao)">
                        <Input placeholder="@username" />
                    </Form.Item>
                </Form>
            </Modal>
            )}
        </div>
    );
}
