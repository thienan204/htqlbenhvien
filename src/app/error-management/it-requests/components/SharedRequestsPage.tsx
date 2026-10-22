'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, Segmented, message, Modal, DatePicker, Button, Tooltip, Select } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
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
    const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>([dayjs().startOf('day'), dayjs().endOf('day')]);
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
        handleReceiveTicketById,
        handlePauseTicket,
        handleResumeTicket
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

        // Lọc theo khoảng ngày (mặc định hôm nay, hoặc khoảng được chọn)
        if (dateRange && (dateRange[0] || dateRange[1])) {
            const start = dateRange[0] ? dateRange[0].startOf('day') : null;
            const end = dateRange[1] ? dateRange[1].endOf('day') : null;
            result = result.filter(t => {
                if (!t.createdAt) return false;
                const created = dayjs(t.createdAt);
                if (start && end) {
                    return (created.isAfter(start) || created.isSame(start)) && (created.isBefore(end) || created.isSame(end));
                }
                if (start) return created.isAfter(start) || created.isSame(start);
                if (end) return created.isBefore(end) || created.isSame(end);
                return true;
            });
        }

        return result;
    }, [tickets, filterMode, isAdmin, user, dateRange]);

    const statusCounts = useMemo(() => {
        return {
            ALL: baseTickets.length,
            PENDING: baseTickets.filter(t => t.status === 'PENDING').length,
            IN_PROGRESS: baseTickets.filter(t => t.status === 'IN_PROGRESS').length,
            PAUSED: baseTickets.filter(t => t.status === 'PAUSED').length,
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

        // Lọc theo khoảng ngày
        if (dateRange && (dateRange[0] || dateRange[1])) {
            const start = dateRange[0] ? dateRange[0].startOf('day') : null;
            const end = dateRange[1] ? dateRange[1].endOf('day') : null;
            allTickets = allTickets.filter(t => {
                if (!t.createdAt) return false;
                const created = dayjs(t.createdAt);
                if (start && end) {
                    return (created.isAfter(start) || created.isSame(start)) && (created.isBefore(end) || created.isSame(end));
                }
                if (start) return created.isAfter(start) || created.isSame(start);
                if (end) return created.isBefore(end) || created.isSame(end);
                return true;
            });
        }

        const mineCount = allTickets.filter(t => t.assigneeId === user?.id || t.transferToId === user?.id).length;
        const unassignedCount = allTickets.filter(t => !t.assigneeId).length;
        return {
            ALL: allTickets.length,
            MINE: mineCount,
            UNASSIGNED: unassignedCount
        };
    }, [tickets, isAdmin, user, dateRange]);

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
                    targetDepartment,
                    users: [{ id: user.id, isAvailable: checked }]
                })
            });
            const data = await res.json();
            if (res.ok) {
                setIsAvailable(checked);
                message.success(`Đã ${checked ? 'Bật' : 'Tắt'} trạng thái nhận việc tự động!`);
                fetchITUsers();

                // Cảnh báo nếu tất cả nhân viên phòng CNTT đều OFF
                if (data?.allStaffOff) {
                    Modal.warning({
                        title: <span className="text-red-600 font-bold text-base">⚠️ CẢNH BÁO: PHÒNG {targetDepartment} KHÔNG CÒN AI NHẬN VIỆC!</span>,
                        content: (
                            <div className="space-y-2 text-slate-700 py-1 text-sm">
                                <p>Bạn vừa chuyển trạng thái sang <strong>Tắt nhận việc</strong>.</p>
                                <p className="text-red-700 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
                                    🚨 Hiện tại phòng <strong>{targetDepartment}</strong> KHÔNG CÒN nhân viên nào đang bật nhận việc! Các yêu cầu gửi lên từ các Khoa/Phòng sẽ không có ai tiếp nhận.
                                </p>
                                <p className="text-xs text-slate-500">
                                    Hệ thống đã tự động gửi tin nhắn cảnh báo khẩn cấp lên nhóm Telegram của phòng {targetDepartment}.
                                </p>
                            </div>
                        ),
                        okText: 'Tôi đã hiểu',
                        okButtonProps: { danger: true },
                        width: 520
                    });
                }
            } else {
                message.error(data?.error || 'Lỗi khi cập nhật trạng thái');
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
                    targetDepartment,
                    users: [{ 
                        id: user.id, 
                        isAvailable: disabled ? true : isAvailable,
                        autoAssignDisabled: disabled,
                        focusReason: disabled ? taskReason : null
                    }]
                })
            });
            const data = await res.json();

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

                    // Cảnh báo nếu cả phòng không còn ai nhận việc tự động
                    if (data?.allStaffOff) {
                        Modal.warning({
                            title: <span className="text-amber-600 font-bold text-base">⚠️ CẢNH BÁO: PHÒNG {targetDepartment} KHÔNG CÒN AI NHẬN VIỆC TỰ ĐỘNG!</span>,
                            content: (
                                <div className="space-y-2 text-slate-700 py-1 text-sm">
                                    <p>Bạn vừa bật <strong>Chế độ tập trung</strong> (miễn chia việc tự động).</p>
                                    <p className="text-amber-800 font-medium bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                                        🚨 Hiện tại phòng <strong>{targetDepartment}</strong> KHÔNG CÒN nhân viên nào khác sẵn sàng nhận việc tự động!
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Hệ thống đã tự động gửi cảnh báo khẩn cấp lên nhóm Telegram để nhắc nhở nhân viên ca trực.
                                    </p>
                                </div>
                            ),
                            okText: 'Tôi đã hiểu',
                            width: 520
                        });
                    }
                } else {
                    message.success('Đã tắt chế độ tập trung, bạn sẽ tiếp tục nhận việc tự động từ khoa phòng!');
                    fetchTickets();
                }

                fetchITUsers();
            } else {
                message.error(data?.error || 'Lỗi khi cập nhật trạng thái');
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

            {/* Thanh bộ lọc gom trên 1 dòng duy nhất */}
            <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                {/* Cụm bên trái: Phân loại phạm vi (Admin) + Select Trạng thái */}
                <div className="flex flex-wrap items-center gap-2.5">
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

                    {/* Hộp chọn Trạng thái xử lý (Select) */}
                    <div className="flex items-center bg-white p-1 sm:p-1.5 rounded-xl border border-slate-100 shadow-sm shrink-0">
                        <Select
                            value={statusFilter}
                            onChange={(val) => setStatusFilter(val)}
                            className="w-[185px] sm:w-[215px]"
                            variant="borderless"
                            popupMatchSelectWidth={225}
                            options={[
                                {
                                    label: (
                                        <div className="flex items-center justify-between gap-2 w-full">
                                            <span className="font-medium text-slate-700">Tất cả trạng thái</span>
                                            <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold">
                                                {statusCounts.ALL}
                                            </span>
                                        </div>
                                    ),
                                    value: 'ALL'
                                },
                                {
                                    label: (
                                        <div className="flex items-center justify-between gap-2 w-full">
                                            <span className="font-medium text-amber-700">Chờ xử lý</span>
                                            <span className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${statusCounts.PENDING > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {statusCounts.PENDING}
                                            </span>
                                        </div>
                                    ),
                                    value: 'PENDING'
                                },
                                {
                                    label: (
                                        <div className="flex items-center justify-between gap-2 w-full">
                                            <span className="font-medium text-blue-700">Đang xử lý</span>
                                            <span className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${statusCounts.IN_PROGRESS > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {statusCounts.IN_PROGRESS}
                                            </span>
                                        </div>
                                    ),
                                    value: 'IN_PROGRESS'
                                },
                                {
                                    label: (
                                        <div className="flex items-center justify-between gap-2 w-full">
                                            <span className="font-medium text-purple-700">⏸️ Tạm dừng</span>
                                            <span className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${statusCounts.PAUSED > 0 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {statusCounts.PAUSED}
                                            </span>
                                        </div>
                                    ),
                                    value: 'PAUSED'
                                },
                                {
                                    label: (
                                        <div className="flex items-center justify-between gap-2 w-full">
                                            <span className="font-medium text-orange-700">🏢 Chờ đối tác</span>
                                            <span className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${statusCounts.WAITING_VENDOR > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {statusCounts.WAITING_VENDOR}
                                            </span>
                                        </div>
                                    ),
                                    value: 'WAITING_VENDOR'
                                },
                                {
                                    label: (
                                        <div className="flex items-center justify-between gap-2 w-full">
                                            <span className="font-medium text-purple-700">Chờ chuyển giao</span>
                                            <span className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${statusCounts.TRANSFERRING > 0 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {statusCounts.TRANSFERRING}
                                            </span>
                                        </div>
                                    ),
                                    value: 'TRANSFERRING'
                                },
                                {
                                    label: (
                                        <div className="flex items-center justify-between gap-2 w-full">
                                            <span className="font-medium text-emerald-700">Hoàn thành</span>
                                            <span className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${statusCounts.RESOLVED > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
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

                {/* Cụm bên phải: Bộ lọc theo khoảng ngày (Mặc định: Ngày hiện tại) */}
                <div className="flex items-center gap-1.5 bg-white p-1 sm:p-1.5 rounded-xl border border-slate-100 shadow-sm shrink-0">
                    <Tooltip title="Chọn khoảng ngày để lọc yêu cầu (Bấm 'x' hoặc nút 'Tất cả' để xem toàn bộ lịch sử)">
                        <DatePicker.RangePicker 
                            value={dateRange}
                            onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
                            format="DD/MM/YYYY"
                            allowClear
                            placeholder={['Từ ngày', 'Đến ngày']}
                            className="rounded-lg text-xs sm:text-sm font-medium w-[220px] sm:w-[240px]"
                        />
                    </Tooltip>
                    <Button 
                        size="small"
                        type={dateRange && dateRange[0]?.isSame(dayjs(), 'day') && dateRange[1]?.isSame(dayjs(), 'day') ? 'primary' : 'default'}
                        onClick={() => setDateRange([dayjs().startOf('day'), dayjs().endOf('day')])}
                        className={`text-xs rounded-lg ${dateRange && dateRange[0]?.isSame(dayjs(), 'day') && dateRange[1]?.isSame(dayjs(), 'day') ? 'bg-blue-600 font-semibold' : 'text-slate-600 hover:text-blue-600'}`}
                    >
                        Hôm nay
                    </Button>
                    <Button 
                        size="small"
                        type={!dateRange || (!dateRange[0] && !dateRange[1]) ? 'primary' : 'default'}
                        onClick={() => setDateRange(null)}
                        className={`text-xs rounded-lg ${!dateRange || (!dateRange[0] && !dateRange[1]) ? 'bg-blue-600 font-semibold' : 'text-slate-600 hover:text-blue-600'}`}
                    >
                        Tất cả
                    </Button>
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
                    onPauseTicket={handlePauseTicket}
                    onResumeTicket={handleResumeTicket}
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
