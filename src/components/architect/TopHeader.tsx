'use client';

import React, { useState } from 'react';
import {
    AppstoreOutlined, SearchOutlined,
    BellOutlined, MessageOutlined, LogoutOutlined, UserOutlined, KeyOutlined
} from '@ant-design/icons';
import { Button, Badge, Avatar, Dropdown } from 'antd';
import { logout } from '@/actions/auth';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import EditProfileModal from '../profile/EditProfileModal';
import ChangePasswordModal from '../profile/ChangePasswordModal';

interface TopHeaderProps {
    onToggleSidebar: () => void;
    isSidebarOpen: boolean;
    hideToggle?: boolean;
}

const TopHeader = ({ onToggleSidebar, isSidebarOpen, hideToggle }: TopHeaderProps) => {
    const router = useRouter();
    const { user } = useAuth();
    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

    return (
        <div
            className={`
                h-[60px] bg-white/90 backdrop-blur fixed top-0 right-0 z-10 border-b border-slate-200 px-8 flex items-center justify-between shadow-sm transition-all duration-300 ease-in-out
                ${isSidebarOpen ? 'left-[280px]' : 'left-0'}
            `}
        >
            <div className="flex items-center gap-4">
                {!hideToggle && (
                    <Button
                        shape="circle"
                        icon={<AppstoreOutlined className="text-slate-500" />}
                        className="border-none shadow-none bg-transparent hover:bg-slate-100"
                        onClick={onToggleSidebar}
                    />
                )}
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
                {user ? (
                    <>
                        <Dropdown menu={{
                            items: [
                                ...(user.role === 'ADMIN' ? [{
                                    key: 'menu-builder',
                                    label: 'Menu Builder',
                                    icon: <AppstoreOutlined />,
                                    onClick: () => router.push('/admin/menus')
                                }, {
                                    key: 'dashboard-builder',
                                    label: 'Dashboard Builder',
                                    icon: <AppstoreOutlined />,
                                    onClick: () => router.push('/admin/dashboard-cards')
                                }, {
                                    type: 'divider' as const
                                }] : []),
                                {
                                    key: 'profile',
                                    label: 'Cập nhật Hồ sơ',
                                    icon: <UserOutlined />,
                                    onClick: () => setIsEditProfileOpen(true)
                                },
                                {
                                    key: 'password',
                                    label: 'Đổi Mật khẩu',
                                    icon: <KeyOutlined />,
                                    onClick: () => setIsChangePasswordOpen(true)
                                },
                                {
                                    type: 'divider' as const
                                },
                                {
                                    key: 'logout',
                                    label: 'Đăng xuất',
                                    icon: <LogoutOutlined />,
                                    danger: true,
                                    onClick: async () => {
                                        await logout();
                                        router.push('/login');
                                        router.refresh();
                                    }
                                }
                            ]
                        }}>
                            <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors">
                                <div className="text-right hidden md:block">
                                    <div className="text-sm font-bold text-slate-700">{(user as any).name || user.username}</div>
                                    <div className="text-xs text-slate-400 font-medium">{user.role}</div>
                                </div>
                                <Avatar size="large" className="bg-blue-500 border-2 border-white shadow-sm">
                                    {((user as any).name || user.username)?.[0]?.toUpperCase()}
                                </Avatar>
                            </div>
                        </Dropdown>

                        <EditProfileModal open={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)} />
                        <ChangePasswordModal open={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
                    </>
                ) : (
                    <Button type="primary" onClick={() => router.push('/login')} className="bg-blue-500 hover:bg-blue-600 font-bold shadow-md shadow-blue-200 border-none">
                        Đăng nhập
                    </Button>
                )}
            </div>
        </div>
    );
};

export default TopHeader;
