'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Modal, Button } from 'antd';
import { ExclamationCircleOutlined, LoginOutlined } from '@ant-design/icons';
import { getBasePath } from '@/utils/config';
import { useAuth } from '@/contexts/AuthContext';

export default function FetchInterceptor() {
    const { user } = useAuth();
    const [isSessionExpired, setIsSessionExpired] = useState(false);
    const hasPromptedRef = useRef(false);
    const userRef = useRef(user);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    const handleSessionExpired = () => {
        if (typeof window === 'undefined') return;
        const currentPath = window.location.pathname;
        if (currentPath.includes('/login')) return;

        if (!hasPromptedRef.current) {
            hasPromptedRef.current = true;
            setIsSessionExpired(true);
        }
    };

    const handleRedirectToLogin = () => {
        if (typeof window === 'undefined') return;
        const basePath = getBasePath();
        const currentPath = window.location.pathname + window.location.search;
        let loginUrl = `${basePath}/login`;
        if (currentPath && !currentPath.includes('/login')) {
            loginUrl += `?returnUrl=${encodeURIComponent(currentPath)}`;
        }
        window.location.href = loginUrl;
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            let [resource, config] = args;
            const basePath = getBasePath();
            
            // Override only string URLs that start with /api/ and don't already have basePath
            if (typeof resource === 'string' && resource.startsWith('/api/') && basePath) {
                if (!resource.startsWith(basePath)) {
                    resource = `${basePath}${resource}`;
                }
            } else if (resource instanceof Request && resource.url.startsWith('/api/') && basePath) {
                 if (!resource.url.startsWith(basePath)) {
                     resource = new Request(`${basePath}${resource.url}`, resource);
                 }
            }
            
            const response = await originalFetch(resource, config);

            // Bắt lỗi 401 Unauthorized khi phiên làm việc hết hạn
            if (response.status === 401) {
                const urlStr = typeof resource === 'string' ? resource : resource instanceof Request ? resource.url : '';
                // Không bắt nếu gọi API login hoặc API kiểm tra auth/me
                const isAuthCheck = urlStr.includes('/api/auth/login') || urlStr.includes('/api/auth/me');
                if (!isAuthCheck) {
                    handleSessionExpired();
                }
            }

            return response;
        };

        // Lắng nghe khi người dùng quay lại tab làm việc (Tab Focus / Visibility change)
        let lastCheckTime = Date.now();
        const checkSessionOnFocus = async () => {
            if (document.visibilityState !== 'visible') return;
            if (window.location.pathname.includes('/login')) return;

            // Nếu người dùng từng có thông tin đăng nhập và đã rời tab hơn 3 phút (hoặc tab được focus lại)
            const now = Date.now();
            if (userRef.current && (now - lastCheckTime > 3 * 60 * 1000)) {
                lastCheckTime = now;
                try {
                    const res = await originalFetch(`${getBasePath()}/api/auth/me`);
                    if (res.status === 401) {
                        handleSessionExpired();
                    } else if (res.ok) {
                        const data = await res.json();
                        if (data && data.authenticated === false) {
                            handleSessionExpired();
                        }
                    }
                } catch (e) {
                    // Lỗi mạng tạm thời, không cảnh báo ngay
                }
            }
        };

        document.addEventListener('visibilitychange', checkSessionOnFocus);
        window.addEventListener('focus', checkSessionOnFocus);

        return () => {
            window.fetch = originalFetch;
            document.removeEventListener('visibilitychange', checkSessionOnFocus);
            window.removeEventListener('focus', checkSessionOnFocus);
        };
    }, []);

    return (
        <Modal
            open={isSessionExpired}
            title={
                <div className="flex items-center gap-2 text-amber-600 font-bold text-base">
                    <ExclamationCircleOutlined className="text-xl text-amber-500" />
                    <span>Phiên làm việc đã hết hạn</span>
                </div>
            }
            closable={false}
            maskClosable={false}
            centered
            footer={[
                <Button 
                    key="close" 
                    onClick={() => setIsSessionExpired(false)}
                    className="rounded-xl text-slate-600"
                >
                    Đóng (Chỉ xem)
                </Button>,
                <Button 
                    key="login" 
                    type="primary" 
                    icon={<LoginOutlined />}
                    onClick={handleRedirectToLogin}
                    className="bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold shadow-sm"
                >
                    Đăng nhập lại ngay
                </Button>
            ]}
        >
            <div className="py-3 space-y-2 text-slate-700 text-sm">
                <p>
                    Phiên làm việc của bạn với tài khoản <strong>{user?.name || user?.username || 'hiện tại'}</strong> đã hết hạn bảo mật (hoặc bạn chưa đăng nhập lại).
                </p>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs leading-relaxed">
                    💡 <strong>Lưu ý:</strong> Để tiếp tục thực hiện các thao tác (nhận việc, cập nhật phiếu, gửi đối tác...), bạn vui lòng bấm <strong>"Đăng nhập lại ngay"</strong>. Hệ thống sẽ tự động đưa bạn quay lại đúng trang bạn đang làm việc.
                </div>
            </div>
        </Modal>
    );
}
