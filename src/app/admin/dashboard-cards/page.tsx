'use client';
// Force Next.js recompilation

import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Form, Input, Select, Switch, message, Modal, Popconfirm, Tag, Space, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import * as Icons from '@ant-design/icons';

const { Option } = Select;

// Các theme màu hỗ trợ
const THEMES = [
    { label: 'Cyan (Xanh dương nhạt)', bg: 'bg-cyan-50', border: 'border-cyan-200', hover: 'hover:border-cyan-500' },
    { label: 'Rose (Hồng/Đỏ nhạt)', bg: 'bg-rose-50', border: 'border-rose-200', hover: 'hover:border-rose-500' },
    { label: 'Indigo (Tím nhạt)', bg: 'bg-indigo-50', border: 'border-indigo-200', hover: 'hover:border-indigo-500' },
    { label: 'Emerald (Xanh lá)', bg: 'bg-emerald-50', border: 'border-emerald-200', hover: 'hover:border-emerald-500' },
    { label: 'Amber (Vàng/Cam)', bg: 'bg-amber-50', border: 'border-amber-200', hover: 'hover:border-amber-500' },
    { label: 'Purple (Tím đậm)', bg: 'bg-purple-50', border: 'border-purple-200', hover: 'hover:border-purple-500' },
    { label: 'Blue (Xanh dương)', bg: 'bg-blue-50', border: 'border-blue-200', hover: 'hover:border-blue-500' }
];

const ICON_LIST = [
    'FileSearchOutlined', 'TeamOutlined', 'DesktopOutlined', 'WarningOutlined',
    'DatabaseOutlined', 'AppstoreOutlined', 'SettingOutlined', 'DashboardOutlined',
    'SafetyCertificateOutlined', 'BankOutlined', 'FileTextOutlined', 'ExceptionOutlined',
    'ReconciliationOutlined', 'BarChartOutlined', 'PictureOutlined', 'UserOutlined',
    'ProjectOutlined', 'FolderOutlined', 'CheckSquareOutlined', 'DollarOutlined',
    'MedicineBoxOutlined', 'HeartOutlined', 'IdcardOutlined'
];

interface DashboardCard {
    id: string;
    title: string;
    description: string | null;
    icon: string | null;
    href: string;
    bgColor: string | null;
    borderColor: string | null;
    hoverColor: string | null;
    order: number;
    isActive: boolean;
}

export default function DashboardCardBuilder() {
    const [cards, setCards] = useState<DashboardCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        fetchCards();
    }, []);

    const fetchCards = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dashboard-cards');
            if (res.ok) {
                const data = await res.json();
                setCards(data);
            }
        } catch (error) {
            message.error('Lỗi khi tải danh sách thẻ');
        } finally {
            setLoading(false);
        }
    };

    const handleSeed = async () => {
        // Init default cards if empty
        const defaultCards = [
            {
                title: 'Kiểm tra hồ sơ XML',
                description: 'Công cụ phát hiện lỗi logic, quy tắc bảo hiểm tự động.',
                icon: 'FileSearchOutlined',
                href: '/xml-checker',
                bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200', hoverColor: 'hover:border-cyan-500',
                order: 10, isActive: true
            },
            {
                title: 'Xử lý yêu cầu lỗi (IT)',
                description: 'Tiếp nhận và xử lý các sự cố từ các khoa phòng.',
                icon: 'WarningOutlined',
                href: '/error-management',
                bgColor: 'bg-rose-50', borderColor: 'border-rose-200', hoverColor: 'hover:border-rose-500',
                order: 20, isActive: true
            },
            {
                title: 'Quản lý Nhân sự',
                description: 'Quản lý danh sách, hồ sơ cán bộ nhân viên bệnh viện.',
                icon: 'TeamOutlined',
                href: '/staff',
                bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200', hoverColor: 'hover:border-indigo-500',
                order: 30, isActive: true
            },
            {
                title: 'Quản lý Thiết bị & Vật tư',
                description: 'Theo dõi tài sản, nhập/xuất kho và khấu hao thiết bị.',
                icon: 'DesktopOutlined',
                href: '#',
                bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', hoverColor: 'hover:border-emerald-500',
                order: 40, isActive: true
            },
            {
                title: 'Báo cáo & Danh mục',
                description: 'Quản lý các danh mục chuẩn, xuất báo cáo Mẫu 01-06.',
                icon: 'DatabaseOutlined',
                href: '/mau01-catalog',
                bgColor: 'bg-amber-50', borderColor: 'border-amber-200', hoverColor: 'hover:border-amber-500',
                order: 50, isActive: true
            },
            {
                title: 'Chuyên đề',
                description: 'Quản lý quy tắc và chạy các báo cáo chuyên đề y tế.',
                icon: 'AppstoreOutlined',
                href: '/chuyen-de',
                bgColor: 'bg-purple-50', borderColor: 'border-purple-200', hoverColor: 'hover:border-purple-500',
                order: 60, isActive: true
            }
        ];

        setLoading(true);
        for (const c of defaultCards) {
            await fetch('/api/dashboard-cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(c)
            });
        }
        await fetchCards();
        message.success('Đã nạp 6 thẻ mặc định!');
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            
            // Xử lý bộ màu từ theme được chọn
            if (values.themeIndex !== undefined) {
                const theme = THEMES[values.themeIndex];
                values.bgColor = theme.bg;
                values.borderColor = theme.border;
                values.hoverColor = theme.hover;
            }
            delete values.themeIndex;

            const url = editingId ? `/api/dashboard-cards/${editingId}` : '/api/dashboard-cards';
            const method = editingId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...values,
                    order: editingId ? values.order : cards.length * 10 + 10 // auto order
                })
            });

            if (res.ok) {
                message.success(editingId ? 'Đã cập nhật' : 'Đã thêm mới');
                setIsModalVisible(false);
                fetchCards();
            } else {
                message.error('Lỗi khi lưu');
            }
        } catch (error) {
            console.log(error);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/dashboard-cards/${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa thẻ');
                fetchCards();
            }
        } catch (e) {
            message.error('Lỗi kết nối');
        }
    };

    const handleReorder = async (id: string, direction: 'up' | 'down') => {
        const index = cards.findIndex(c => c.id === id);
        if (index === -1) return;
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === cards.length - 1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const newCards = [...cards];
        
        // Hoán đổi order
        const tempOrder = newCards[index].order;
        newCards[index].order = newCards[targetIndex].order;
        newCards[targetIndex].order = tempOrder;

        // Cập nhật lên server
        const updates = [
            { id: newCards[index].id, order: newCards[index].order },
            { id: newCards[targetIndex].id, order: newCards[targetIndex].order }
        ];

        setCards(newCards.sort((a, b) => a.order - b.order));

        await fetch('/api/dashboard-cards', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
    };

    const renderIcon = (iconName: string | null) => {
        if (!iconName) return null;
        const Icon = (Icons as any)[iconName];
        return Icon ? <Icon /> : null;
    };

    const columns = [
        {
            title: 'Sắp xếp',
            key: 'sort',
            width: 100,
            render: (_: any, record: DashboardCard, index: number) => (
                <Space>
                    <Button 
                        icon={<ArrowUpOutlined />} 
                        size="small" 
                        disabled={index === 0}
                        onClick={() => handleReorder(record.id, 'up')}
                    />
                    <Button 
                        icon={<ArrowDownOutlined />} 
                        size="small" 
                        disabled={index === cards.length - 1}
                        onClick={() => handleReorder(record.id, 'down')}
                    />
                </Space>
            )
        },
        {
            title: 'Hiển thị',
            key: 'preview',
            render: (_: any, record: DashboardCard) => (
                <div className={`p-3 rounded border ${record.bgColor} ${record.borderColor} flex items-center gap-3 max-w-[300px]`}>
                    <div className="text-2xl p-2 bg-white rounded shadow-sm">
                        {renderIcon(record.icon)}
                    </div>
                    <div>
                        <div className="font-bold text-sm truncate">{record.title}</div>
                        <div className="text-xs opacity-70 truncate">{record.href}</div>
                    </div>
                </div>
            )
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (isActive: boolean) => (
                <Tag color={isActive ? 'success' : 'default'}>{isActive ? 'Đang bật' : 'Đã tắt'}</Tag>
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: DashboardCard) => (
                <Space>
                    <Button 
                        type="primary" 
                        ghost 
                        icon={<EditOutlined />} 
                        onClick={() => {
                            setIsModalVisible(true);
                            setTimeout(() => {
                                setEditingId(record.id);
                                let themeIndex = THEMES.findIndex(t => t.bg === record.bgColor);
                                form.setFieldsValue({
                                    ...record,
                                    themeIndex: themeIndex !== -1 ? themeIndex : undefined
                                });
                            }, 0);
                        }}
                    >
                        Sửa
                    </Button>
                    <Popconfirm title="Chắc chắn xóa?" onConfirm={() => handleDelete(record.id)}>
                        <Button danger icon={<DeleteOutlined />}>Xóa</Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Dashboard Builder</h1>
                    <p className="text-slate-500">Quản lý các Thẻ (Cards) hiển thị ở màn hình Trang chủ hệ thống</p>
                </div>
                <div className="space-x-3">
                    {cards.length === 0 && (
                        <Button onClick={handleSeed} type="dashed">Nạp 6 Thẻ Mặc định</Button>
                    )}
                    <Button onClick={fetchCards} icon={<ReloadOutlined />}>Làm mới</Button>
                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />}
                        onClick={() => {
                            setIsModalVisible(true);
                            setTimeout(() => {
                                setEditingId(null);
                                form.resetFields();
                                form.setFieldsValue({ isActive: true });
                            }, 0);
                        }}
                    >
                        Thêm Thẻ Mới
                    </Button>
                </div>
            </div>

            <Card className="shadow-sm rounded-xl">
                <Table 
                    columns={columns} 
                    dataSource={cards} 
                    rowKey="id" 
                    pagination={false}
                    loading={loading}
                />
            </Card>

            <Modal
                title={editingId ? 'Chỉnh sửa Thẻ' : 'Thêm Thẻ mới'}
                open={isModalVisible}
                onOk={handleSave}
                onCancel={() => setIsModalVisible(false)}
                width={700}
                destroyOnHidden
            >
                <Form form={form} layout="vertical" className="mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item name="title" label="Tiêu đề" rules={[{ required: true }]}>
                            <Input placeholder="VD: Quản lý Nhân sự" />
                        </Form.Item>
                        <Form.Item name="href" label="Đường dẫn (URL)" rules={[{ required: true }]}>
                            <Input placeholder="VD: /staff" />
                        </Form.Item>
                    </div>

                    <Form.Item name="description" label="Mô tả phụ">
                        <Input.TextArea rows={2} placeholder="Mô tả ngắn gọn về chức năng của thẻ này" />
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item name="icon" label="Biểu tượng (Icon)">
                            <Select placeholder="Chọn Icon" allowClear showSearch>
                                {ICON_LIST.map(icon => {
                                    const IconCmp = (Icons as any)[icon];
                                    return (
                                        <Option key={icon} value={icon}>
                                            <div className="flex items-center gap-3">
                                                {IconCmp && <IconCmp className="text-lg text-slate-500" />}
                                                <span>{icon}</span>
                                            </div>
                                        </Option>
                                    )
                                } )}
                            </Select>
                        </Form.Item>

                        <Form.Item name="themeIndex" label="Màu sắc chủ đạo">
                            <Select placeholder="Chọn màu">
                                {THEMES.map((theme, index) => (
                                    <Option key={index} value={index}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded-full border ${theme.bg} ${theme.border}`}></div>
                                            {theme.label}
                                        </div>
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </div>

                    <Form.Item name="isActive" valuePropName="checked" label="Trạng thái hiển thị ở Trang chủ">
                        <Switch checkedChildren="Đang bật" unCheckedChildren="Đã tắt" />
                    </Form.Item>
                    
                    <Form.Item name="order" hidden><Input /></Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
