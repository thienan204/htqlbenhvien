'use client';

import React, { useState, useEffect } from 'react';
import { Table, Switch, Button, message, Card, Space, Tag, Tabs } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

interface ITUser {
    id: string;
    username: string;
    name: string;
    role: string;
    isAvailable: boolean;
    dutyOrder: number;
}

export default function DutyRosterPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('CNTT');
    const [users, setUsers] = useState<ITUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user && user.role !== 'ADMIN' && ['CNTT', 'VTYT', 'HCQT'].includes(user.role)) {
            setActiveTab(user.role);
        }
    }, [user]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/error-management/duty-roster?targetDepartment=${activeTab}`);
            if (res.ok) {
                const data = await res.json();
                // Ensure array is sorted by dutyOrder
                data.sort((a: ITUser, b: ITUser) => a.dutyOrder - b.dutyOrder);
                setUsers(data);
            } else {
                message.error('Không thể tải danh sách nhân sự');
            }
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [activeTab]);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Update dutyOrder based on array index before saving
            const updatedUsers = users.map((u, index) => ({
                ...u,
                dutyOrder: index + 1
            }));

            const res = await fetch('/api/error-management/duty-roster', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ users: updatedUsers })
            });

            if (res.ok) {
                message.success('Cập nhật ca trực thành công!');
                setUsers(updatedUsers);
            } else {
                message.error('Cập nhật thất bại!');
            }
        } catch (error) {
            message.error('Lỗi khi lưu dữ liệu');
        } finally {
            setSaving(false);
        }
    };

    const moveUser = (index: number, direction: 'up' | 'down') => {
        const newUsers = [...users];
        if (direction === 'up' && index > 0) {
            const temp = newUsers[index - 1];
            newUsers[index - 1] = newUsers[index];
            newUsers[index] = temp;
        } else if (direction === 'down' && index < newUsers.length - 1) {
            const temp = newUsers[index + 1];
            newUsers[index + 1] = newUsers[index];
            newUsers[index] = temp;
        }
        setUsers(newUsers);
    };

    const toggleAvailability = (index: number, checked: boolean) => {
        const newUsers = [...users];
        newUsers[index].isAvailable = checked;
        setUsers(newUsers);
    };

    const columns = [
        {
            title: 'Thứ tự ưu tiên',
            key: 'order',
            width: 150,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => (
                <div className="flex items-center justify-center gap-2">
                    <span className="font-bold text-lg w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 rounded-full">
                        {index + 1}
                    </span>
                    <div className="flex flex-col gap-1">
                        <Button 
                            size="small" 
                            icon={<ArrowUpOutlined />} 
                            disabled={index === 0} 
                            onClick={() => moveUser(index, 'up')}
                        />
                        <Button 
                            size="small" 
                            icon={<ArrowDownOutlined />} 
                            disabled={index === users.length - 1} 
                            onClick={() => moveUser(index, 'down')}
                        />
                    </div>
                </div>
            ),
        },
        {
            title: 'Tài khoản',
            dataIndex: 'username',
            key: 'username',
            render: (text: string) => <span className="font-semibold">{text}</span>
        },
        {
            title: 'Họ tên',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => text || <span className="text-slate-400 italic">Chưa cập nhật</span>
        },
        {
            title: 'Vai trò',
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => <Tag color={role === 'ADMIN' ? 'red' : 'blue'}>{role}</Tag>
        },
        {
            title: 'Trạng thái (Hôm nay)',
            key: 'status',
            align: 'center' as const,
            render: (_: any, record: ITUser, index: number) => (
                <Space>
                    <Switch 
                        checked={record.isAvailable} 
                        onChange={(checked) => toggleAvailability(index, checked)}
                        checkedChildren="Đi làm"
                        unCheckedChildren="Nghỉ"
                    />
                    {record.isAvailable ? (
                        <span className="text-green-600 font-medium ml-2">Sẵn sàng nhận việc</span>
                    ) : (
                        <span className="text-slate-400 font-medium ml-2">Đang nghỉ / Bận</span>
                    )}
                </Space>
            )
        }
    ];

    const allTabItems = [
        { key: 'CNTT', label: 'Công nghệ thông tin' },
        { key: 'VTYT', label: 'Vật tư Y tế' },
        { key: 'HCQT', label: 'Hành chính Quản trị' }
    ];

    const tabItems = allTabItems.filter(item => {
        if (user?.role === 'ADMIN') return true;
        return user?.role === item.key;
    });

    let title = 'Quản lý CNTT';
    if (activeTab === 'VTYT') title = 'Quản lý Vật tư Y tế';
    if (activeTab === 'HCQT') title = 'Quản lý Hành chính Quản trị';

    return (
        <div className="w-full max-w-[1200px] mx-auto px-[30px] py-6 space-y-6">
            {tabItems.length > 1 && (
                <Card className="shadow-sm rounded-2xl overflow-hidden border-slate-100" styles={{ body: { padding: '16px 24px 0 24px' } }}>
                    <Tabs type="card" activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
                </Card>
            )}

            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-1">{title}</h1>
                    <p className="text-slate-500 m-0">Sắp xếp thứ tự ưu tiên nhận phiếu yêu cầu hỗ trợ từ các Khoa.</p>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={fetchUsers} disabled={loading || saving}>Tải lại</Button>
                    <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>Lưu thay đổi</Button>
                </Space>
            </div>

            <Card className="shadow-sm rounded-2xl overflow-hidden" styles={{ body: { padding: 0 } }}>
                <Table 
                    dataSource={users} 
                    columns={columns} 
                    rowKey="id" 
                    pagination={false}
                    loading={loading}
                    rowClassName={(record) => !record.isAvailable ? 'bg-slate-50/50 opacity-80' : ''}
                />
            </Card>
        </div>
    );
}
