'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Avatar, Tooltip, Tag, Spin, Button, Collapse } from 'antd';
import { 
    TeamOutlined, 
    ReloadOutlined, 
    AimOutlined, 
    CheckCircleFilled,
    ClockCircleFilled,
    StopFilled
} from '@ant-design/icons';
import { formatAvatarUrl } from '@/utils/avatar';
import { getBasePath } from '@/utils/config';
import { Ticket } from '../types';
import dayjs, { Dayjs } from 'dayjs';

interface StaffStatusItem {
    id: string;
    username: string;
    name: string;
    role: string;
    isAvailable: boolean;
    dutyOrder: number;
    autoAssignDisabled?: boolean;
    focusReason?: string | null;
    isLeader: boolean;
    phone?: string | null;
    chuc_vu?: string;
    avatar?: string | null;
}

interface DepartmentStaffStatusStripProps {
    targetDepartment?: string;
    tickets?: Ticket[];
    selectedStaffId?: string | null;
    onSelectStaff?: (staffId: string | null) => void;
    user?: any;
    allowedRoles?: string[];
    dateRange?: [Dayjs | null, Dayjs | null] | null;
}

export function DepartmentStaffStatusStrip({
    targetDepartment = 'CNTT',
    tickets = [],
    selectedStaffId = null,
    onSelectStaff,
    user,
    allowedRoles = ['ADMIN', 'CNTT'],
    dateRange
}: DepartmentStaffStatusStripProps) {
    const [staffList, setStaffList] = useState<StaffStatusItem[]>([]);
    const [loading, setLoading] = useState(false);
    const isMountedRef = useRef(true);

    // Kiểm tra quyền hạn theo Role: Chỉ ADMIN, targetDepartment hoặc các role được cấu hình mới thấy
    const isAllowed = useMemo(() => {
        if (!user) return false;
        if (user.role === 'ADMIN') return true;
        if (user.role === targetDepartment) return true;
        if (allowedRoles && allowedRoles.includes(user.role)) return true;
        // Kiểm tra nhân viên thuộc phòng ban tương ứng
        if (targetDepartment === 'CNTT' && user.ma_khoa === 'KP046') return true;
        if (targetDepartment === 'VTYT' && user.ma_khoa === 'KP038') return true;
        if (targetDepartment === 'HCQT' && user.ma_khoa === 'KP040') return true;
        return false;
    }, [user, targetDepartment, allowedRoles]);

    // Trạng thái đóng/mở Accordion (ghi nhớ vào localStorage)
    const [activeKeys, setActiveKeys] = useState<string[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('it_staff_status_expanded');
            if (saved !== null) {
                return saved === 'true' ? ['staff_status_panel'] : [];
            }
        }
        return ['staff_status_panel']; // Mặc định mở
    });

    const handleCollapseChange = (keys: string | string[]) => {
        const nextKeys = Array.isArray(keys) ? keys : [keys];
        setActiveKeys(nextKeys);
        if (typeof window !== 'undefined') {
            localStorage.setItem('it_staff_status_expanded', String(nextKeys.includes('staff_status_panel')));
        }
    };

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const fetchStaffStatus = useCallback(async () => {
        if (!isAllowed) return;
        try {
            setLoading(true);
            const res = await fetch(`${getBasePath()}/api/error-management/duty-roster?targetDepartment=${targetDepartment}`);
            if (res.ok && isMountedRef.current) {
                const data = await res.json();
                if (isMountedRef.current) {
                    setStaffList(data);
                }
            }
        } catch (error) {
            console.warn('Lỗi tải trạng thái nhân sự:', error);
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [targetDepartment, isAllowed]);

    useEffect(() => {
        fetchStaffStatus();
    }, [fetchStaffStatus]);

    // Tính số ticket đang xử lý cho từng nhân sự (đồng bộ theo dateRange nếu có lọc)
    const staffTicketStats = useMemo(() => {
        const map = new Map<string, { active: number; done: number; totalPending: number }>();
        const start = dateRange && dateRange[0] ? dateRange[0] : null;
        const end = dateRange && dateRange[1] ? dateRange[1] : null;

        tickets.forEach(t => {
            const assignee = t.assigneeId || t.transferToId;
            if (!assignee) return;

            const current = map.get(assignee) || { active: 0, done: 0, totalPending: 0 };
            const isResolved = ['RESOLVED', 'CLOSED'].includes(t.status);

            // Tính tổng tồn đọng chưa hoàn thành từ trước đến nay
            if (!isResolved) {
                current.totalPending += 1;
            }

            // Kiểm tra xem ticket có phát sinh trong khoảng thời gian dateRange được chọn không
            let isInPeriod = true;
            if (t.createdAt && (start || end)) {
                const created = dayjs(t.createdAt);
                if (start && end) {
                    isInPeriod = (created.isAfter(start) || created.isSame(start)) && (created.isBefore(end) || created.isSame(end));
                } else if (start) {
                    isInPeriod = created.isAfter(start) || created.isSame(start);
                } else if (end) {
                    isInPeriod = created.isBefore(end) || created.isSame(end);
                }
            }

            if (isInPeriod) {
                if (isResolved) {
                    current.done += 1;
                } else {
                    current.active += 1;
                }
            }
            map.set(assignee, current);
        });
        return map;
    }, [tickets, dateRange]);

    // Danh sách nhân sự hiển thị thông minh:
    // 1. Kỹ thuật viên (!s.isLeader): Luôn hiển thị
    // 2. Lãnh đạo phòng (s.isLeader): TỰ ĐỘNG HIỂN THỊ KHI BẬT NHẬN VIỆC (isAvailable === true) hoặc đang có ticket phụ trách
    const displayStaff = useMemo(() => {
        return staffList
            .filter(s => {
                if (!s.isLeader) return true;
                const activeCount = staffTicketStats.get(s.id)?.active || 0;
                // Lãnh đạo chỉ hiển thị nếu đang BẬT nhận việc hoặc đang có ticket đang xử lý
                return s.isAvailable || activeCount > 0;
            })
            .sort((a, b) => {
                // Kỹ thuật viên sắp xếp theo dutyOrder, lãnh đạo trực xếp kế tiếp
                if (a.isLeader !== b.isLeader) {
                    return a.isLeader ? 1 : -1;
                }
                return (a.dutyOrder || 99) - (b.dutyOrder || 99);
            });
    }, [staffList, staffTicketStats]);

    // Thống kê số lượng theo trạng thái
    const stats = useMemo(() => {
        const total = displayStaff.length;
        const ready = displayStaff.filter(s => s.isAvailable && !s.autoAssignDisabled).length;
        const focus = displayStaff.filter(s => s.isAvailable && s.autoAssignDisabled).length;
        const off = displayStaff.filter(s => !s.isAvailable).length;
        const leadersActive = displayStaff.filter(s => s.isLeader).length;
        return { total, ready, focus, off, leadersActive };
    }, [displayStaff]);

    const getInitials = (text?: string) => {
        if (!text) return 'U';
        const clean = text.trim();
        if (/^\d+$/.test(clean)) return 'U';
        const words = clean.split(/\s+/).filter(Boolean);
        if (words.length === 0) return 'U';
        const lastName = words[words.length - 1];
        return lastName.charAt(0).toUpperCase();
    };

    // Nếu không có quyền xem hoặc không có nhân viên: Không render
    if (!isAllowed) {
        return null;
    }

    if (displayStaff.length === 0 && !loading) {
        return null;
    }

    return (
        <div className="w-full transition-all">
            <Collapse
                activeKey={activeKeys}
                onChange={handleCollapseChange}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden [&_.ant-collapse-header]:p-3 sm:[&_.ant-collapse-header]:p-3.5 [&_.ant-collapse-content-box]:p-3 sm:[&_.ant-collapse-content-box]:p-4 [&_.ant-collapse-content-box]:pt-0"
                bordered={false}
                items={[
                    {
                        key: 'staff_status_panel',
                        label: (
                            <div className="flex flex-wrap items-center justify-between gap-2 w-full pr-1 sm:pr-2 select-none">
                                {/* Bên trái: Icon & Tiêu đề */}
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                                        <TeamOutlined />
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-slate-800 text-sm sm:text-base">
                                            Trạng thái nhân viên {targetDepartment}
                                        </span>
                                        <span className="text-xs text-slate-400 hidden sm:inline font-normal">
                                            ({displayStaff.length} nhân sự{stats.leadersActive > 0 ? `, gồm ${stats.leadersActive} lãnh đạo tham gia trực` : ''})
                                        </span>
                                    </div>
                                </div>

                                {/* Bên phải: Thống kê nhanh & Nút refresh */}
                                <div 
                                    className="flex items-center gap-2" 
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <Tag color="success" className="m-0 rounded-full text-xs font-semibold px-2 py-0.5 border-none shadow-xs">
                                            <CheckCircleFilled className="mr-1 text-[11px]" />
                                            {stats.ready} Sẵn sàng
                                        </Tag>

                                        {stats.focus > 0 && (
                                            <Tag color="warning" className="m-0 rounded-full text-xs font-semibold px-2 py-0.5 border-none shadow-xs">
                                                <ClockCircleFilled className="mr-1 text-[11px]" />
                                                {stats.focus} Tập trung
                                            </Tag>
                                        )}

                                        {stats.off > 0 && (
                                            <Tag color="default" className="m-0 rounded-full text-xs font-semibold px-2 py-0.5 border-none text-slate-500 shadow-xs">
                                                <StopFilled className="mr-1 text-[11px] text-slate-400" />
                                                {stats.off} Tắt nhận việc
                                            </Tag>
                                        )}
                                    </div>

                                    <Tooltip title="Làm mới trạng thái">
                                        <Button 
                                            type="text" 
                                            size="small" 
                                            icon={<ReloadOutlined className={loading ? 'animate-spin text-blue-600' : 'text-slate-400 hover:text-blue-600'} />} 
                                            onClick={fetchStaffStatus}
                                            className="rounded-lg hover:bg-slate-100"
                                        />
                                    </Tooltip>
                                </div>
                            </div>
                        ),
                        children: (
                            <div>
                                {loading && displayStaff.length === 0 ? (
                                    <div className="flex items-center justify-center py-6 text-slate-400 text-xs">
                                        <Spin size="small" className="mr-2" /> Đang cập nhật trạng thái nhân viên...
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 pt-2">
                                        {displayStaff.map(staff => {
                                            const ticketStat = staffTicketStats.get(staff.id) || { active: 0, done: 0 };
                                            const isFocus = staff.isAvailable && staff.autoAssignDisabled;
                                            const isReady = staff.isAvailable && !staff.autoAssignDisabled;
                                            const isOff = !staff.isAvailable;
                                            const isSelected = selectedStaffId === staff.id;

                                            // Xác định trạng thái hiển thị
                                            let statusBadgeColor = 'bg-slate-400';
                                            let statusText = 'Tắt nhận việc';
                                            let statusTagColor = 'default';

                                            if (isReady) {
                                                statusBadgeColor = 'bg-emerald-500 ring-2 ring-emerald-200';
                                                statusText = 'Sẵn sàng';
                                                statusTagColor = 'success';
                                            } else if (isFocus) {
                                                statusBadgeColor = 'bg-amber-500 ring-2 ring-amber-200';
                                                statusText = 'Tập trung';
                                                statusTagColor = 'warning';
                                            }

                                            return (
                                                <div
                                                    key={staff.id}
                                                    onClick={() => {
                                                        if (onSelectStaff) {
                                                            onSelectStaff(isSelected ? null : staff.id);
                                                        }
                                                    }}
                                                    className={`relative flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl border transition-all duration-200 cursor-pointer select-none ${
                                                        isSelected
                                                            ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-300 shadow-sm'
                                                            : 'bg-slate-50/60 hover:bg-white border-slate-200/70 hover:border-blue-200 hover:shadow-xs'
                                                    }`}
                                                >
                                                    {/* Avatar & Status Dot */}
                                                    <div className="relative shrink-0">
                                                        <div className="w-10 h-10 rounded-full p-0.5 bg-white shadow-xs ring-1 ring-slate-200 flex items-center justify-center overflow-hidden">
                                                            {staff.avatar ? (
                                                                <img
                                                                    src={formatAvatarUrl(staff.avatar)}
                                                                    alt={staff.name}
                                                                    className="w-full h-full object-contain p-0.5 bg-white rounded-full"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLElement).style.display = 'none';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <Avatar
                                                                    size={36}
                                                                    className={`text-white font-bold text-sm flex items-center justify-center ${
                                                                        staff.isLeader 
                                                                            ? 'bg-gradient-to-br from-purple-600 to-indigo-700' 
                                                                            : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                                                                    }`}
                                                                >
                                                                    {getInitials(staff.name)}
                                                                </Avatar>
                                                            )}
                                                        </div>

                                                        {/* Chấm tròn trạng thái */}
                                                        <span
                                                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${statusBadgeColor} ${
                                                                isReady ? 'animate-pulse' : ''
                                                            }`}
                                                        />
                                                    </div>

                                                    {/* Thông tin nhân viên */}
                                                    <div className="min-w-0 flex-1 space-y-0.5">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <div 
                                                                className="font-bold text-slate-800 text-xs sm:text-sm truncate" 
                                                                title={staff.name}
                                                            >
                                                                {staff.name}
                                                            </div>
                                                            {staff.isLeader && (
                                                                <Tag color="purple" className="m-0 text-[10px] px-1 py-0 border-none font-medium shrink-0">
                                                                    {staff.chuc_vu || 'Lãnh đạo'}
                                                                </Tag>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {isFocus ? (
                                                                <Tooltip title={`Chế độ tập trung: ${staff.focusReason || 'Nhiệm vụ chuyên sâu'}`}>
                                                                    <Tag 
                                                                        color={statusTagColor} 
                                                                        className="m-0 text-[10px] sm:text-[11px] px-1 py-0 border-none font-medium flex items-center gap-0.5 cursor-help"
                                                                    >
                                                                        <AimOutlined className="text-[10px]" /> Tập trung
                                                                    </Tag>
                                                                </Tooltip>
                                                            ) : (
                                                                <Tag 
                                                                    color={statusTagColor} 
                                                                    className="m-0 text-[10px] sm:text-[11px] px-1 py-0 border-none font-medium"
                                                                >
                                                                    {statusText}
                                                                </Tag>
                                                            )}

                                                            {/* Số lượng ticket đang xử lý */}
                                                            {ticketStat.active > 0 ? (
                                                                <Tooltip title={
                                                                    ticketStat.totalPending > ticketStat.active 
                                                                        ? `Đang xử lý ${ticketStat.active} việc trong khung giờ này (Tổng tồn đọng chưa xong: ${ticketStat.totalPending} việc)` 
                                                                        : `Đang xử lý ${ticketStat.active} yêu cầu`
                                                                }>
                                                                    <span 
                                                                        className="text-[10px] sm:text-[11px] font-bold text-blue-700 bg-blue-100/90 px-1.5 py-0.2 rounded-md cursor-help"
                                                                    >
                                                                        {ticketStat.active} việc
                                                                    </span>
                                                                </Tooltip>
                                                            ) : (
                                                                <Tooltip title={ticketStat.totalPending > 0 ? `Không có việc trong khung giờ này (Tổng tồn đọng cũ: ${ticketStat.totalPending} việc)` : 'Không có việc'}>
                                                                    <span className="text-[10px] text-slate-400 font-normal cursor-help">
                                                                        0 việc
                                                                    </span>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    }
                ]}
            />
        </div>
    );
}
