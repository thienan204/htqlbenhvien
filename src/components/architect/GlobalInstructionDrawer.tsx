'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Button, Drawer, Tooltip } from 'antd';
import { QuestionCircleOutlined, BookOutlined } from '@ant-design/icons';
import PageInstruction from '@/components/shared/PageInstruction';

export default function GlobalInstructionDrawer() {
    const pathname = usePathname();
    const [hasInstruction, setHasInstruction] = useState(false);
    const [pageId, setPageId] = useState('');
    const [open, setOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;
        let path = pathname || '';
        
        // Remove basePath if it's there
        if (path.startsWith('/htqlbenhvien')) {
            path = path.replace('/htqlbenhvien', '');
        }
        
        // Exclude specific paths that shouldn't show the global drawer
        // like the instruction reader itself or admin pages where it might conflict
        if (path.startsWith('/huong-dan/') || path.startsWith('/admin/instructions')) {
            setHasInstruction(false);
            return () => { isMounted = false; };
        }

        // Sử dụng trực tiếp đường dẫn làm slug (ví dụ: /users, /chuyen-de/abc)
        // Backend API đã được cấu hình để khớp tự động cả trường hợp có hoặc không có dấu gạch chéo
        const generatedSlug = path;
        
        if (!generatedSlug || generatedSlug === '/') {
            setHasInstruction(false);
            return () => { isMounted = false; };
        }

        const checkInstruction = async () => {
            try {
                const bPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/htqlbenhvien') ? '/htqlbenhvien' : '';
                
                const res = await fetch(`${bPath}/api/page-instructions?pageId=${generatedSlug}`);
                if (!isMounted) return;

                if (res.ok) {
                    const data = await res.json();
                    if (!isMounted) return;
                    if (data.success && data.data) {
                        const showOnPage = data.data.showOnPage !== false;
                        if (showOnPage) {
                            setPageId(generatedSlug);
                            setHasInstruction(true);
                        } else {
                            setHasInstruction(false);
                        }
                    } else {
                        setHasInstruction(false);
                    }
                } else {
                    setHasInstruction(false);
                }
            } catch (error) {
                if (isMounted) {
                    setHasInstruction(false);
                }
            }
        };

        checkInstruction();

        return () => {
            isMounted = false;
        };
    }, [pathname]);

    if (!hasInstruction) return null;

    return (
        <>
            <div 
                className="hidden md:block fixed bottom-6 right-6 z-[999]"
            >
                <style>{`
                    @keyframes subtle-pulse {
                        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(24, 144, 255, 0.4); }
                        70% { transform: scale(1.05); box-shadow: 0 0 0 6px rgba(24, 144, 255, 0); }
                        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(24, 144, 255, 0); }
                    }
                `}</style>
                <Tooltip title="Hướng dẫn sử dụng trang này" placement="left">
                    <Button 
                        type="primary" 
                        shape="circle" 
                        icon={<BookOutlined style={{ fontSize: 18 }} />} 
                        className="bg-blue-600 hover:bg-blue-700 shadow-md border-none flex items-center justify-center transition-all hover:scale-105"
                        style={{ 
                            width: 40, 
                            height: 40, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            animation: 'subtle-pulse 2.5s infinite' 
                        }}
                        onClick={() => setOpen(true)}
                    />
                </Tooltip>
            </div>
            
            <Drawer
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                        <span>Trợ giúp & Hướng dẫn</span>
                    </div>
                }
                placement="right"
                size="large"
                onClose={() => setOpen(false)}
                open={open}
                styles={{ body: { padding: 12, background: '#f0f2f5' } }}
            >
                <div style={{ height: '100%', overflow: 'auto' }}>
                    <PageInstruction pageId={pageId} />
                </div>
            </Drawer>
        </>
    );
}
