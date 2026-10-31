'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getBasePath } from '@/utils/config';
import { logout } from '@/actions/auth';
import { notification } from 'antd';

interface SessionTimeoutManagerProps {
    timeoutMinutes?: number;
    warningMinutes?: number;
}

/**
 * SessionTimeoutManager
 * Tự động đăng xuất người dùng sau 30 phút không có bất kỳ thao tác nào
 * (bảo vệ an toàn thông tin khi bác sĩ/nhân viên rời khỏi phòng máy).
 */
export default function SessionTimeoutManager({
    timeoutMinutes = 30,
    warningMinutes = 2
}: SessionTimeoutManagerProps) {
    const router = useRouter();
    const lastActivityRef = useRef<number>(Date.now());
    const warningShownRef = useRef<boolean>(false);

    useEffect(() => {
        // Kiểm tra nếu là thiết bị di động (Mobile/Tablet) -> Giữ đăng nhập liên tục cho đến khi người dùng chủ động Đăng xuất
        if (typeof window !== 'undefined') {
            const ua = navigator.userAgent || '';
            const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
            const isTouchScreen = ('ontouchstart' in window) || navigator.maxTouchPoints > 1;
            if (isMobileUA || (isTouchScreen && window.innerWidth < 1024)) {
                return;
            }
        }

        const timeoutMs = timeoutMinutes * 60 * 1000;
        const warningMs = (timeoutMinutes - warningMinutes) * 60 * 1000;

        const updateActivity = () => {
            lastActivityRef.current = Date.now();
            if (warningShownRef.current) {
                warningShownRef.current = false;
                notification.destroy('session-timeout-warning');
            }
        };

        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        let throttleTimer: NodeJS.Timeout | null = null;

        const handleUserActivity = () => {
            if (!throttleTimer) {
                throttleTimer = setTimeout(() => {
                    updateActivity();
                    throttleTimer = null;
                }, 3000); // Throttle 3s để tối ưu hiệu năng
            }
        };

        events.forEach(event => {
            window.addEventListener(event, handleUserActivity, { passive: true });
        });

        // Interval kiểm tra mỗi 15 giây
        const interval = setInterval(async () => {
            const idleTime = Date.now() - lastActivityRef.current;

            // Cảnh báo trước khi hết hạn
            if (idleTime >= warningMs && idleTime < timeoutMs && !warningShownRef.current) {
                warningShownRef.current = true;
                notification.warning({
                    key: 'session-timeout-warning',
                    message: 'Cảnh báo phiên làm việc',
                    description: `Bạn đã không thao tác trong ${timeoutMinutes - warningMinutes} phút. Hệ thống sẽ tự động đăng xuất sau ${warningMinutes} phút nữa để bảo mật.`,
                    duration: 60,
                    placement: 'topRight'
                });
            }

            // Hết hạn 30 phút -> Đăng xuất
            if (idleTime >= timeoutMs) {
                clearInterval(interval);
                notification.destroy('session-timeout-warning');
                try {
                    await logout();
                } catch (e) {
                    console.error('Session timeout logout error:', e);
                }
                const basePath = getBasePath();
                window.location.href = `${basePath}/login?reason=timeout`;
            }
        }, 15000);

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleUserActivity);
            });
            if (throttleTimer) clearTimeout(throttleTimer);
            clearInterval(interval);
            notification.destroy('session-timeout-warning');
        };
    }, [timeoutMinutes, warningMinutes, router]);

    return null;
}
