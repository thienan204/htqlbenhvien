'use client';

import React from 'react';
import Link from 'next/link';
import * as Icons from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from 'antd';

interface HorizontalMenuClientProps {
    rules: any[]; 
    menus?: any[];
    adminMode?: boolean;
}

const checkPathMatch = (patterns: string[], currentPath: string) => {
    if (!patterns || patterns.length === 0) return true;
    return patterns.some((pattern: string) => {
        const cleanPattern = pattern.replace(/\/\*$/, '').replace(/\*$/, '');
        return currentPath === cleanPattern || currentPath.startsWith(`${cleanPattern}/`) || currentPath.startsWith(pattern);
    });
};

import { useAuth } from '@/contexts/AuthContext';
import { ADMIN_ONLY_PATHS } from '@/lib/constants';

const isMenuAdmin = (menu: any, rules: any[], allMenus: any[]): boolean => {
    if (menu.path) {
        return ADMIN_ONLY_PATHS.some(p => menu.path.startsWith(p));
    }
    const children = allMenus.filter(m => m.parentId === menu.id);
    if (children.length > 0) {
        return children.every(c => isMenuAdmin(c, rules, allMenus));
    }
    return false;
};

export default function HorizontalMenuClient({ rules, menus = [], adminMode = false }: HorizontalMenuClientProps) {
    const { user, hasPermission } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const allRootMenus = menus.filter(m => !m.parentId).sort((a, b) => a.order - b.order);
    
    const rootMenus = allRootMenus.filter(group => {
        if (!group.showInPaths || group.showInPaths.length === 0) return true;
        return checkPathMatch(group.showInPaths, pathname);
    });

    const renderIcon = (iconName: string | null) => {
        if (!iconName) return null;
        const Icon = (Icons as any)[iconName];
        return Icon ? <Icon className="text-[16px] opacity-70" /> : <Icons.AppstoreOutlined className="text-[16px] opacity-70" />;
    };

    const menuData: any[] = [];
    const activeKeys: string[] = [];

    for (const group of rootMenus) {
        const children = menus.filter(m => m.parentId === group.id).sort((a, b) => a.order - b.order);
        
        if (children.length === 0) {
            const isAdminGroup = isMenuAdmin(group, rules, menus);
            if (adminMode && !isAdminGroup) continue;
            if (!adminMode && isAdminGroup) continue;

            const isActive = group.path === '/' ? pathname === '/' : (group.path && pathname.startsWith(group.path));
            if (isActive) activeKeys.push(group.id);

            menuData.push({
                key: group.id,
                label: <span className="font-semibold text-[13px]">{group.title}</span>,
                onClick: () => { if (group.path) router.push(group.path); }
            });
            continue;
        }

        const visibleChildren = children.filter(child => {
            const isAdminChild = isMenuAdmin(child, rules, menus);
            if (adminMode && !isAdminChild) return false;
            if (!adminMode && isAdminChild) return false;

            if (child.showInPaths && child.showInPaths.length > 0) {
                if (!checkPathMatch(child.showInPaths, pathname)) return false;
            }
            if (!child.permissionCode) {
                if (child.path === '/') return true;
                return user?.role === 'ADMIN'; 
            }
            return hasPermission(child.permissionCode);
        });

        const canSeeSpecial = group.isSpecialGroup === 'SPECIALIZED_RULES' && hasPermission('MENU_SPECIALIZED_RULES');

        if (visibleChildren.length === 0 && !canSeeSpecial) continue;

        const childItems = [
            ...visibleChildren.map(child => {
                const isActive = child.path === '/' ? pathname === '/' : (child.path && pathname.startsWith(child.path));
                if (isActive) {
                    activeKeys.push(child.id);
                    activeKeys.push(group.id);
                }
                return {
                    key: child.id,
                    label: (
                        <div className="flex items-center gap-2 py-1">
                            {renderIcon(child.icon)}
                            <span className={isActive ? 'text-blue-600 font-semibold' : ''}>{child.title}</span>
                        </div>
                    ),
                    onClick: () => { if (child.path) router.push(child.path); }
                };
            }),
            ...(canSeeSpecial ? rules.map(rule => {
                const isActive = pathname.startsWith(`/chuyen-de/${rule.slug}`);
                if (isActive) {
                    activeKeys.push(rule.id);
                    activeKeys.push(group.id);
                }
                return {
                    key: rule.id,
                    label: (
                        <div className="flex items-center gap-2 truncate max-w-[200px] py-1">
                            <Icons.FileTextOutlined className={`text-[16px] opacity-70 ${isActive ? 'text-blue-600' : ''}`} />
                            <span className={isActive ? 'text-blue-600 font-semibold' : ''}>{rule.name}</span>
                        </div>
                    ),
                    onClick: () => router.push(`/chuyen-de/${rule.slug}`)
                };
            }) : [])
        ];

        menuData.push({
            key: group.id,
            label: <span className="font-semibold text-[13px]">{group.title}</span>,
            children: childItems
        });
    }

    return (
        <Menu 
            mode="horizontal" 
            items={menuData} 
            selectedKeys={activeKeys}
            className="border-none bg-transparent flex-1 min-w-0"
            style={{ lineHeight: '58px' }}
            overflowedIndicator={<Icons.MoreOutlined className="text-lg" />}
        />
    );
}
