'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import SidebarClient from './SidebarClient';
import TopHeader from './TopHeader';

interface MainLayoutProps {
    children: React.ReactNode;
    rules: any[];
    menus?: any[];
}

export default function MainLayout({ children, rules, menus = [] }: MainLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setIsSidebarOpen(false);
    }, [pathname]);

    return (
        <>
            {pathname !== '/' && (
                <SidebarClient rules={rules} menus={menus} isOpen={isSidebarOpen} />
            )}
            <TopHeader
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                isSidebarOpen={isSidebarOpen && pathname !== '/'}
                hideToggle={pathname === '/'}
            />

            <div
                className={`
                    pt-[60px] min-h-screen bg-slate-50 transition-all duration-300 ease-in-out
                    ${(isSidebarOpen && pathname !== '/') ? 'pl-[280px]' : 'pl-0'}
                `}
            >
                {children}
            </div>
        </>
    );
}
