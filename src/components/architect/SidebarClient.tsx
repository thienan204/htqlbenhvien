'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import * as Icons from '@ant-design/icons';
import { Tag } from 'antd';
import { usePathname } from 'next/navigation';
import { getBasePath } from '@/utils/config';
import { useAuth } from '@/contexts/AuthContext';
import { SYSTEM_CONFIG } from '@/config/systemVersion';
import SystemVersionModal from '../common/SystemVersionModal';

interface SidebarClientProps {
    rules: any[]; 
    menus?: any[];
    isOpen: boolean;
    adminMode?: boolean;
    adminOnlyPaths?: string[];
}

const checkPathMatch = (patterns: string[], currentPath: string) => {
    if (!patterns || patterns.length === 0) return true;
    return patterns.some((pattern: string) => {
        const cleanPattern = pattern.replace(/\/\*$/, '').replace(/\*$/, '');
        return currentPath === cleanPattern || currentPath.startsWith(`${cleanPattern}/`) || currentPath.startsWith(pattern);
    });
};

const isMenuAdmin = (menu: any, rules: any[], allMenus: any[], adminOnlyPaths: string[]): boolean => {
    if (menu.isAdminOnly) return true;
    if (menu.path) {
        return adminOnlyPaths.some(p => menu.path.startsWith(p));
    }
    const children = allMenus.filter(m => m.parentId === menu.id);
    if (children.length > 0) {
        return children.every(c => isMenuAdmin(c, rules, allMenus, adminOnlyPaths));
    }
    return false;
};


export default function SidebarClient({ rules, menus = [], isOpen, adminMode = false, adminOnlyPaths = [] }: SidebarClientProps) {
    const { user, hasPermission } = useAuth();
    const pathname = usePathname();
    const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);

    const allRootMenus = menus.filter(m => !m.parentId).sort((a, b) => a.order - b.order);
    
    const rootMenus = allRootMenus.filter(group => {
        if (!group.showInPaths || group.showInPaths.length === 0) return true;
        return checkPathMatch(group.showInPaths, pathname);
    });

    const renderIcon = (iconName: string | null) => {
        if (!iconName) return null;
        const Icon = (Icons as any)[iconName];
        return Icon ? <Icon className="text-lg opacity-70" /> : <Icons.AppstoreOutlined className="text-lg opacity-70" />;
    };

    const getLinkClass = (path: string | null) => {
        if (!path) return "text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors";
        const isActive = path === '/' ? pathname === '/' : pathname.startsWith(path);
        return isActive 
            ? "bg-blue-50 text-blue-600 rounded-lg px-4 py-2.5 font-semibold flex items-center gap-3 cursor-pointer transition-colors"
            : "text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors";
    };

    return (
        <div
            className={`
                bg-white h-screen fixed left-0 top-0 border-r border-slate-200 z-20 flex flex-col font-sans transition-all duration-300 ease-in-out
                ${isOpen ? 'w-[280px] translate-x-0' : 'w-[280px] -translate-x-full'}
            `}
        >
            {/* Logo Area */}
            <div className="h-[60px] flex items-center px-6 border-b border-slate-100">
                <Link href="/" className="flex items-center gap-2 text-slate-800 font-bold text-xl tracking-tight no-underline hover:text-slate-800 h-full">
                    <img src={`${getBasePath()}/logo.png`} alt="Logo" className="max-h-[40px] w-auto object-contain" />
                </Link>
            </div>

            {/* Scrollable Nav */}
            <div className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-slate-200">
                
                {rootMenus.map(group => {
                    const children = menus.filter(m => m.parentId === group.id).sort((a, b) => a.order - b.order);

                    if (children.length === 0) {
                        const isAdminGroup = isMenuAdmin(group, rules, menus, adminOnlyPaths);
                        if (adminMode && !isAdminGroup) return null;
                        if (!adminMode && isAdminGroup) return null;
                    }

                    // Lọc những menu con mà user có quyền xem
                    const visibleChildren = children.filter(child => {
                        const isAdminChild = isMenuAdmin(child, rules, menus, adminOnlyPaths);
                        if (adminMode && !isAdminChild) return false;
                        if (!adminMode && isAdminChild) return false;

                        if (child.showInPaths && child.showInPaths.length > 0) {
                            if (!checkPathMatch(child.showInPaths, pathname)) return false;
                        }

                        // 2. Lọc theo quyền
                        if (!child.permissionCode) {
                            if (child.path === '/') return true;
                            return user?.role === 'ADMIN'; 
                        }
                        return hasPermission(child.permissionCode);
                    });

                    // Xử lý nhóm đặc biệt (hiển thị danh sách rules động)
                    const canSeeSpecial = group.isSpecialGroup === 'SPECIALIZED_RULES' && hasPermission('MENU_SPECIALIZED_RULES');

                    // Nếu nhóm không có menu con nào được hiển thị và cũng không phải nhóm đặc biệt -> ẩn nhóm luôn
                    if (visibleChildren.length === 0 && !canSeeSpecial) return null;

                    return (
                        <div key={group.id} className="px-4 mb-2 mt-4">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">{group.title}</p>
                            
                            <div className="space-y-1">
                                {visibleChildren.map(child => {
                                    const linkPath = child.path || child.targetPath || '#';
                                    return (
                                        <Link key={child.id} href={linkPath} className={getLinkClass(child.path || child.targetPath)}>
                                            {renderIcon(child.icon)}
                                            <span className="flex-1 truncate">{child.title}</span>
                                            {child.status === 'TESTING' && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">
                                                    Thử nghiệm
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}

                                {/* Chèn thêm danh sách quy tắc nếu là nhóm đặc biệt */}
                                {canSeeSpecial && rules.map((rule) => (
                                    <Link
                                        key={rule.id}
                                        href={`/chuyen-de/${rule.slug}`}
                                        className={getLinkClass(`/chuyen-de/${rule.slug}`)}
                                    >
                                        <Icons.FileTextOutlined className="text-lg opacity-70" />
                                        <span className="truncate">{rule.name}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    );
                })}

            </div>

            {/* Version Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/80">
                <div 
                    onClick={() => setIsVersionModalOpen(true)}
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">
                            BV
                        </div>
                        <div>
                            <div className="text-[11px] font-bold text-slate-700">BVĐK Lạng Sơn</div>
                            <div className="text-[10px] text-slate-400">Phiên bản {SYSTEM_CONFIG.version}</div>
                        </div>
                    </div>
                    <span className="text-[10px] font-semibold text-blue-600 hover:underline">Chi tiết</span>
                </div>
            </div>

            <SystemVersionModal open={isVersionModalOpen} onClose={() => setIsVersionModalOpen(false)} />
        </div>
    );
}
