'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Card, Popconfirm, Tag, Checkbox, Divider, Tooltip, Alert, Badge } from 'antd';
import { 
    PlusOutlined, 
    EditOutlined, 
    DeleteOutlined, 
    SafetyCertificateOutlined, 
    SearchOutlined, 
    EyeOutlined, 
    ThunderboltOutlined, 
    CloseCircleOutlined,
    FolderOutlined,
    InfoCircleOutlined,
    FormOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

interface Role {
    id: string;
    code: string;
    name: string;
    description: string | null;
    permissions?: any;
    createdAt: string;
}

interface MenuItemPermission {
    label: string;
    value: string; // permissionCode
    path?: string;
    groupName: string;
    order: number;
}

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [form] = Form.useForm();
    const [menuPermissions, setMenuPermissions] = useState<MenuItemPermission[]>([]);
    const [permSearchText, setPermSearchText] = useState('');

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
                
                // Map id -> menu để tra cứu tên nhóm cha (parentId)
                const menuMap = new Map<string, any>();
                data.forEach((m: any) => {
                    if (m.id) menuMap.set(m.id, m);
                });

                const perms: MenuItemPermission[] = [];
                const seenCodes = new Set<string>();

                data.forEach((m: any) => {
                    // Ưu tiên permissionCode trong DB, nếu chưa có thì tự sinh từ path
                    let code = m.permissionCode?.trim();
                    if (!code && m.path && m.path !== '/') {
                        code = 'MENU_' + m.path.replace(/^\//, '').replace(/[\/-]/g, '_').toUpperCase();
                    }

                    if (code && !seenCodes.has(code)) {
                        seenCodes.add(code);

                        let groupName = 'Chức năng chung / Khác';
                        if (m.parentId && menuMap.has(m.parentId)) {
                            groupName = menuMap.get(m.parentId).title;
                        } else if (!m.parentId) {
                            groupName = m.title;
                        }

                        perms.push({
                            label: m.title,
                            value: code,
                            path: m.path || m.targetPath || '',
                            groupName,
                            order: m.order ?? 0
                        });
                    }
                });

                // Sắp xếp theo nhóm rồi theo thứ tự order
                perms.sort((a, b) => {
                    if (a.groupName === b.groupName) {
                        return a.order - b.order;
                    }
                    return a.groupName.localeCompare(b.groupName, 'vi');
                });

                setMenuPermissions(perms);
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
        setPermSearchText('');
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

    // Áp dụng quyền hàng loạt (batch preset)
    const applyBatchPermission = (targetMenus: MenuItemPermission[], preset: 'VIEW_ONLY' | 'EDIT_NO_DELETE' | 'FULL' | 'CLEAR') => {
        const currentPerms = form.getFieldValue('permissions') || {};
        const updated = { ...currentPerms };

        targetMenus.forEach(m => {
            if (preset === 'VIEW_ONLY') {
                updated[m.value] = { VIEW: true, EDIT: false, DELETE: false };
            } else if (preset === 'EDIT_NO_DELETE') {
                updated[m.value] = { VIEW: true, EDIT: true, DELETE: false };
            } else if (preset === 'FULL') {
                updated[m.value] = { VIEW: true, EDIT: true, DELETE: true };
            } else if (preset === 'CLEAR') {
                updated[m.value] = { VIEW: false, EDIT: false, DELETE: false };
            }
        });

        form.setFieldsValue({ permissions: updated });
    };

    // Gán nhanh quyền cho 1 chức năng riêng lẻ
    const applySinglePermission = (menuCode: string, preset: 'VIEW_ONLY' | 'EDIT_NO_DELETE' | 'FULL' | 'CLEAR') => {
        const currentPerms = form.getFieldValue('permissions') || {};
        const updated = { ...currentPerms };

        if (preset === 'VIEW_ONLY') {
            updated[menuCode] = { VIEW: true, EDIT: false, DELETE: false };
        } else if (preset === 'EDIT_NO_DELETE') {
            updated[menuCode] = { VIEW: true, EDIT: true, DELETE: false };
        } else if (preset === 'FULL') {
            updated[menuCode] = { VIEW: true, EDIT: true, DELETE: true };
        } else if (preset === 'CLEAR') {
            updated[menuCode] = { VIEW: false, EDIT: false, DELETE: false };
        }

        form.setFieldsValue({ permissions: updated });
    };

    // Lọc danh sách menu theo từ khóa tìm kiếm
    const filteredMenus = useMemo(() => {
        if (!permSearchText.trim()) return menuPermissions;
        const q = permSearchText.trim().toLowerCase();
        return menuPermissions.filter(m => 
            m.label.toLowerCase().includes(q) ||
            m.value.toLowerCase().includes(q) ||
            m.groupName.toLowerCase().includes(q) ||
            (m.path && m.path.toLowerCase().includes(q))
        );
    }, [menuPermissions, permSearchText]);

    // Gom nhóm menu theo Phân hệ cha
    const groupedMenus = useMemo(() => {
        const map = new Map<string, MenuItemPermission[]>();
        filteredMenus.forEach(item => {
            if (!map.has(item.groupName)) {
                map.set(item.groupName, []);
            }
            map.get(item.groupName)!.push(item);
        });
        return Array.from(map.entries());
    }, [filteredMenus]);

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
        <div className="w-full max-w-[98%] mx-auto px-[30px] py-6 space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-2xl">
                        <SafetyCertificateOutlined />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">Quản lý Vai trò & Phân quyền (Role Matrix)</h1>
                        <p className="text-slate-500 m-0">Định nghĩa chức danh và cấu hình quyền Xem, Sửa, Xóa chi tiết theo từng chức năng.</p>
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
                title={
                    <div className="flex items-center gap-2 text-lg font-bold text-slate-800">
                        <SafetyCertificateOutlined className="text-purple-600" />
                        {selectedRole ? `Cập nhật Phân quyền Vai trò: ${selectedRole.name}` : "Tạo Vai trò (Role) mới"}
                    </div>
                }
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                onOk={() => form.submit()}
                okText="Lưu thiết lập"
                cancelText="Đóng"
                width={920}
                style={{ top: 20 }}
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
                                // Nếu chọn Sửa hoặc Xóa -> tự động tick Xem
                                if (perms?.EDIT === true || perms?.DELETE === true) {
                                    form.setFieldValue(['permissions', changedMenu, 'VIEW'], true);
                                }
                                // Nếu bỏ chọn Xem -> tự động bỏ cả Sửa và Xóa
                                if (perms?.VIEW === false) {
                                    form.setFieldValue(['permissions', changedMenu, 'EDIT'], false);
                                    form.setFieldValue(['permissions', changedMenu, 'DELETE'], false);
                                }
                            }
                        }
                    }}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Form.Item name="code" label="Mã Role (In hoa, viết liền)" rules={[{ required: true, message: 'Bắt buộc nhập mã vai trò' }]}>
                            <Input disabled={!!selectedRole && ['ADMIN', 'CNTT', 'KHOA', 'VTYT', 'HCQT'].includes(selectedRole.code)} placeholder="Ví dụ: GIAM_DOC, DIEU_DUONG_TRUONG..." />
                        </Form.Item>

                        <Form.Item name="name" label="Tên hiển thị vai trò" rules={[{ required: true, message: 'Bắt buộc nhập tên vai trò' }]}>
                            <Input placeholder="Ví dụ: Giám đốc bệnh viện, Điều dưỡng trưởng..." />
                        </Form.Item>
                    </div>

                    <Form.Item name="description" label="Mô tả nhiệm vụ / ghi chú" className="mb-3">
                        <Input.TextArea rows={2} placeholder="Mô tả phạm vi quyền hạn và trách nhiệm của vai trò này" />
                    </Form.Item>

                    {selectedRole?.code !== 'ADMIN' ? (
                        <>
                            <Divider className="my-3" />
                            
                            {/* Chú thích trực quan về các loại quyền */}
                            <Alert
                                type="info"
                                showIcon
                                icon={<InfoCircleOutlined />}
                                className="mb-3 bg-purple-50/60 border-purple-200"
                                title={<span className="font-semibold text-purple-900">Quy tắc phân quyền chi tiết (Xem / Sửa / Xóa)</span>}
                                description={
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1 text-xs text-slate-700">
                                        <div className="bg-white p-2 rounded border border-purple-100">
                                            <span className="font-bold text-blue-600">👁️ Chỉ xem:</span> Vào được màn hình để tra cứu số liệu; ẩn các nút Thêm mới, Sửa, Lưu, Nhận việc và Xóa.
                                        </div>
                                        <div className="bg-white p-2 rounded border border-purple-100">
                                            <span className="font-bold text-amber-600">✏️ Sửa (Không xóa):</span> Cho phép nhập liệu, chỉnh sửa và cập nhật dữ liệu nhưng ẩn/khóa nút Xóa bản ghi.
                                        </div>
                                        <div className="bg-white p-2 rounded border border-purple-100">
                                            <span className="font-bold text-emerald-600">⚡ Toàn quyền:</span> Đầy đủ quyền Xem, Tạo mới, Chỉnh sửa, Nhận việc và Xóa dữ liệu của chức năng đó.
                                        </div>
                                    </div>
                                }
                            />

                            {/* Thanh công cụ tìm kiếm và Thao tác nhanh cho toàn bộ menu */}
                            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 mb-3 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="w-full md:w-72">
                                        <Input
                                            prefix={<SearchOutlined className="text-slate-400" />}
                                            placeholder="Tìm kiếm chức năng / mã quyền..."
                                            allowClear
                                            value={permSearchText}
                                            onChange={e => setPermSearchText(e.target.value)}
                                            size="middle"
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                                        <span className="text-slate-500 mr-1">Áp dụng tất cả:</span>
                                        <Button 
                                            size="small" 
                                            icon={<EyeOutlined />} 
                                            onClick={() => applyBatchPermission(filteredMenus, 'VIEW_ONLY')}
                                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                        >
                                            Chỉ xem
                                        </Button>
                                        <Button 
                                            size="small" 
                                            icon={<FormOutlined />} 
                                            onClick={() => applyBatchPermission(filteredMenus, 'EDIT_NO_DELETE')}
                                            className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                        >
                                            Xem & Sửa (Không xóa)
                                        </Button>
                                        <Button 
                                            size="small" 
                                            icon={<ThunderboltOutlined />} 
                                            onClick={() => applyBatchPermission(filteredMenus, 'FULL')}
                                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                        >
                                            Toàn quyền
                                        </Button>
                                        <Button 
                                            size="small" 
                                            danger 
                                            icon={<CloseCircleOutlined />} 
                                            onClick={() => applyBatchPermission(filteredMenus, 'CLEAR')}
                                        >
                                            Khóa hết
                                        </Button>
                                    </div>
                                </div>
                                {permSearchText && (
                                    <div className="text-xs text-slate-500 flex items-center justify-between">
                                        <span>Tìm thấy <b>{filteredMenus.length}</b> chức năng phù hợp trong <b>{groupedMenus.length}</b> phân hệ</span>
                                        <Button type="link" size="small" className="p-0 h-auto text-xs" onClick={() => setPermSearchText('')}>Xóa bộ lọc</Button>
                                    </div>
                                )}
                            </div>

                            {/* Bảng phân quyền chi tiết gom theo phân hệ */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                {/* Header bảng */}
                                <div className="grid grid-cols-12 gap-2 bg-slate-100/80 p-2.5 border-b border-slate-200 font-bold text-slate-700 text-xs uppercase tracking-wider">
                                    <div className="col-span-5 pl-2">Chức năng & Phân hệ</div>
                                    <div className="col-span-1 text-center text-blue-700">Xem</div>
                                    <div className="col-span-1 text-center text-amber-700">Sửa</div>
                                    <div className="col-span-1 text-center text-rose-700">Xóa</div>
                                    <div className="col-span-4 text-center text-slate-600">Thao tác nhanh</div>
                                </div>

                                <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-100 p-1">
                                    {groupedMenus.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400 text-sm">
                                            Không tìm thấy chức năng nào phù hợp với từ khóa &ldquo;{permSearchText}&rdquo;
                                        </div>
                                    ) : (
                                        groupedMenus.map(([groupName, items]) => (
                                            <div key={groupName} className="py-2 px-1">
                                                {/* Header của từng chuyên mục / nhóm */}
                                                <div className="flex items-center justify-between bg-slate-50/80 px-3 py-1.5 rounded-lg border border-slate-200/60 mb-1.5">
                                                    <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                                                        <FolderOutlined className="text-purple-600" />
                                                        <span>{groupName}</span>
                                                        <Badge count={items.length} className="site-badge-count-4" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }} />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[11px] text-slate-400 mr-1 hidden sm:inline">Nhóm này:</span>
                                                        <Button 
                                                            size="small" 
                                                            type="text" 
                                                            className="text-[11px] h-6 px-1.5 text-blue-600 hover:bg-blue-50"
                                                            onClick={() => applyBatchPermission(items, 'VIEW_ONLY')}
                                                        >
                                                            Chỉ xem
                                                        </Button>
                                                        <Button 
                                                            size="small" 
                                                            type="text" 
                                                            className="text-[11px] h-6 px-1.5 text-amber-600 hover:bg-amber-50"
                                                            onClick={() => applyBatchPermission(items, 'EDIT_NO_DELETE')}
                                                        >
                                                            Xem & Sửa
                                                        </Button>
                                                        <Button 
                                                            size="small" 
                                                            type="text" 
                                                            className="text-[11px] h-6 px-1.5 text-emerald-600 hover:bg-emerald-50"
                                                            onClick={() => applyBatchPermission(items, 'FULL')}
                                                        >
                                                            Toàn quyền
                                                        </Button>
                                                        <Button 
                                                            size="small" 
                                                            type="text" 
                                                            className="text-[11px] h-6 px-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                            onClick={() => applyBatchPermission(items, 'CLEAR')}
                                                        >
                                                            Tắt
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Danh sách các chức năng con trong nhóm */}
                                                <div className="space-y-1 pl-1 pr-1">
                                                    {items.map(menu => (
                                                        <div key={menu.value} className="grid grid-cols-12 gap-2 items-center hover:bg-purple-50/40 px-2 py-1.5 rounded-md transition-colors text-xs">
                                                            <div className="col-span-5">
                                                                <div className="font-semibold text-slate-800 leading-tight">{menu.label}</div>
                                                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                                                    <code className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[10px]">{menu.value}</code>
                                                                    {menu.path && <span className="truncate max-w-[150px]">{menu.path}</span>}
                                                                </div>
                                                            </div>
                                                            <div className="col-span-1 flex justify-center">
                                                                <Form.Item name={['permissions', menu.value, 'VIEW']} valuePropName="checked" className="mb-0">
                                                                    <Checkbox />
                                                                </Form.Item>
                                                            </div>
                                                            <div className="col-span-1 flex justify-center">
                                                                <Form.Item name={['permissions', menu.value, 'EDIT']} valuePropName="checked" className="mb-0">
                                                                    <Checkbox />
                                                                </Form.Item>
                                                            </div>
                                                            <div className="col-span-1 flex justify-center">
                                                                <Form.Item name={['permissions', menu.value, 'DELETE']} valuePropName="checked" className="mb-0">
                                                                    <Checkbox />
                                                                </Form.Item>
                                                            </div>
                                                            <div className="col-span-4 flex justify-center items-center gap-1">
                                                                <Tooltip title="Chỉ xem: Bật Xem, tắt Sửa & Xóa">
                                                                    <Button 
                                                                        size="small" 
                                                                        type="dashed" 
                                                                        className="text-[10px] h-5 px-1 text-blue-600"
                                                                        onClick={() => applySinglePermission(menu.value, 'VIEW_ONLY')}
                                                                    >
                                                                        Chỉ xem
                                                                    </Button>
                                                                </Tooltip>
                                                                <Tooltip title="Xem & Sửa: Cho phép sửa nhưng không cho xóa">
                                                                    <Button 
                                                                        size="small" 
                                                                        type="dashed" 
                                                                        className="text-[10px] h-5 px-1 text-amber-600"
                                                                        onClick={() => applySinglePermission(menu.value, 'EDIT_NO_DELETE')}
                                                                    >
                                                                        Sửa (ko xóa)
                                                                    </Button>
                                                                </Tooltip>
                                                                <Tooltip title="Toàn quyền: Đầy đủ Xem, Sửa, Xóa">
                                                                    <Button 
                                                                        size="small" 
                                                                        type="dashed" 
                                                                        className="text-[10px] h-5 px-1 text-emerald-600"
                                                                        onClick={() => applySinglePermission(menu.value, 'FULL')}
                                                                    >
                                                                        Full
                                                                    </Button>
                                                                </Tooltip>
                                                                <Tooltip title="Bỏ chọn chức năng này">
                                                                    <Button 
                                                                        size="small" 
                                                                        type="text" 
                                                                        className="text-[10px] h-5 px-1 text-slate-400 hover:text-red-500"
                                                                        onClick={() => applySinglePermission(menu.value, 'CLEAR')}
                                                                    >
                                                                        X
                                                                    </Button>
                                                                </Tooltip>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <Alert 
                            type="success" 
                            showIcon 
                            className="mt-4"
                            title="Vai trò Quản trị viên Tối cao (ADMIN)" 
                            description="Role ADMIN mặc định có toàn bộ quyền Xem, Sửa và Xóa trên tất cả các menu và tính năng của hệ thống." 
                        />
                    )}
                </Form>
            </Modal>
        </div>
    );
}

