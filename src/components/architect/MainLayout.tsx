'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import SidebarClient from './SidebarClient';
import TopHeader from './TopHeader';
import { useAuth } from '@/contexts/AuthContext';
import GlobalInstructionDrawer from './GlobalInstructionDrawer';

interface MainLayoutProps {
    children: React.ReactNode;
    rules: any[];
    menus?: any[];
    adminOnlyPaths?: string[];
}

export default function MainLayout({ children, rules, menus = [], adminOnlyPaths = [] }: MainLayoutProps) {
    const { user } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [menuLayout, setMenuLayout] = useState<'horizontal' | 'vertical'>('horizontal');
    const [adminMode, setAdminMode] = useState<boolean>(false);
    const pathname = usePathname();

    useEffect(() => {
        const savedLayout = localStorage.getItem('menuLayout') as 'horizontal' | 'vertical';
        if (savedLayout) {
            setMenuLayout(savedLayout);
            if (savedLayout === 'horizontal') {
                setIsSidebarOpen(false);
            } else {
                setIsSidebarOpen(true);
            }
        } else {
            setIsSidebarOpen(false);
        }

        const savedAdminMode = localStorage.getItem('adminMode');
        if (savedAdminMode === 'true') {
            if (user?.role === 'ADMIN') {
                setAdminMode(true);
            } else {
                localStorage.setItem('adminMode', 'false');
                setAdminMode(false);
            }
        }
    }, [user]);

    useEffect(() => {
        if (menuLayout === 'vertical') {
            // setIsSidebarOpen(false); 
        }
    }, [pathname]);

    const handleToggleLayout = () => {
        const newLayout = menuLayout === 'horizontal' ? 'vertical' : 'horizontal';
        setMenuLayout(newLayout);
        localStorage.setItem('menuLayout', newLayout);
        
        if (newLayout === 'horizontal') {
            setIsSidebarOpen(false);
        } else {
            setIsSidebarOpen(true);
        }
    };

    const handleToggleAdminMode = (mode: boolean) => {
        setAdminMode(mode);
        localStorage.setItem('adminMode', mode.toString());
    };

    return (
        <>
            <SidebarClient 
                rules={rules} 
                menus={menus} 
                isOpen={isSidebarOpen && menuLayout === 'vertical'} 
                adminMode={adminMode}
                adminOnlyPaths={adminOnlyPaths}
            />
            
            <TopHeader
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                isSidebarOpen={isSidebarOpen && menuLayout === 'vertical'}
                hideToggle={false}
                menuLayout={menuLayout}
                onToggleLayout={handleToggleLayout}
                adminMode={adminMode}
                onToggleAdminMode={handleToggleAdminMode}
                rules={rules}
                menus={menus}
                adminOnlyPaths={adminOnlyPaths}
            />

            <div
                className={`
                    pt-[60px] min-h-screen bg-slate-50 transition-all duration-300 ease-in-out
                    ${(isSidebarOpen && menuLayout === 'vertical') ? 'pl-[280px]' : 'pl-0'}
                `}
            >
                {children}
            </div>
            
            <GlobalInstructionDrawer />
        </>
    );
}
