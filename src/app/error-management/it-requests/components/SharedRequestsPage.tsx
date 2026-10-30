'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, Segmented, message, Modal, DatePicker, Button, Tooltip, Select, Dropdown } from 'antd';
import { CalendarOutlined, AppstoreOutlined, TableOutlined, LayoutOutlined, DesktopOutlined, DownOutlined, MessageOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

import { TicketHeader } from './TicketHeader';
import { TicketTable } from './TicketTable';
import { TicketActionModal } from './TicketActionModal';
import { EditTicketModal } from './EditTicketModal';
import { TicketChatModal } from './TicketChatModal';
import { NotificationSettingsModal } from './NotificationSettingsModal';
import { DepartmentStaffStatusStrip } from './DepartmentStaffStatusStrip';
import { useITMasterData } from '../hooks/useITMasterData';
import { useTickets } from '../hooks/useTickets';
import { Ticket } from '../types';
import { getBasePath } from '@/utils/config';

interface SharedRequestsPageProps {
    targetDepartment: string;
    createPath: string;
}

// Helper tạo khoảng thời gian Hành chính (07:00 - 17:00 ngày hôm nay)
const getOfficeHoursRange = (): [Dayjs, Dayjs] => {
    const start = dayjs().hour(7).minute(0).second(0).millisecond(0);
    const end = dayjs().hour(17).minute(0).second(0).millisecond(0);
    return [start, end];
};

// Helper tạo khoảng thời gian Ca trực 24h Bệnh viện (07:00 sáng -> 07:00 sáng hôm sau)
const getHospitalDutyRange = (): [Dayjs, Dayjs] => {
    const now = dayjs();
    let start: Dayjs;
    let end: Dayjs;
    if (now.hour() < 7) {
        start = now.subtract(1, 'day').hour(7).minute(0).second(0).millisecond(0);
        end = now.hour(7).minute(0).second(0).millisecond(0);
    } else {
        start = now.hour(7).minute(0).second(0).millisecond(0);
        end = now.add(1, 'day').hour(7).minute(0).second(0).millisecond(0);
    }
    return [start, end];
};

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
    const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(getOfficeHoursRange);
    const [togglingAvailability, setTogglingAvailability] = useState(false);
    const [viewMode, setViewMode] = useState<'AUTO' | 'CARD' | 'TABLE'>('AUTO');
    const [onlyUnread, setOnlyUnread] = useState(false);
    const [selectedStaffFilter, setSelectedStaffFilter] = useState<string | null>(null);

    // Xác định preset thời gian đang chọn
    const isOfficeHoursSelected = useMemo(() => {
        if (!dateRange || !dateRange[0] || !dateRange[1]) return false;
        const now = dayjs();
        return dateRange[0].isSame(now, 'day') && 
               dateRange[0].hour() === 7 && dateRange[0].minute() === 0 &&
               dateRange[1].isSame(now, 'day') && 
               dateRange[1].hour() === 17 && dateRange[1].minute() === 0;
    }, [dateRange]);

    const isDutyShiftSelected = useMemo(() => {
        if (!dateRange || !dateRange[0] || !dateRange[1]) return false;
        const duty = getHospitalDutyRange();
        return dateRange[0].isSame(duty[0], 'minute') && dateRange[1].isSame(duty[1], 'minute');
    }, [dateRange]);

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
        onNavigateToMyTickets: handleNavigateToMyTickets,
        onOpenChat: (ticket: Ticket) => {
            setSelectedTicket(ticket);
            setIsChatVisible(true);
        }
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

        // Lọc theo khoảng ngày giờ (mặc định hôm nay theo giờ hành chính, hoặc khoảng được chọn)
        if (dateRange && (dateRange[0] || dateRange[1])) {
            const start = dateRange[0] ? dateRange[0].startOf('minute') : null;
            const end = dateRange[1] ? dateRange[1].endOf('minute') : null;
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

        if (selectedStaffFilter) {
            result = result.filter(t => t.assigneeId === selectedStaffFilter || t.transferToId === selectedStaffFilter);
        }

        return result;
    }, [tickets, filterMode, isAdmin, user, dateRange, selectedStaffFilter]);

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

        // Lọc theo khoảng ngày giờ
        if (dateRange && (dateRange[0] || dateRange[1])) {
            const start = dateRange[0] ? dateRange[0].startOf('minute') : null;
            const end = dateRange[1] ? dateRange[1].endOf('minute') : null;
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

    const unreadTicketsCount = useMemo(() => {
        return baseTickets.filter(t => (t.unreadMessageCount || 0) > 0).length;
    }, [baseTickets]);

    const filteredTickets = useMemo(() => {
        let result = baseTickets;
        if (statusFilter !== 'ALL') {
            result = result.filter(t => t.status === statusFilter);
        }
        if (onlyUnread) {
            result = result.filter(t => (t.unreadMessageCount || 0) > 0);
        }
        return result;
    }, [baseTickets, statusFilter, onlyUnread]);

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
        <div className="w-full max-w-full sm:max-w-[98%] mx-auto px-3 sm:px-[30px] py-3 sm:py-6 space-y-3 sm:space-y-6 overflow-x-hidden">
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

            {/* Trạng thái nhân viên hiện tại của phòng CNTT (trừ lãnh đạo phòng) */}
            <DepartmentStaffStatusStrip
                targetDepartment={targetDepartment}
                tickets={tickets}
                selectedStaffId={selectedStaffFilter}
                onSelectStaff={(staffId) => setSelectedStaffFilter(staffId)}
                user={user}
                allowedRoles={['ADMIN', targetDepartment]}
                dateRange={dateRange}
            />

            {/* Thanh bộ lọc: Tối ưu responsive đầy đủ cho cả Mobile và Desktop */}
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-2.5 w-full">
                {/* 1. Tabs phân loại Segmented */}
                {isAdmin && (
                    <div className="w-full sm:w-auto flex items-center bg-white p-1 sm:p-1.5 rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
                        <Segmented 
                            block
                            className="w-full sm:w-auto"
                            options={[
                                {
                                    label: (
                                        <div className="flex items-center justify-center gap-1 sm:gap-1.5 px-0.5 sm:px-1 py-0.5 whitespace-nowrap">
                                            <span className="hidden sm:inline">Tất cả Yêu cầu</span>
                                            <span className="sm:hidden font-medium text-xs">Tất cả</span>
                                            <span className="text-[11px] sm:text-xs px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold">
                                                {filterModeCounts.ALL}
                                            </span>
                                        </div>
                                    ),
                                    value: 'ALL'
                                },
                                {
                                    label: (
                                        <div className="flex items-center justify-center gap-1 sm:gap-1.5 px-0.5 sm:px-1 py-0.5 whitespace-nowrap">
                                            <span className="hidden sm:inline">Việc của tôi</span>
                                            <span className="sm:hidden font-medium text-xs">Của tôi</span>
                                            <span className={`text-[11px] sm:text-xs px-1.5 py-0.2 rounded-full font-semibold ${filterModeCounts.MINE > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {filterModeCounts.MINE}
                                            </span>
                                        </div>
                                    ),
                                    value: 'MINE'
                                },
                                ...(assignmentMode !== 'C' ? [{
                                    label: (
                                        <div className="flex items-center justify-center gap-1 sm:gap-1.5 px-0.5 sm:px-1 py-0.5 whitespace-nowrap">
                                            <span className="hidden sm:inline">Chờ nhận việc (Trống)</span>
                                            <span className="sm:hidden font-medium text-xs">Chờ nhận</span>
                                            <span className={`text-[11px] sm:text-xs px-1.5 py-0.2 rounded-full font-semibold ${filterModeCounts.UNASSIGNED > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
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

                {/* 2. Hộp chọn Trạng thái & Nút lọc Tin chưa đọc */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Hộp chọn Trạng thái xử lý (Select) */}
                    <div className="flex-1 min-w-0 sm:flex-initial flex items-center bg-white p-1 sm:p-1.5 rounded-xl border border-slate-100 shadow-sm">
                        <Select
                            value={statusFilter}
                            onChange={(val) => setStatusFilter(val)}
                            className="w-full sm:w-[215px]"
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

                    {/* Nút lọc Tin chưa đọc */}
                    <Button
                        type={onlyUnread ? 'primary' : 'default'}
                        onClick={() => setOnlyUnread(!onlyUnread)}
                        className={`rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-sm shrink-0 px-2.5 sm:px-3 h-[38px] ${
                            onlyUnread 
                                ? 'bg-amber-600 hover:bg-amber-500 border-amber-600 text-white' 
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                        title="Bấm để chỉ lọc các yêu cầu có tin nhắn thảo luận chưa đọc"
                    >
                        <MessageOutlined className={onlyUnread ? 'text-white' : 'text-amber-500'} />
                        <span className="whitespace-nowrap">Tin chưa đọc</span>
                        <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                            unreadTicketsCount > 0 
                                ? onlyUnread ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-700' 
                                : 'bg-slate-100 text-slate-500'
                        }`}>
                            {unreadTicketsCount}
                        </span>
                    </Button>
                </div>

                {/* 3. Bộ lọc khoảng ngày + Nút bấm chọn chế độ hiển thị: Tối ưu 2 tầng trên Mobile, 1 hàng trên Desktop */}
                <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2">
                    {/* Hộp chứa RangePicker + Các nút preset */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 sm:gap-1.5 bg-white p-1 sm:p-1.5 rounded-xl border border-slate-100 shadow-sm w-full sm:w-auto">
                        {/* Hàng 1 (Mobile) / Khối RangePicker: Co giãn full width trên mobile, 330px trên desktop */}
                        <div className="flex items-center gap-1 w-full sm:w-auto">
                            <Tooltip title="Chọn khoảng ngày giờ để lọc yêu cầu (Bấm 'x' hoặc nút 'Tất cả' để xem toàn bộ lịch sử)">
                                <DatePicker.RangePicker 
                                    value={dateRange}
                                    onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
                                    showTime={{ format: 'HH:mm' }}
                                    format="DD/MM/YYYY HH:mm"
                                    allowClear
                                    placeholder={['Từ thời gian', 'Đến thời gian']}
                                    className="rounded-lg text-xs font-medium flex-1 min-w-0 sm:w-[330px]"
                                />
                            </Tooltip>
                            {/* Nút Chế độ hiển thị: Trên Mobile đặt cạnh RangePicker ở Hàng 1 */}
                            <div className="sm:hidden shrink-0">
                                <Dropdown
                                    menu={{
                                        items: [
                                            {
                                                key: 'AUTO',
                                                icon: <DesktopOutlined />,
                                                label: (
                                                    <div className="flex items-center justify-between gap-4 py-0.5">
                                                        <span>Tự động theo thiết bị</span>
                                                        {viewMode === 'AUTO' && <span className="text-blue-600 text-xs font-bold">✓</span>}
                                                    </div>
                                                )
                                            },
                                            {
                                                key: 'CARD',
                                                icon: <AppstoreOutlined />,
                                                label: (
                                                    <div className="flex items-center justify-between gap-4 py-0.5">
                                                        <span>Dạng Thẻ (Card View)</span>
                                                        {viewMode === 'CARD' && <span className="text-blue-600 text-xs font-bold">✓</span>}
                                                    </div>
                                                )
                                            },
                                            {
                                                key: 'TABLE',
                                                icon: <TableOutlined />,
                                                label: (
                                                    <div className="flex items-center justify-between gap-4 py-0.5">
                                                        <span>Dạng Bảng (Table View)</span>
                                                        {viewMode === 'TABLE' && <span className="text-blue-600 text-xs font-bold">✓</span>}
                                                    </div>
                                                )
                                            }
                                        ],
                                        selectedKeys: [viewMode],
                                        onClick: ({ key }) => setViewMode(key as any),
                                    }}
                                    trigger={['click']}
                                    placement="bottomRight"
                                >
                                    <Tooltip title={`Chế độ hiển thị: ${viewMode === 'CARD' ? 'Dạng Thẻ' : viewMode === 'TABLE' ? 'Dạng Bảng' : 'Tự động theo thiết bị'}`}>
                                        <Button 
                                            size="middle"
                                            className="bg-white hover:bg-slate-50 border-slate-200 rounded-xl px-2 text-xs text-slate-600 hover:text-blue-600 shadow-sm flex items-center justify-center gap-1 shrink-0 h-[32px]"
                                        >
                                            {viewMode === 'CARD' ? <AppstoreOutlined className="text-blue-600 text-sm" /> : viewMode === 'TABLE' ? <TableOutlined className="text-blue-600 text-sm" /> : <DesktopOutlined className="text-slate-600 text-sm" />}
                                            <DownOutlined className="text-[9px] text-slate-400" />
                                        </Button>
                                    </Tooltip>
                                </Dropdown>
                            </div>
                        </div>

                        {/* Hàng 2 (Mobile) / Liền kề (Desktop): Các nút chọn nhanh */}
                        <div className="flex items-center gap-1 sm:gap-1.5 w-full sm:w-auto">
                            <Button 
                                size="small"
                                type={isOfficeHoursSelected ? 'primary' : 'default'}
                                onClick={() => setDateRange(getOfficeHoursRange())}
                                className={`text-xs rounded-lg px-1.5 sm:px-2 flex-1 sm:flex-initial text-center ${isOfficeHoursSelected ? 'bg-blue-600 font-semibold text-white' : 'text-slate-600 hover:text-blue-600'}`}
                            >
                                Ngày hiện tại
                            </Button>
                            <Button 
                                size="small"
                                type={isDutyShiftSelected ? 'primary' : 'default'}
                                onClick={() => setDateRange(getHospitalDutyRange())}
                                className={`text-xs rounded-lg px-1.5 sm:px-2 flex-1 sm:flex-initial text-center ${isDutyShiftSelected ? 'bg-indigo-600 font-semibold text-white' : 'text-slate-600 hover:text-indigo-600'}`}
                            >
                                Ca trực 24h
                            </Button>
                            <Button 
                                size="small"
                                type={!dateRange || (!dateRange[0] && !dateRange[1]) ? 'primary' : 'default'}
                                onClick={() => setDateRange(null)}
                                className={`text-xs rounded-lg px-1.5 sm:px-2 flex-1 sm:flex-initial text-center ${!dateRange || (!dateRange[0] && !dateRange[1]) ? 'bg-blue-600 font-semibold text-white' : 'text-slate-600 hover:text-blue-600'}`}
                            >
                                Tất cả
                            </Button>
                        </div>
                    </div>

                    {/* Nút Chế độ hiển thị: Trên Desktop đặt ở cuối hàng ngang */}
                    <div className="hidden sm:block shrink-0">
                        <Dropdown
                            menu={{
                                items: [
                                    {
                                        key: 'AUTO',
                                        icon: <DesktopOutlined />,
                                        label: (
                                            <div className="flex items-center justify-between gap-4 py-0.5">
                                                <span>Tự động theo thiết bị</span>
                                                {viewMode === 'AUTO' && <span className="text-blue-600 text-xs font-bold">✓</span>}
                                            </div>
                                        )
                                    },
                                    {
                                        key: 'CARD',
                                        icon: <AppstoreOutlined />,
                                        label: (
                                            <div className="flex items-center justify-between gap-4 py-0.5">
                                                <span>Dạng Thẻ (Card View)</span>
                                                {viewMode === 'CARD' && <span className="text-blue-600 text-xs font-bold">✓</span>}
                                            </div>
                                        )
                                    },
                                    {
                                        key: 'TABLE',
                                        icon: <TableOutlined />,
                                        label: (
                                            <div className="flex items-center justify-between gap-4 py-0.5">
                                                <span>Dạng Bảng (Table View)</span>
                                                {viewMode === 'TABLE' && <span className="text-blue-600 text-xs font-bold">✓</span>}
                                            </div>
                                        )
                                    }
                                ],
                                selectedKeys: [viewMode],
                                onClick: ({ key }) => setViewMode(key as any),
                            }}
                            trigger={['click']}
                            placement="bottomRight"
                        >
                            <Tooltip title={`Chế độ hiển thị: ${viewMode === 'CARD' ? 'Dạng Thẻ' : viewMode === 'TABLE' ? 'Dạng Bảng' : 'Tự động theo thiết bị'}`}>
                                <Button 
                                    size="middle"
                                    className="bg-white hover:bg-slate-50 border-slate-200 rounded-xl px-2 text-xs text-slate-600 hover:text-blue-600 shadow-sm flex items-center justify-center gap-1 shrink-0 h-[32px]"
                                >
                                    {viewMode === 'CARD' ? <AppstoreOutlined className="text-blue-600 text-sm" /> : viewMode === 'TABLE' ? <TableOutlined className="text-blue-600 text-sm" /> : <DesktopOutlined className="text-slate-600 text-sm" />}
                                    <DownOutlined className="text-[9px] text-slate-400" />
                                </Button>
                            </Tooltip>
                        </Dropdown>
                    </div>
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
                    viewMode={viewMode}
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
