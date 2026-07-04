import { useState, useEffect } from 'react';
import { message, notification } from 'antd';
import { Ticket } from '../types';
import { playNotificationSound } from '@/utils/audioUtils';

let activeNativeNotification: Notification | null = null;

const showNativeNotification = (title: string, body: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        // Tạm thời bỏ kiểm tra tab ẩn để test xem Windows có chặn trình duyệt không
        // if (document.visibilityState === 'visible') return;

        // Đóng thông báo cũ để HĐH chịu hiển thị popup mới
        if (activeNativeNotification) {
            activeNativeNotification.close();
        }

        const notif = new Notification(title, {
            body,
            icon: '/favicon.ico',
            tag: 'it-request-notification-' + Date.now(), // Đổi tag liên tục để ép popup nổi lên
            requireInteraction: true, 
            silent: true 
        });
        
        notif.onclick = () => {
            window.focus();
            notif.close();
        };
        
        activeNativeNotification = notif;
    }
};

export const useTickets = (user: any, isAdmin: boolean, targetDepartment: string = 'CNTT') => {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(false);
    
    const [lastUnassignedCount, setLastUnassignedCount] = useState<number>(0);
    const [lastMyTicketCount, setLastMyTicketCount] = useState<number>(0);

    const fetchTickets = async (isPolling = false) => {
        if (!isPolling) setLoading(true);
        try {
            const res = await fetch(`/api/error-management/it-requests?targetDepartment=${targetDepartment}`);
            if (res.ok) {
                const data = await res.json();
                setTickets(data);
                const unassignedTickets = data.filter((t: any) => !t.assigneeId && t.status === 'PENDING');
                const myTickets = data.filter((t: any) => (t.assigneeId === user?.id || t.transferToId === user?.id) && t.status !== 'RESOLVED');
                
                if (isPolling && unassignedTickets.length > lastUnassignedCount && lastUnassignedCount !== 0) {
                    if (isAdmin) {
                        playNotificationSound(targetDepartment);
                        notification.info({
                            title: 'Có lỗi mới chờ tiếp nhận!',
                            description: 'Có một lỗi mới vừa được gửi lên chưa có người xử lý.',
                            placement: 'bottomRight',
                        });
                        showNativeNotification('Có lỗi mới chờ tiếp nhận!', 'Có một lỗi mới vừa được gửi lên chưa có người xử lý.');
                    }
                }

                if (isPolling && myTickets.length > lastMyTicketCount && lastMyTicketCount !== 0) {
                    playNotificationSound(targetDepartment);
                    notification.success({
                        title: 'Việc mới được phân công!',
                        description: 'Bạn vừa nhận được một yêu cầu hỗ trợ mới, vui lòng kiểm tra.',
                        placement: 'bottomRight',
                    });
                    showNativeNotification('Việc mới được phân công!', 'Bạn vừa nhận được một yêu cầu hỗ trợ mới, vui lòng kiểm tra.');
                }

                // Cảnh báo liên tục nếu có việc chưa nhận (PENDING hoặc TRANSFERRING)
                const unacceptedTickets = data.filter((t: any) => 
                    (t.assigneeId === user?.id && t.status === 'PENDING') || 
                    (t.transferToId === user?.id && t.status === 'TRANSFERRING')
                );

                if (unacceptedTickets.length > 0) {
                    if (isPolling) {
                        playNotificationSound(targetDepartment);
                        showNativeNotification('🚨 Nhắc nhở: Có việc chưa tiếp nhận!', `Bạn đang có ${unacceptedTickets.length} yêu cầu cần xử lý. Vui lòng bấm "Nhận việc"!`);
                    }
                    notification.warning({
                        key: 'unaccepted-ticket-warning',
                        title: '🚨 Nhắc nhở: Có việc chưa tiếp nhận!',
                        description: `Bạn đang có ${unacceptedTickets.length} yêu cầu cần xử lý. Vui lòng bấm "Nhận việc"!`,
                        placement: 'bottomRight',
                        duration: 10, // Tồn tại 10s, vòng lặp 15s sẽ gọi lại nếu vẫn chưa nhận
                    });
                } else {
                    notification.destroy('unaccepted-ticket-warning');
                }

                setLastUnassignedCount(unassignedTickets.length);
                setLastMyTicketCount(myTickets.length);
            }
        } catch (error) {
            if (!isPolling) message.error('Lỗi khi tải dữ liệu');
        } finally {
            if (!isPolling) setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isAdmin]);

    useEffect(() => {
        const interval = setInterval(() => {
            fetchTickets(true);
        }, 15000);
        return () => clearInterval(interval);
    }, [lastUnassignedCount, lastMyTicketCount, user, isAdmin]);

    const handleUpdateTicket = async (values: any, selectedTicket: Ticket | null, onSuccess: () => void) => {
        if (!selectedTicket) return;
        try {
            let payload: any = {
                id: selectedTicket.id,
                status: values.status,
                it_note: values.it_note,
                assigneeId: values.assigneeId || null
            };

            if (selectedTicket.assigneeId && values.assigneeId && values.assigneeId !== selectedTicket.assigneeId) {
                payload = {
                    id: selectedTicket.id,
                    action: 'TRANSFER',
                    transferToId: values.assigneeId,
                    it_note: values.it_note,
                };
            }

            const res = await fetch('/api/error-management/it-requests', {
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
            const res = await fetch(`/api/error-management/it-requests?id=${id}`, {
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
        handleDeleteTicket
    };
};
