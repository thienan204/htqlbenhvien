'use client';

import React, { useState } from 'react';
import {
    AppstoreOutlined, SearchOutlined,
    BellOutlined, MessageOutlined, LogoutOutlined, UserOutlined, KeyOutlined,
    MenuFoldOutlined, MenuUnfoldOutlined, LayoutOutlined
} from '@ant-design/icons';
import { Button, Badge, Avatar, Dropdown, Tooltip } from 'antd';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import EditProfileModal from '../profile/EditProfileModal';
import ChangePasswordModal from '../profile/ChangePasswordModal';
import { getBasePath } from '@/utils/config';
import HorizontalMenuClient from './HorizontalMenuClient';
import Link from 'next/link';

interface TopHeaderProps {
    onToggleSidebar: () => void;
    isSidebarOpen: boolean;
    hideToggle?: boolean;
    menuLayout?: 'horizontal' | 'vertical';
    onToggleLayout?: () => void;
    adminMode?: boolean;
    onToggleAdminMode?: (mode: boolean) => void;
    rules?: any[];
    menus?: any[];
}

const TopHeader = ({ 
    onToggleSidebar, 
    isSidebarOpen, 
    hideToggle, 
    menuLayout = 'horizontal', 
    onToggleLayout, 
    adminMode = false,
    onToggleAdminMode,
    rules = [], 
    menus = [] 
}: TopHeaderProps) => {
    const router = useRouter();
    const { user } = useAuth();
    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
    const [profileInitialTab, setProfileInitialTab] = useState('1');
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

    return (
        <div
            className={`
                h-[60px] bg-white/90 backdrop-blur fixed top-0 right-0 z-10 border-b border-slate-200 px-8 flex items-center justify-between shadow-sm transition-all duration-300 ease-in-out
                ${(isSidebarOpen && menuLayout === 'vertical') ? 'left-[280px]' : 'left-0'}
            `}
        >
            <div className="flex items-center gap-4 flex-1 overflow-hidden">
                {menuLayout === 'horizontal' && (
                    <Link href="/" className="flex items-center gap-2 text-slate-800 font-bold text-xl tracking-tight no-underline shrink-0 pr-4 border-r border-slate-100">
                        <img src={`${getBasePath()}/logo.png`} alt="Logo" className="max-h-[36px] w-auto object-contain" />
                    </Link>
                )}

                {menuLayout === 'vertical' && !hideToggle && (
                    <Button
                        shape="circle"
                        icon={<MenuFoldOutlined className="text-slate-500" />}
                        className="border-none shadow-none bg-transparent hover:bg-slate-100 shrink-0"
                        onClick={onToggleSidebar}
                    />
                )}

                {menuLayout === 'horizontal' && (
                    <div className="flex-1 overflow-hidden ml-2">
                        <HorizontalMenuClient rules={rules} menus={menus} adminMode={adminMode} />
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3 pl-4 shrink-0 ml-4">
                {/* Nút chuyển Không gian làm việc cho ADMIN */}
                {user?.role === 'ADMIN' && onToggleAdminMode && (
                    <div className="bg-slate-100 p-1 rounded-lg flex items-center mr-2 border border-slate-200">
                        <button
                            onClick={() => onToggleAdminMode(false)}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${!adminMode ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Người dùng
                        </button>
                        <button
                            onClick={() => onToggleAdminMode(true)}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${adminMode ? 'bg-white shadow text-red-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Quản trị
                        </button>
                    </div>
                )}

                {onToggleLayout && (
                    <Tooltip title={`Chuyển sang menu ${menuLayout === 'horizontal' ? 'dọc' : 'ngang'}`}>
                        <Button
                            shape="circle"
                            icon={<LayoutOutlined className="text-slate-500" />}
                            className="border-none shadow-none bg-transparent hover:bg-slate-100"
                            onClick={onToggleLayout}
                        />
                    </Tooltip>
                )}
                <div className="h-6 w-px bg-slate-200 mx-1"></div>
                
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
                                    onClick: () => { setProfileInitialTab('1'); setIsEditProfileOpen(true); }
                                },
                                {
                                    key: 'services',
                                    label: 'Phạm vi chuyên môn',
                                    icon: <AppstoreOutlined />, 
                                    onClick: () => { setProfileInitialTab('2'); setIsEditProfileOpen(true); }
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
                                        try {
                                            await fetch('/api/auth/logout', { method: 'POST' });
                                        } catch(e) {}
                                        window.location.href = getBasePath() + '/login';
                                    }
                                }
                            ]
                        }}>
                            <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors">
                                <div className="text-right hidden md:block">
                                    <div className="text-sm font-bold text-slate-700">{(user as any).name || user.username}</div>
                                    <div className="text-xs text-slate-500 font-medium">
                                        {user.ten_khoa ? `${user.role} - ${user.ten_khoa}` : user.role}
                                    </div>
                                    {((user as any).ma_nv || (user as any).cccd) && (
                                        <div className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center justify-end gap-1.5">
                                            {(user as any).ma_nv && <span>Mã NV: <span className="text-slate-500">{(user as any).ma_nv}</span></span>}
                                            {((user as any).ma_nv && (user as any).cccd) && <span className="text-slate-300">|</span>}
                                            {(user as any).cccd && <span>CCCD: <span className="text-slate-500">{(user as any).cccd}</span></span>}
                                        </div>
                                    )}
                                </div>
                                <Avatar size="large" className="bg-blue-500 border-2 border-white shadow-sm">
                                    {((user as any).name || user.username)?.[0]?.toUpperCase()}
                                </Avatar>
                            </div>
                        </Dropdown>

                        <EditProfileModal open={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)} initialTab={profileInitialTab} />
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
