'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import SidebarClient from './SidebarClient';
import TopHeader from './TopHeader';
import { useAuth } from '@/contexts/AuthContext';
import GlobalInstructionDrawer from './GlobalInstructionDrawer';
import GlobalTicketNotification from '@/components/notifications/GlobalTicketNotification';
import FeatureFeedbackModal from '../common/FeatureFeedbackModal';

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
    const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);
    const pathname = usePathname();

    useEffect(() => {
        const checkIsMobile = () => typeof window !== 'undefined' && window.innerWidth < 1024;
        const savedLayout = localStorage.getItem('menuLayout') as 'horizontal' | 'vertical';
        
        if (savedLayout) {
            setMenuLayout(savedLayout);
            if (savedLayout === 'horizontal' || checkIsMobile()) {
                setIsSidebarOpen(false);
            } else {
                setIsSidebarOpen(true);
            }
        } else {
            setIsSidebarOpen(false);
        }

        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);

        const savedAdminMode = localStorage.getItem('adminMode');
        if (savedAdminMode === 'true') {
            if (user?.role === 'ADMIN') {
                setAdminMode(true);
            } else {
                localStorage.setItem('adminMode', 'false');
                setAdminMode(false);
            }
        }
        
        return () => window.removeEventListener('resize', handleResize);
    }, [user]);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
        
        // Update document title based on current path
        if (menus && menus.length > 0) {
            let title = 'Hệ thống QLBV';
            if (pathname === '/') {
                const homeMenu = menus.find(m => m.path === '/');
                if (homeMenu) title = homeMenu.title;
            } else {
                const matchingMenus = menus.filter(m => m.path && pathname.startsWith(m.path) && m.path !== '/');
                matchingMenus.sort((a, b) => b.path.length - a.path.length);
                if (matchingMenus.length > 0) {
                    title = matchingMenus[0].title;
                }
            }
            document.title = `${title} | Bệnh viện Đa khoa Lạng Sơn`;
        }
    }, [pathname, menus, menuLayout]);

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

    const isPatientPortal = pathname?.includes('/gop-y-benh-nhan');
    if (isPatientPortal) {
        return (
            <div className="min-h-screen bg-slate-100">
                {children}
            </div>
        );
    }

    // Helper tìm Menu khớp chính xác và cụ thể nhất (hỗ trợ cả path, targetPath và tránh bị menu cha đè)
    const getMatchedMenu = (currentPath: string) => {
        if (!currentPath || currentPath === '/' || !menus || menus.length === 0) return null;
        const candidates = menus.filter(m => {
            const p = m.path || m.targetPath;
            if (!p) return false;
            return currentPath === p || currentPath.startsWith(p + '/') || (p !== '/' && currentPath.startsWith(p));
        });
        if (candidates.length === 0) return null;
        candidates.sort((a, b) => {
            const isExactA = a.path === currentPath || a.targetPath === currentPath;
            const isExactB = b.path === currentPath || b.targetPath === currentPath;
            if (isExactA && !isExactB) return -1;
            if (!isExactA && isExactB) return 1;
            const lenA = Math.max(a.path?.length || 0, a.targetPath?.length || 0);
            const lenB = Math.max(b.path?.length || 0, b.targetPath?.length || 0);
            return lenB - lenA;
        });
        return candidates[0];
    };

    const cleanPath = pathname?.replace('/htqlbenhvien', '') || '';
    const currentMatchedMenu = getMatchedMenu(cleanPath);

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

            {/* Mobile Overlay */}
            {isSidebarOpen && menuLayout === 'vertical' && (
                <div 
                    className="fixed inset-0 bg-slate-900/50 z-10 lg:hidden transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <div
                className={`
                    pt-[60px] min-h-screen bg-slate-50 transition-all duration-300 ease-in-out
                    ${(isSidebarOpen && menuLayout === 'vertical') ? 'lg:pl-[280px] pl-0' : 'pl-0'}
                `}
            >
                {/* Banner cảnh báo nếu chức năng đang thử nghiệm */}
                {currentMatchedMenu?.status === 'TESTING' && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex items-center justify-between shadow-xs">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-800 bg-amber-200/90 px-2 py-0.5 rounded text-[10px] uppercase tracking-wide border border-amber-300">
                                ⚠️ Thử nghiệm (Beta)
                            </span>
                            <span>
                                Chức năng <strong>{currentMatchedMenu.title}</strong> đang trong giai đoạn <strong>THỬ NGHIỆM</strong>.
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-[11px] text-amber-700 hidden md:block">
                                Xem <strong>Tài liệu & Lịch sử thay đổi</strong> trên thanh tiêu đề để nắm quy trình.
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsFeedbackOpen(true)}
                                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer border-none"
                            >
                                <span>💬 Góp ý thử nghiệm</span>
                            </button>
                        </div>
                    </div>
                )}

                {children}
            </div>
            
            {/* Modal Góp ý Thử nghiệm / Chính sách */}
            <FeatureFeedbackModal 
                open={isFeedbackOpen} 
                onClose={() => setIsFeedbackOpen(false)} 
                currentTitle={currentMatchedMenu?.title || 'Chức năng thử nghiệm'} 
                pagePath={currentMatchedMenu?.path || currentMatchedMenu?.targetPath || cleanPath} 
            />

            <GlobalInstructionDrawer />
            <GlobalTicketNotification />
        </>
    );
}
