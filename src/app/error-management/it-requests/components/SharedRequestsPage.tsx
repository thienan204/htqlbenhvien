'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, Segmented, message } from 'antd';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

import { TicketHeader } from './TicketHeader';
import { TicketTable } from './TicketTable';
import { TicketActionModal } from './TicketActionModal';
import { EditTicketModal } from './EditTicketModal';
import { TicketChatModal } from './TicketChatModal';
import { NotificationSettingsModal } from './NotificationSettingsModal';
import { useITMasterData } from '../hooks/useITMasterData';
import { useTickets } from '../hooks/useTickets';
import { Ticket } from '../types';
import { getBasePath } from '@/utils/config';

interface SharedRequestsPageProps {
    targetDepartment: string;
    createPath: string;
}

export function SharedRequestsPage({ targetDepartment, createPath }: SharedRequestsPageProps) {
    const router = useRouter();
    const { user, hasPermission } = useAuth();
    const isAdmin = user?.role === 'ADMIN' || user?.role === targetDepartment;

    const [isActionModalVisible, setIsActionModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isChatVisible, setIsChatVisible] = useState(false);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [filterMode, setFilterMode] = useState<'ALL' | 'MINE' | 'UNASSIGNED'>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [togglingAvailability, setTogglingAvailability] = useState(false);

    const [togglingFocusMode, setTogglingFocusMode] = useState(false);

    const {
        itUsers,
        departments,
        assignmentMode,
        isAvailable,
        setIsAvailable,
        autoAssignDisabled,
        setAutoAssignDisabled,
        focusReason,
        setFocusReason,
        fetchITUsers
    } = useITMasterData(user, targetDepartment);

    const handleSelectTicket = (ticket: Ticket) => {
        setFilterMode('MINE');
        setStatusFilter('ALL');
        setSelectedTicket(ticket);
        setIsActionModalVisible(true);
    };

    const handleNavigateToMyTickets = () => {
        setFilterMode('MINE');
        setStatusFilter('PENDING');
        setIsActionModalVisible(false);
    };

    const {
        tickets,
        loading,
        fetchTickets,
        handleUpdateTicket,
        handleDeleteTicket,
        handleReceiveTicketById
    } = useTickets(user, isAdmin, targetDepartment, {
        onSelectTicket: handleSelectTicket,
        onNavigateToMyTickets: handleNavigateToMyTickets
    });

    // Lắng nghe URL params tab/status từ thông báo Windows (chuyển sang danh sách việc của tôi chờ xử lý, không mở modal)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const status = params.get('status');
        if (tab === 'MINE') setFilterMode('MINE');
        if (status) setStatusFilter(status);
        if (tab || status) {
            setIsActionModalVisible(false);
            const url = new URL(window.location.href);
            url.searchParams.delete('tab');
            url.searchParams.delete('status');
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

    // Tự động mở modal xử lý nếu URL có param ticketId hoặc highlight cụ thể
    useEffect(() => {
        if (typeof window === 'undefined' || tickets.length === 0) return;
        const params = new URLSearchParams(window.location.search);
        const ticketId = params.get('ticketId') || params.get('highlight');
        if (ticketId) {
            const found = tickets.find(t => t.id === ticketId);
            if (found) {
                handleSelectTicket(found);
                const url = new URL(window.location.href);
                url.searchParams.delete('ticketId');
                url.searchParams.delete('highlight');
                window.history.replaceState({}, '', url.toString());
            }
        }
    }, [tickets]);

    const baseTickets = useMemo(() => {
        let result = tickets;
        if (isAdmin) {
            if (filterMode === 'MINE') result = result.filter(t => t.assigneeId === user?.id || t.transferToId === user?.id);
            if (filterMode === 'UNASSIGNED') result = result.filter(t => !t.assigneeId);
        } else if (user?.ma_khoa) {
            result = result.filter(t => t.ma_khoa === user.ma_khoa);
        }
        return result;
    }, [tickets, filterMode, isAdmin, user]);

    const statusCounts = useMemo(() => {
        return {
            ALL: baseTickets.length,
            PENDING: baseTickets.filter(t => t.status === 'PENDING').length,
            IN_PROGRESS: baseTickets.filter(t => t.status === 'IN_PROGRESS').length,
            WAITING_VENDOR: baseTickets.filter(t => t.status === 'WAITING_VENDOR').length,
            TRANSFERRING: baseTickets.filter(t => t.status === 'TRANSFERRING').length,
            RESOLVED: baseTickets.filter(t => t.status === 'RESOLVED').length,
        };
    }, [baseTickets]);

    const filterModeCounts = useMemo(() => {
        let allTickets = tickets;
        if (!isAdmin && user?.ma_khoa) {
            allTickets = allTickets.filter(t => t.ma_khoa === user.ma_khoa);
        }
        const mineCount = allTickets.filter(t => t.assigneeId === user?.id || t.transferToId === user?.id).length;
        const unassignedCount = allTickets.filter(t => !t.assigneeId).length;
        return {
            ALL: allTickets.length,
            MINE: mineCount,
            UNASSIGNED: unassignedCount
        };
    }, [tickets, isAdmin, user]);

    const filteredTickets = useMemo(() => {
        let result = baseTickets;
        if (statusFilter !== 'ALL') {
            result = result.filter(t => t.status === statusFilter);
        }
        return result;
    }, [baseTickets, statusFilter]);

    const handleToggleAvailability = async (checked: boolean) => {
        if (!user) return;
        setTogglingAvailability(true);
        try {
            const res = await fetch(`${getBasePath()}/api/error-management/duty-roster`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    users: [{ id: user.id, isAvailable: checked }]
                })
            });
            if (res.ok) {
                setIsAvailable(checked);
                message.success(`Đã ${checked ? 'Bật' : 'Tắt'} trạng thái nhận việc tự động!`);
                fetchITUsers();
            } else {
                message.error('Lỗi khi cập nhật trạng thái');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setTogglingAvailability(false);
        }
    };

    const handleToggleFocusMode = async (disabled: boolean, reason?: string) => {
        if (!user) return;
        setTogglingFocusMode(true);
        try {
            const taskReason = reason?.trim() || 'Nhiệm vụ tập trung';

            // 1. Cập nhật trạng thái miễn chia việc tự động trong duty-roster (bật luôn có mặt nếu đang tắt)
            const res = await fetch(`${getBasePath()}/api/error-management/duty-roster`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    users: [{ 
                        id: user.id, 
                        isAvailable: disabled ? true : isAvailable,
                        autoAssignDisabled: disabled,
                        focusReason: disabled ? taskReason : null
                    }]
                })
            });

            if (res.ok) {
                if (disabled && !isAvailable) {
                    setIsAvailable(true);
                }
                setAutoAssignDisabled(disabled);
                setFocusReason(disabled ? taskReason : '');

                // 2. NẾU BẬT TẬP TRUNG (disabled === true): Tự động tạo luôn một Phiếu Yêu cầu
                if (disabled) {
                    try {
                        const createRes = await fetch(`${getBasePath()}/api/error-management/it-requests`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ten_loi: taskReason,
                                category: 'SOFTWARE',
                                targetDepartment: targetDepartment || 'CNTT',
                                assigneeId: user.id,
                                selfAssign: true,
                                isFocusTask: true,
                                focusReason: taskReason,
                                status: 'IN_PROGRESS',
                                ma_khoa: user.ma_khoa || targetDepartment || 'CNTT',
                                nguoi_bao_id: (user as any).staff?.id || user.id,
                                sdt: (user as any).staff?.so_dien_thoai || (user as any).phone || '',
                                dynamicFields: {
                                    'Loại yêu cầu': 'Nhiệm vụ tập trung',
                                    'Người báo': user.name || user.username
                                }
                            })
                        });

                        if (createRes.ok) {
                            message.success(`Đã bật Chế độ tập trung và tự động tạo Yêu cầu: "${taskReason}"!`);
                            fetchTickets();
                        } else {
                            message.success('Đã bật Chế độ tập trung!');
                        }
                    } catch (createErr) {
                        console.error('Lỗi tự động tạo yêu cầu tập trung:', createErr);
                        message.success('Đã bật Chế độ tập trung!');
                    }
                } else {
                    message.success('Đã tắt chế độ tập trung, bạn sẽ tiếp tục nhận việc tự động từ khoa phòng!');
                    fetchTickets();
                }

                fetchITUsers();
            } else {
                message.error('Lỗi khi cập nhật trạng thái');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setTogglingFocusMode(false);
        }
    };

    const handleDeleteAllTickets = async () => {
        try {
            const res = await fetch(`${getBasePath()}/api/error-management/it-requests?action=delete_all&targetDepartment=${targetDepartment}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                message.success('Đã xóa toàn bộ dữ liệu thành công!');
                fetchTickets();
            } else {
                const data = await res.json();
                message.error(data.error || 'Lỗi khi xóa dữ liệu');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    return (
        <div className="w-full max-w-[98%] mx-auto px-4 sm:px-[30px] py-4 sm:py-6 space-y-4 sm:space-y-6">
            <TicketHeader 
                user={user}
                isAdmin={isAdmin}
                isAvailable={isAvailable}
                togglingAvailability={togglingAvailability}
                onToggleAvailability={handleToggleAvailability}
                autoAssignDisabled={autoAssignDisabled}
                focusReason={focusReason}
                togglingFocusMode={togglingFocusMode}
                onToggleFocusMode={handleToggleFocusMode}
                onCreateRequest={() => router.push(createPath)}
                onOpenSettings={() => setIsSettingsVisible(true)}
                onDeleteAll={isAdmin ? handleDeleteAllTickets : undefined}
                targetDepartment={targetDepartment}
            />

            <div className="flex flex-col xl:flex-row gap-3 items-start xl:items-center w-full overflow-x-auto scrollbar-hide pb-0.5">
                {isAdmin && (
                    <div className="flex bg-white p-1 sm:p-1.5 rounded-xl border border-slate-100 shadow-sm shrink-0 overflow-x-auto scrollbar-hide">
                        <Segmented 
                            className="min-w-max"
                            options={[
                                {
                                    label: (
                                        <div className="flex items-center gap-1.5 px-1 py-0.5">
                                            <span>Tất cả Yêu cầu</span>
                                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                                                {filterModeCounts.ALL}
                                            </span>
                                        </div>
                                    ),
                                    value: 'ALL'
                                },
                                {
                                    label: (
                                        <div className="flex items-center gap-1.5 px-1 py-0.5">
                                            <span>Việc của tôi</span>
                                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${filterModeCounts.MINE > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {filterModeCounts.MINE}
                                            </span>
                                        </div>
                                    ),
                                    value: 'MINE'
                                },
                                ...(assignmentMode !== 'C' ? [{
                                    label: (
                                        <div className="flex items-center gap-1.5 px-1 py-0.5">
                                            <span>Chờ nhận việc (Trống)</span>
                                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${filterModeCounts.UNASSIGNED > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {filterModeCounts.UNASSIGNED}
                                            </span>
                                        </div>
                                    ),
                                    value: 'UNASSIGNED'
                                }] : [])
                            ]}
                            value={filterMode}
                            onChange={(val: any) => {
                                setFilterMode(val);
                                setStatusFilter('ALL');
                            }}
                        />
                    </div>
                )}
                <div className="flex bg-white p-1 sm:p-1.5 rounded-xl border border-slate-100 shadow-sm shrink-0 overflow-x-auto scrollbar-hide">
                    <Segmented
                        className="min-w-max"
                        value={statusFilter}
                        onChange={(val: any) => setStatusFilter(val)}
                        options={[
                            {
                                label: (
                                    <div className="flex items-center gap-1.5 px-1 py-0.5">
                                        <span>Tất cả</span>
                                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                                            {statusCounts.ALL}
                                        </span>
                                    </div>
                                ),
                                value: 'ALL'
                            },
                            {
                                label: (
                                    <div className="flex items-center gap-1.5 px-1 py-0.5">
                                        <span>Chờ xử lý</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${statusCounts.PENDING > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {statusCounts.PENDING}
                                        </span>
                                    </div>
                                ),
                                value: 'PENDING'
                            },
                            {
                                label: (
                                    <div className="flex items-center gap-1.5 px-1 py-0.5">
                                        <span>Đang xử lý</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${statusCounts.IN_PROGRESS > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {statusCounts.IN_PROGRESS}
                                        </span>
                                    </div>
                                ),
                                value: 'IN_PROGRESS'
                            },
                            {
                                label: (
                                    <div className="flex items-center gap-1.5 px-1 py-0.5">
                                        <span>🏢 Chờ đối tác</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${statusCounts.WAITING_VENDOR > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {statusCounts.WAITING_VENDOR}
                                        </span>
                                    </div>
                                ),
                                value: 'WAITING_VENDOR'
                            },
                            {
                                label: (
                                    <div className="flex items-center gap-1.5 px-1 py-0.5">
                                        <span>Chờ chuyển giao</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${statusCounts.TRANSFERRING > 0 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {statusCounts.TRANSFERRING}
                                        </span>
                                    </div>
                                ),
                                value: 'TRANSFERRING'
                            },
                            {
                                label: (
                                    <div className="flex items-center gap-1.5 px-1 py-0.5">
                                        <span>Hoàn thành</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${statusCounts.RESOLVED > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {statusCounts.RESOLVED}
                                        </span>
                                    </div>
                                ),
                                value: 'RESOLVED'
                            }
                        ]}
                    />
                </div>
            </div>

            <Card className="shadow-sm rounded-2xl overflow-hidden border-slate-100" styles={{ body: { padding: 0 } }}>
                <TicketTable 
                    tickets={filteredTickets}
                    loading={loading}
                    departments={departments}
                    user={user}
                    hasPermission={hasPermission}
                    assignmentMode={assignmentMode}
                    onFetchTickets={() => {
                        fetchTickets();
                        fetchITUsers();
                    }}
                    onReceiveTicket={handleReceiveTicketById}
                    onDeleteTicket={handleDeleteTicket}
                    onProcessClick={(ticket) => {
                        setSelectedTicket(ticket);
                        setIsActionModalVisible(true);
                    }}
                    onChatClick={(ticket) => {
                        setSelectedTicket(ticket);
                        setIsChatVisible(true);
                    }}
                    onEditClick={(ticket) => {
                        setSelectedTicket(ticket);
                        setIsEditModalVisible(true);
                    }}
                    targetDepartment={targetDepartment}
                />
            </Card>

            {isActionModalVisible && (
                <TicketActionModal 
                    visible={isActionModalVisible}
                    ticket={selectedTicket}
                    itUsers={itUsers}
                    user={user}
                    onCancel={() => setIsActionModalVisible(false)}
                    onOk={(values) => handleUpdateTicket(values, selectedTicket, () => {
                        setIsActionModalVisible(false);
                        fetchITUsers();
                    })}
                    targetDepartment={targetDepartment}
                />
            )}

            {isEditModalVisible && (
                <EditTicketModal
                    visible={isEditModalVisible}
                    ticket={selectedTicket}
                    onCancel={() => setIsEditModalVisible(false)}
                    onSuccess={() => {
                        setIsEditModalVisible(false);
                        fetchTickets();
                    }}
                    targetDepartment={targetDepartment}
                />
            )}

            <TicketChatModal
                visible={isChatVisible}
                ticket={selectedTicket}
                user={user}
                onClose={() => setIsChatVisible(false)}
                onMessageSent={() => fetchTickets(true)}
            />

            <NotificationSettingsModal 
                visible={isSettingsVisible}
                onCancel={() => setIsSettingsVisible(false)}
                targetDepartment={targetDepartment}
                user={user}
            />
        </div>
    );
}
