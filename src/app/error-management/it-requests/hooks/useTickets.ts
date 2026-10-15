import React, { useState, useEffect, useRef } from 'react';
import { message, notification } from 'antd';
import { Ticket } from '../types';
import { playNotificationSound } from '@/utils/audioUtils';
import {
    TicketNotificationTitle,
    TicketNotificationContent
} from '../components/TicketNotification';
import { getBasePath } from '@/utils/config';

let activeNativeNotification: Notification | null = null;
let originalDocTitle = '';
let titleBlinkTimer: NodeJS.Timeout | null = null;

const startTitleBlink = (alertTitle: string) => {
    if (typeof document === 'undefined') return;
    if (!originalDocTitle) {
        originalDocTitle = document.title || 'Quản lý yêu cầu CNTT';
    }
    if (titleBlinkTimer) return;

    let isAlert = true;
    titleBlinkTimer = setInterval(() => {
        document.title = isAlert ? alertTitle : (originalDocTitle || 'Quản lý yêu cầu CNTT');
        isAlert = !isAlert;
    }, 1000);
};

const stopTitleBlink = () => {
    if (titleBlinkTimer) {
        clearInterval(titleBlinkTimer);
        titleBlinkTimer = null;
    }
    if (typeof document !== 'undefined' && originalDocTitle) {
        document.title = originalDocTitle;
    }
};

const promptForNotificationPermission = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
        notification.info({
            key: 'request-desktop-permission',
            message: '🔔 Bật thông báo khi ở tab khác',
            description: React.createElement(
                'div',
                { className: 'space-y-2 pt-1' },
                React.createElement('div', { className: 'text-xs text-slate-600' }, 'Để nhận cảnh báo ngoài màn hình Desktop khi bạn đang chuyển tab hoặc mở phần mềm khác:'),
                React.createElement(
                    'button',
                    {
                        className: 'bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold shadow-xs cursor-pointer transition-all',
                        onClick: async () => {
                            notification.destroy('request-desktop-permission');
                            const res = await Notification.requestPermission();
                            if (res === 'granted') {
                                message.success('Đã bật thông báo Desktop thành công!');
                                new Notification('Bệnh viện Đa khoa Lạng Sơn', {
                                    body: 'Đã kích hoạt thông báo Desktop! Bạn sẽ nhận được nhắc nhở công việc kể cả khi đang ở tab khác.',
                                    icon: '/favicon.ico'
                                });
                            }
                        }
                    },
                    'Bật thông báo ngay'
                )
            ),
            duration: 0,
            placement: 'topRight'
        });
    }
};

const showNativeNotification = (
    title: string, 
    body: string, 
    onClickUrl?: string, 
    onOpenTicket?: () => void
) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        if (activeNativeNotification) {
            activeNativeNotification.close();
        }

        const notif = new Notification(title, {
            body,
            icon: '/favicon.ico',
            tag: 'it-request-unaccepted',
            requireInteraction: true, 
            silent: false 
        });
        
        notif.onclick = () => {
            notif.close();
            
            // Lấy basePath từ next.config (/htqlbenhvien)
            const basePath = '/htqlbenhvien';
            const baseUrl = `${window.location.protocol}//${window.location.host}`;
            
            // Tạo URL tuyệt đối đích
            let targetUrl: string;
            if (onClickUrl) {
                if (onClickUrl.startsWith('http')) {
                    targetUrl = onClickUrl;
                } else {
                    // Đảm bảo URL có basePath
                    const path = onClickUrl.startsWith('/') ? onClickUrl : '/' + onClickUrl;
                    const needsBasePath = !path.startsWith(basePath);
                    targetUrl = `${baseUrl}${needsBasePath ? basePath : ''}${path}`;
                }
            } else {
                targetUrl = `${baseUrl}${basePath}/error-management/it-requests`;
            }

            // Focus browser window trước (hoạt động khi trình duyệt bị thu nhỏ)
            window.focus();
            
            // Kiểm tra xem đang ở đúng trang chưa
            // Nếu đang ở đúng trang: dùng callback (không reload) để scroll/filter
            // Nếu đang ở trang khác: navigate đến URL đích (proxy.ts sẽ redirect về login nếu cần)
            const currentFullUrl = `${window.location.origin}${window.location.pathname}`;
            const targetPathOnly = new URL(targetUrl).pathname;
            const isOnTargetPage = window.location.pathname === targetPathOnly;

            if (isOnTargetPage && onOpenTicket) {
                // Đã ở đúng trang → dùng callback để điều hướng trong app (không reload)
                onOpenTicket();
            } else {
                // Đang ở trang khác hoặc chưa vào → navigate đến URL đích
                // proxy.ts sẽ tự redirect về login nếu chưa đăng nhập, 
                // và sau khi login sẽ quay lại đúng trang
                window.location.href = targetUrl;
            }
        };
        
        activeNativeNotification = notif;
    }
};


const closeNativeNotification = () => {
    if (activeNativeNotification) {
        activeNativeNotification.close();
        activeNativeNotification = null;
    }
};

export interface UseTicketsCallbacks {
    onSelectTicket?: (ticket: Ticket) => void;
    onNavigateToMyTickets?: () => void;
}

export const useTickets = (
    user: any, 
    isAdmin: boolean, 
    targetDepartment: string = 'CNTT',
    callbacks?: UseTicketsCallbacks
) => {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(false);
    
    const callbacksRef = useRef<UseTicketsCallbacks | undefined>(callbacks);
    callbacksRef.current = callbacks;

    const prevUnassignedCountRef = useRef<number | null>(null);
    const prevMyPendingCountRef = useRef<number | null>(null);

    const quickReceiveTicket = async (ticket: Ticket) => {
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
            const res = await fetch(`${getBasePath()}/api/error-management/it-requests`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                message.success('Đã nhận việc thành công!');
                notification.destroy('unaccepted-ticket-warning');
                // Cập nhật ngay lập tức state (Optimistic UI)
                setTickets(prev => prev.map(t => {
                    if (t.id === ticket.id) {
                        return {
                            ...t,
                            status: 'IN_PROGRESS',
                            assigneeId: user?.id,
                            assigneeName: user?.name || user?.username,
                            assigneePhone: user?.phone || user?.staff?.so_dien_thoai || t.assigneePhone,
                            startedAt: t.startedAt || new Date().toISOString()
                        };
                    }
                    return t;
                }));
                fetchTickets(true);
            } else {
                message.error('Lỗi khi nhận việc');
            }
        } catch (err) {
            message.error('Lỗi kết nối khi nhận việc');
        }
    };

    const handleReceiveTicketById = async (id: string) => {
        const found = tickets.find(t => t.id === id);
        if (found) {
            await quickReceiveTicket(found);
        } else {
            try {
                const res = await fetch(`${getBasePath()}/api/error-management/it-requests`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id,
                        assigneeId: user?.id,
                        status: 'IN_PROGRESS'
                    })
                });
                if (res.ok) {
                    message.success('Đã nhận việc thành công!');
                    notification.destroy('unaccepted-ticket-warning');
                    setTickets(prev => prev.map(t => t.id === id ? {
                        ...t,
                        status: 'IN_PROGRESS',
                        assigneeId: user?.id,
                        assigneeName: user?.name || user?.username,
                        startedAt: t.startedAt || new Date().toISOString()
                    } : t));
                    fetchTickets(true);
                } else {
                    message.error('Lỗi khi nhận việc');
                }
            } catch (err) {
                message.error('Lỗi kết nối khi nhận việc');
            }
        }
    };

    const fetchTickets = async (isPolling = false) => {
        if (!isPolling) setLoading(true);
        try {
            const res = await fetch(`${getBasePath()}/api/error-management/it-requests?targetDepartment=${targetDepartment}&_t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });
            if (res.ok) {
                const data = await res.json();
                setTickets(data);

                // 1. Lỗi mới chờ tiếp nhận: Chỉ tính PENDING và chưa gán ai
                // Loại trừ hoàn toàn các trạng thái IN_PROGRESS và RESOLVED
                const unassignedTickets = data.filter((t: any) => !t.assigneeId && t.status === 'PENDING');

                // 2. Việc phân công cho mình: Chỉ tính việc chờ nhận (PENDING) hoặc chờ chuyển giao (TRANSFERRING)
                // Tuyệt đối KHÔNG hiển thị và KHÔNG tính nếu đã nhận việc (IN_PROGRESS) hoặc hoàn thành (RESOLVED)
                const myPendingTickets = data.filter((t: any) => 
                    ((t.assigneeId === user?.id && t.status === 'PENDING') || 
                     (t.transferToId === user?.id && t.status === 'TRANSFERRING')) &&
                    t.status !== 'IN_PROGRESS' && t.status !== 'RESOLVED'
                );
                
                // Cảnh báo lỗi mới gửi lên (dành cho Admin / Điều phối)
                if (isPolling && prevUnassignedCountRef.current !== null && unassignedTickets.length > prevUnassignedCountRef.current) {
                    if (isAdmin) {
                        playNotificationSound(targetDepartment, user?.id);
                        notification.info({
                            title: 'Có lỗi mới chờ tiếp nhận!',
                            description: 'Có một lỗi mới vừa được gửi lên chưa có người xử lý.',
                            placement: 'bottomRight',
                        });
                        showNativeNotification('Có lỗi mới chờ tiếp nhận!', 'Có một lỗi mới vừa được gửi lên chưa có người xử lý.');
                    }
                }

                // Cảnh báo việc mới được phân công cho mình (chưa nhận việc)
                if (isPolling && prevMyPendingCountRef.current !== null && myPendingTickets.length > prevMyPendingCountRef.current) {
                    playNotificationSound(targetDepartment, user?.id);
                    notification.success({
                        title: 'Việc mới được phân công!',
                        description: 'Bạn vừa nhận được một yêu cầu hỗ trợ mới, vui lòng kiểm tra.',
                        placement: 'bottomRight',
                    });
                    showNativeNotification('Việc mới được phân công!', 'Bạn vừa nhận được một yêu cầu hỗ trợ mới, vui lòng kiểm tra.');
                }

                // 3. Cảnh báo liên tục nếu có việc chưa bấm nhận (chỉ PENDING hoặc TRANSFERRING)
                // Nếu trạng thái đã là IN_PROGRESS hoặc RESOLVED thì không bao giờ hiển thị cảnh báo
                const unacceptedTickets = data.filter((t: any) => 
                    ((t.assigneeId === user?.id && t.status === 'PENDING') || 
                     (t.transferToId === user?.id && t.status === 'TRANSFERRING')) &&
                    t.status !== 'IN_PROGRESS' && t.status !== 'RESOLVED'
                );

                if (unacceptedTickets.length > 0) {
                    // Dùng path cố định KHÔNG có basePath, vì showNativeNotification sẽ tự thêm basePath
                    const targetUrl = `/error-management/it-requests?tab=MINE&status=PENDING`;

                    // 1. Nhấp nháy tiêu đề Tab của trình duyệt (thấy được ngay trên thanh tab khi ở tab khác)
                    startTitleBlink(`🚨 (${unacceptedTickets.length}) Việc chưa tiếp nhận!`);

                    // 2. Âm thanh chuông báo
                    if (isPolling) {
                        playNotificationSound(targetDepartment, user?.id);
                    }

                    // 3. Thông báo ngoài Desktop của hệ điều hành (kể cả khi ở tab khác hoặc thu nhỏ trình duyệt)
                    if (isPolling || (typeof document !== 'undefined' && document.hidden)) {
                        showNativeNotification(
                            '🚨 Nhắc nhở: Có việc chưa tiếp nhận!',
                            `Bạn có ${unacceptedTickets.length} yêu cầu cần xử lý. Bấm để xem danh sách!`,
                            targetUrl,
                            () => {
                                callbacksRef.current?.onNavigateToMyTickets?.();
                            }
                        );
                    }

                    // 4. Khung thông báo nội bộ
                    notification.warning({
                        key: 'unaccepted-ticket-warning',
                        title: React.createElement(TicketNotificationTitle),
                        description: React.createElement(TicketNotificationContent, {
                            tickets: unacceptedTickets,
                            onSelectTicket: (t: Ticket) => callbacksRef.current?.onSelectTicket?.(t),
                            onNavigateToMyTickets: () => callbacksRef.current?.onNavigateToMyTickets?.(),
                            onQuickReceiveTicket: quickReceiveTicket,
                            onCloseNotification: () => notification.destroy('unaccepted-ticket-warning')
                        }),
                        placement: 'bottomRight',
                        duration: 15,
                    });
                } else {
                    stopTitleBlink();
                    notification.destroy('unaccepted-ticket-warning');
                    closeNativeNotification();
                }

                prevUnassignedCountRef.current = unassignedTickets.length;
                prevMyPendingCountRef.current = myPendingTickets.length;
            }
        } catch (error) {
            if (!isPolling) message.error('Lỗi khi tải dữ liệu');
        } finally {
            if (!isPolling) setLoading(false);
        }
    };

    // Tự động kiểm tra và nhắc bật quyền thông báo Desktop
    useEffect(() => {
        promptForNotificationPermission();
    }, []);

    // Lắng nghe khi chuyển qua lại giữa các tab
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                // Khi người dùng quay lại tab này, làm mới dữ liệu
                fetchTickets(true);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isAdmin]);

    useEffect(() => {
        fetchTickets();
        return () => {
            stopTitleBlink();
            notification.destroy('unaccepted-ticket-warning');
            closeNativeNotification();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isAdmin]);

    useEffect(() => {
        const interval = setInterval(() => {
            fetchTickets(true);
        }, 15000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isAdmin]);

    const handleUpdateTicket = async (values: any, selectedTicket: Ticket | null, onSuccess: () => void) => {
        if (!selectedTicket) return;
        try {
            let payload: any = {
                id: selectedTicket.id,
                status: values.status,
                it_note: values.it_note,
                assigneeId: values.assigneeId || null,
                vendorId: values.vendorId || null,
                vendorName: values.vendorName || null,
                vendorTicketCode: values.vendorTicketCode || null,
                vendorExpectedReturnAt: values.vendorExpectedReturnAt || null,
                it_images: values.it_images || []
            };

            if (selectedTicket.assigneeId && values.assigneeId && values.assigneeId !== selectedTicket.assigneeId) {
                payload = {
                    id: selectedTicket.id,
                    action: 'TRANSFER',
                    transferToId: values.assigneeId,
                    it_note: values.it_note,
                    vendorId: values.vendorId || null,
                    vendorName: values.vendorName || null,
                    vendorTicketCode: values.vendorTicketCode || null,
                    vendorExpectedReturnAt: values.vendorExpectedReturnAt || null,
                    it_images: values.it_images || []
                };
            }

            const res = await fetch(`${getBasePath()}/api/error-management/it-requests`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success('Cập nhật thành công!');
                onSuccess();
                fetchTickets();
            } else {
                message.error('Cập nhật thất bại');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleDeleteTicket = async (id: string) => {
        try {
            const res = await fetch(`${getBasePath()}/api/error-management/it-requests?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                message.success('Xóa yêu cầu thành công!');
                fetchTickets();
            } else {
                const err = await res.json();
                message.error(err.error || 'Xóa yêu cầu thất bại');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    return {
        tickets,
        loading,
        fetchTickets,
        handleUpdateTicket,
        handleDeleteTicket,
        quickReceiveTicket,
        handleReceiveTicketById
    };
};
