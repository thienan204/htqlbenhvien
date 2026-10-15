'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { notification, message, Button } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import { playNotificationSound } from '@/utils/audioUtils';

let activeGlobalNativeNotification: Notification | null = null;
let originalGlobalDocTitle = '';
let globalTitleBlinkTimer: NodeJS.Timeout | null = null;

const ALLOWED_ROLES = ['ADMIN', 'CNTT', 'VTYT', 'HCQT'];

const startGlobalTitleBlink = (alertTitle: string) => {
    if (typeof document === 'undefined') return;
    if (!originalGlobalDocTitle) {
        originalGlobalDocTitle = document.title || 'Hệ thống QLBV';
    }
    if (globalTitleBlinkTimer) return;

    let isAlert = true;
    globalTitleBlinkTimer = setInterval(() => {
        document.title = isAlert ? alertTitle : (originalGlobalDocTitle || 'Hệ thống QLBV');
        isAlert = !isAlert;
    }, 1000);
};

const stopGlobalTitleBlink = () => {
    if (globalTitleBlinkTimer) {
        clearInterval(globalTitleBlinkTimer);
        globalTitleBlinkTimer = null;
    }
    if (typeof document !== 'undefined' && originalGlobalDocTitle) {
        document.title = originalGlobalDocTitle;
    }
};

const closeGlobalNativeNotification = () => {
    if (activeGlobalNativeNotification) {
        activeGlobalNativeNotification.close();
        activeGlobalNativeNotification = null;
    }
};

export default function GlobalTicketNotification() {
    const { user } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const prevUnacceptedCountRef = useRef<number | null>(null);

    // Xác định xem user có thuộc nhóm đối tượng được quyền nhận cảnh báo không
    const isEligible = Boolean(user?.id && user?.role && ALLOWED_ROLES.includes(user.role));

    // Xác định xem người dùng có đang ở đúng trang quản lý yêu cầu không (để tránh lặp cảnh báo)
    const isAlreadyOnRequestPage = Boolean(
        pathname && (
            pathname.includes('/error-management/it-requests') ||
            pathname.includes('/error-management/vtyt-requests') ||
            pathname.includes('/error-management/hcqt-requests')
        )
    );

    // Xác định phòng ban và đường dẫn đích
    const targetDept = user?.role === 'VTYT' ? 'VTYT' : user?.role === 'HCQT' ? 'HCQT' : 'CNTT';
    const requestUrlPath = user?.role === 'VTYT' 
        ? '/error-management/vtyt-requests' 
        : user?.role === 'HCQT' 
            ? '/error-management/hcqt-requests' 
            : '/error-management/it-requests';

    // Hàm nhận việc nhanh trực tiếp từ popup thông báo
    const quickReceive = async (ticket: any) => {
        try {
            let payload: any = {};
            if (ticket.status === 'TRANSFERRING' && ticket.transferToId === user?.id) {
                payload = { id: ticket.id, action: 'ACCEPT_TRANSFER' };
            } else {
                payload = {
                    id: ticket.id,
                    assigneeId: user?.id,
                    status: 'IN_PROGRESS'
                };
            }

            const res = await fetch('/api/error-management/it-requests', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success('Đã nhận việc thành công!');
                notification.destroy('unaccepted-ticket-warning');
                stopGlobalTitleBlink();
                closeGlobalNativeNotification();
                checkPendingTickets(true);
            } else {
                message.error('Lỗi khi nhận việc');
            }
        } catch (error) {
            message.error('Lỗi kết nối khi nhận việc');
        }
    };

    // Hàm gọi API siêu nhẹ kiểm tra việc chưa nhận
    const checkPendingTickets = useCallback(async (isPolling = false) => {
        // TUÂN THỦ NGUYÊN TẮC: Chưa login hoặc không thuộc nhóm trực -> DỪNG TOÀN BỘ, không cảnh báo
        if (!isEligible || isAlreadyOnRequestPage) {
            return;
        }

        try {
            const res = await fetch(`/api/error-management/it-requests/my-pending-check?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
            });

            if (!res.ok) return;

            const data = await res.json();
            if (!data.allowed || !Array.isArray(data.unacceptedTickets)) return;

            const unacceptedTickets = data.unacceptedTickets;

            // Nếu có việc chưa nhận (PENDING hoặc TRANSFERRING)
            if (unacceptedTickets.length > 0) {
                // 1. Nhấp nháy tiêu đề Tab của trình duyệt
                startGlobalTitleBlink(`🚨 (${unacceptedTickets.length}) Việc chưa tiếp nhận!`);

                // 2. Phát âm thanh chuông báo
                if (isPolling) {
                    playNotificationSound(targetDept, user?.id);
                }

                // 3. Bắn thông báo ngoài màn hình Desktop Windows
                if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                    if (activeGlobalNativeNotification) {
                        activeGlobalNativeNotification.close();
                    }

                    const firstTicket = unacceptedTickets[0];
                    const firstTicketDesc = firstTicket.ten_loi || 'Yêu cầu hỗ trợ';
                    const notif = new Notification('🚨 Nhắc nhở: Có việc chưa tiếp nhận!', {
                        body: `Bạn có ${unacceptedTickets.length} yêu cầu cần xử lý (${firstTicketDesc}). Bấm để mở ngay!`,
                        icon: '/favicon.ico',
                        tag: 'it-request-unaccepted',
                        requireInteraction: true,
                        silent: false
                    });

                    notif.onclick = () => {
                        notif.close();
                        window.focus();
                        router.push(`${requestUrlPath}?tab=MINE&status=PENDING`);
                    };

                    activeGlobalNativeNotification = notif;
                }

                // 4. Khung thông báo nội bộ Ant Design ở góc dưới bên phải màn hình
                notification.warning({
                    key: 'unaccepted-ticket-warning',
                    title: (
                        <div className="flex items-center gap-1.5 font-bold text-amber-800 text-[14px]">
                            <span>🚨</span>
                            <span>Nhắc nhở: Có việc chưa tiếp nhận!</span>
                        </div>
                    ),
                    description: (
                        <div className="space-y-2 pt-1 text-sm">
                            <div className="text-slate-600 text-xs">
                                Bạn đang có <b className="text-red-600 font-semibold">{unacceptedTickets.length}</b> yêu cầu cần xử lý:
                            </div>
                            <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                                {unacceptedTickets.slice(0, 3).map((t: any) => {
                                    const deptText = t.ten_khoa || t.ma_khoa;
                                    const reporterText = t.nguoi_bao;
                                    return (
                                        <div 
                                            key={t.id}
                                            onClick={() => {
                                                notification.destroy('unaccepted-ticket-warning');
                                                router.push(`${requestUrlPath}?tab=MINE&status=PENDING`);
                                            }}
                                            className="group flex flex-col p-2 rounded-lg bg-amber-50/90 hover:bg-blue-50/90 border border-amber-200 hover:border-blue-400 cursor-pointer transition-all shadow-2xs"
                                            title="Bấm vào để mở trực tiếp công việc này"
                                        >
                                            <div className="flex items-center gap-1 font-semibold text-blue-700 group-hover:text-blue-800 text-[13px] leading-snug">
                                                <span className="text-blue-500">🔗</span>
                                                <span className="underline decoration-blue-300 group-hover:decoration-blue-600 transition-colors">
                                                    {t.ten_loi || 'Yêu cầu hỗ trợ'}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                {deptText && <span>Khoa: <b className="text-slate-700">{deptText}</b></span>}
                                                {t.ma_ba && <span className="text-blue-600 font-mono font-medium">BA: {t.ma_ba}</span>}
                                                {reporterText && <span>Báo bởi: {reporterText}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                                {unacceptedTickets.length > 3 && (
                                    <div 
                                        className="text-[12px] text-blue-600 hover:underline cursor-pointer italic text-center py-0.5"
                                        onClick={() => {
                                            notification.destroy('unaccepted-ticket-warning');
                                            router.push(`${requestUrlPath}?tab=MINE&status=PENDING`);
                                        }}
                                    >
                                        + Xem thêm {unacceptedTickets.length - 3} việc khác...
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-amber-200/60 mt-1.5">
                                {unacceptedTickets.length === 1 && (
                                    <Button 
                                        type="primary" 
                                        size="small"
                                        className="bg-green-600 hover:bg-green-500 font-medium text-xs h-7 shadow-xs"
                                        onClick={() => quickReceive(unacceptedTickets[0])}
                                    >
                                        ⚡ Nhận việc ngay
                                    </Button>
                                )}
                                <Button 
                                    type="default"
                                    size="small" 
                                    className="text-xs h-7 text-blue-600 hover:text-blue-700 hover:border-blue-400"
                                    onClick={() => {
                                        notification.destroy('unaccepted-ticket-warning');
                                        router.push(`${requestUrlPath}?tab=MINE&status=PENDING`);
                                    }}
                                >
                                    📋 Việc của tôi ({unacceptedTickets.length})
                                </Button>
                            </div>
                        </div>
                    ),
                    placement: 'bottomRight',
                    duration: 15
                });
            } else {
                stopGlobalTitleBlink();
                closeGlobalNativeNotification();
                notification.destroy('unaccepted-ticket-warning');
            }

            prevUnacceptedCountRef.current = unacceptedTickets.length;
        } catch (error) {
            console.error('Lỗi my-pending-check:', error);
        }
    }, [isEligible, isAlreadyOnRequestPage, targetDept, user?.id, requestUrlPath, router]);

    // Nhắc bật quyền thông báo Desktop nếu chưa cấp quyền (chỉ hỏi người thuộc nhóm trực)
    useEffect(() => {
        if (!isEligible || isAlreadyOnRequestPage) return;

        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            notification.info({
                key: 'request-desktop-permission',
                message: '🔔 Bật thông báo Desktop khi ở tab khác',
                description: (
                    <div className="space-y-2 pt-1">
                        <div className="text-xs text-slate-600">
                            Để nhận cảnh báo ngoài màn hình Desktop khi bạn đang mở phần mềm khác (như HIS):
                        </div>
                        <Button
                            type="primary"
                            size="small"
                            className="bg-blue-600 hover:bg-blue-500 text-xs h-7"
                            onClick={async () => {
                                notification.destroy('request-desktop-permission');
                                const res = await Notification.requestPermission();
                                if (res === 'granted') {
                                    message.success('Đã bật thông báo Desktop thành công!');
                                    new Notification('Bệnh viện Đa khoa Lạng Sơn', {
                                        body: 'Đã kích hoạt thông báo Desktop! Bạn sẽ nhận được nhắc nhở công việc kể cả khi đang ở tab khác.',
                                        icon: '/favicon.ico'
                                    });
                                }
                            }}
                        >
                            Bật thông báo ngay
                        </Button>
                    </div>
                ),
                duration: 0,
                placement: 'topRight'
            });
        }
    }, [isEligible, isAlreadyOnRequestPage]);

    // ĐIỂM CỐT LÕI: Kích hoạt ngay lập tức khi mở trang/đăng nhập + Kiểm tra khi focus tab + Chu kỳ giãn cách 45s
    useEffect(() => {
        if (!isEligible || isAlreadyOnRequestPage) return;

        // 1. Kiểm tra ngay lập tức trong 0.1s đầu tiên khi vừa login hoặc vừa mở trang
        checkPendingTickets(false);

        // 2. Kiểm tra ngay lập tức khi người dùng click chuột quay lại tab web (visibilitychange / focus)
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                checkPendingTickets(true);
            }
        };

        const handleFocus = () => {
            checkPendingTickets(true);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        // 3. Chu kỳ giãn cách thông minh (45 giây/lần khi để tab chạy ngầm)
        const interval = setInterval(() => {
            checkPendingTickets(true);
        }, 45000);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            stopGlobalTitleBlink();
            closeGlobalNativeNotification();
            notification.destroy('unaccepted-ticket-warning');
        };
    }, [isEligible, isAlreadyOnRequestPage, checkPendingTickets]);

    // Nếu không thuộc diện cảnh báo (chưa login hoặc bác sĩ/điều dưỡng), component không render gì cả
    if (!isEligible || isAlreadyOnRequestPage) {
        return null;
    }

    return null;
}
