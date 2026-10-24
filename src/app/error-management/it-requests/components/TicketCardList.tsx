'use client';

import React, { useState } from 'react';
import { Button, Tag, Badge, Tooltip, Popconfirm, Modal, Input, message, Pagination } from 'antd';
import { 
    CheckCircleOutlined, 
    LoadingOutlined, 
    MessageOutlined, 
    DeleteOutlined, 
    EditOutlined, 
    FileTextOutlined, 
    PhoneOutlined, 
    ClockCircleOutlined, 
    UserOutlined, 
    ShopOutlined, 
    LinkOutlined, 
    ShareAltOutlined, 
    PauseCircleOutlined, 
    PlayCircleOutlined,
    PaperClipOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
dayjs.extend(relativeTime);
dayjs.locale('vi');

import { Ticket } from '../types';
import { TicketImage } from '@/components/shared/TicketImage';
import { getBasePath } from '@/utils/config';
import { copyTicketShareLink, copyTicketZaloMessage } from '../utils/shareUtils';

interface TicketCardListProps {
    tickets: Ticket[];
    loading: boolean;
    departments: any[];
    user: any;
    hasPermission: (menuCode: string, action?: 'VIEW' | 'EDIT' | 'DELETE') => boolean;
    assignmentMode: string;
    onFetchTickets: () => void;
    onDeleteTicket: (id: string) => void;
    onReceiveTicket?: (id: string) => Promise<void>;
    onPauseTicket?: (ticket: Ticket, reason?: string) => Promise<void> | void;
    onResumeTicket?: (ticket: Ticket) => Promise<void> | void;
    onProcessClick: (ticket: Ticket) => void;
    onEditClick?: (ticket: Ticket) => void;
    onChatClick?: (ticket: Ticket) => void;
    targetDepartment?: string;
    currentPage: number;
    pageSize: number;
    onPageChange: (page: number, size: number) => void;
}

export const TicketCardList: React.FC<TicketCardListProps> = ({
    tickets,
    loading,
    departments,
    user,
    hasPermission,
    assignmentMode,
    onFetchTickets,
    onDeleteTicket,
    onReceiveTicket,
    onPauseTicket,
    onResumeTicket,
    onProcessClick,
    onEditClick,
    onChatClick,
    targetDepartment = 'CNTT',
    currentPage,
    pageSize,
    onPageChange
}) => {
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [togglingOnSiteId, setTogglingOnSiteId] = useState<string | null>(null);

    const handleToggleOnSite = async (ticket: Ticket) => {
        const nextState = !ticket.isFocusTask;
        setTogglingOnSiteId(ticket.id);
        try {
            const res = await fetch(`${getBasePath()}/api/error-management/it-requests`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: ticket.id,
                    isFocusTask: nextState
                })
            });
            if (res.ok) {
                message.success(nextState 
                    ? 'Đã bật chế độ Đi khoa phòng (Tạm ngưng nhận việc tự động)!' 
                    : 'Đã tắt chế độ Đi khoa phòng (Sẵn sàng nhận việc tự động)!'
                );
                onFetchTickets();
            } else {
                message.error('Lỗi khi cập nhật trạng thái');
            }
        } catch (err) {
            message.error('Lỗi kết nối khi cập nhật');
        } finally {
            setTogglingOnSiteId(null);
        }
    };

    const handleQuickResolve = async (id: string) => {
        setResolvingId(id);
        try {
            const res = await fetch(`${getBasePath()}/api/error-management/it-requests`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    status: 'RESOLVED'
                })
            });
            if (res.ok) {
                message.success('Đã chuyển trạng thái Hoàn thành!');
                onFetchTickets();
            } else {
                const data = await res.json();
                message.error(data.error || 'Lỗi khi cập nhật');
            }
        } catch (err) {
            message.error('Lỗi kết nối khi cập nhật');
        } finally {
            setResolvingId(null);
        }
    };

    const handleReceiveTicket = async (id: string) => {
        if (onReceiveTicket) {
            await onReceiveTicket(id);
            return;
        }
        try {
            const res = await fetch(`${getBasePath()}/api/error-management/it-requests`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    assigneeId: user?.id,
                    status: 'IN_PROGRESS'
                })
            });
            if (res.ok) {
                message.success('Đã nhận việc!');
                onFetchTickets();
            }
        } catch (err) {
            message.error('Lỗi nhận việc');
        }
    };

    const handleTransferResponse = async (id: string, action: 'ACCEPT_TRANSFER' | 'REJECT_TRANSFER') => {
        const res = await fetch(`${getBasePath()}/api/error-management/it-requests`, {
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action })
        });
        if (res.ok) {
            message.success(action === 'ACCEPT_TRANSFER' ? 'Đã nhận chuyển giao!' : 'Đã từ chối chuyển giao');
            onFetchTickets();
        }
    };

    // Phân trang danh sách thẻ
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedTickets = tickets.slice(startIndex, startIndex + pageSize);

    if (tickets.length === 0) {
        return (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-100 shadow-xs">
                <div className="text-4xl mb-2">📋</div>
                <div className="font-semibold text-slate-700">Không có yêu cầu nào phù hợp</div>
                <div className="text-xs text-slate-400 mt-1">Hãy thử thay đổi khoảng ngày hoặc bộ lọc trạng thái</div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
                {paginatedTickets.map((ticket, index) => {
                    const dept = departments.find(d => d.ma_khoa === ticket.ma_khoa);
                    const isMyTask = Boolean(ticket.assigneeId) && ticket.assigneeId === user?.id;
                    const canReceive = hasPermission('MENU_ERROR_REQUESTS', 'EDIT') && (
                        (assignmentMode === 'A' && !ticket.assigneeId) ||
                        (isMyTask && ticket.status === 'PENDING')
                    );
                    const isTransferringToMe = ticket.status === 'TRANSFERRING' && ticket.transferToId === user?.id;
                    const canQuickResolve = ticket.status !== 'RESOLVED' && !canReceive && isMyTask;

                    // Gom ảnh đính kèm
                    const attachmentKeys = ['Hình ảnh đính kèm', 'Tệp đính kèm', 'File đính kèm', 'Tài liệu đính kèm', 'tệp đính kèm', 'hình ảnh đính kèm'];
                    const rawAttachments: string[] = [];
                    if (ticket.dynamicFields && typeof ticket.dynamicFields === 'object') {
                        attachmentKeys.forEach(k => {
                            const val = ticket.dynamicFields[k];
                            if (Array.isArray(val)) {
                                rawAttachments.push(...val);
                            } else if (typeof val === 'string' && val.startsWith('/uploads/')) {
                                rawAttachments.push(val);
                            }
                        });
                    }
                    const attachments = Array.from(new Set(rawAttachments)).filter(Boolean);

                    // Trích xuất số điện thoại
                    const phone = ticket.dynamicFields?.['SĐT'] || ticket.dynamicFields?.['Số điện thoại'] || '';

                    // Màu sắc viền theo trạng thái
                    let borderColor = 'border-slate-200';
                    let statusBadge = <Tag color="default">Chờ xử lý</Tag>;
                    
                    if (ticket.status === 'PENDING') {
                        borderColor = 'border-amber-300 bg-amber-50/15';
                        statusBadge = <Tag color="warning" className="m-0 font-semibold">Chờ xử lý</Tag>;
                    } else if (ticket.status === 'IN_PROGRESS') {
                        borderColor = 'border-blue-300 bg-blue-50/15';
                        statusBadge = <Tag color="processing" className="m-0 font-semibold">Đang xử lý</Tag>;
                    } else if (ticket.status === 'PAUSED') {
                        borderColor = 'border-purple-300 bg-purple-50/15';
                        statusBadge = <Tag color="purple" className="m-0 font-semibold">⏸️ Tạm dừng</Tag>;
                    } else if (ticket.status === 'WAITING_VENDOR') {
                        borderColor = 'border-orange-300 bg-orange-50/15';
                        statusBadge = <Tag color="orange" className="m-0 font-semibold">🏢 Chờ đối tác</Tag>;
                    } else if (ticket.status === 'TRANSFERRING') {
                        borderColor = 'border-indigo-300 bg-indigo-50/15';
                        statusBadge = <Tag color="cyan" className="m-0 font-semibold">Chuyển giao</Tag>;
                    } else if (ticket.status === 'RESOLVED') {
                        borderColor = 'border-emerald-200 bg-emerald-50/20';
                        statusBadge = <Tag color="success" className="m-0 font-semibold">✓ Hoàn thành</Tag>;
                    }

                    return (
                        <div 
                            key={ticket.id}
                            className={`p-3.5 sm:p-4 rounded-2xl bg-white border ${borderColor} shadow-xs hover:shadow-md transition-all space-y-3 relative`}
                        >
                            {/* HÀNG 1: HEADER THẺ - STT, KHOA PHÒNG & TRẠNG THÁI */}
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-mono text-xs flex items-center justify-center font-bold shrink-0">
                                        {startIndex + index + 1}
                                    </span>
                                    <div className="font-bold text-slate-800 text-sm sm:text-base truncate" title={dept?.ten_khoa || ''}>
                                        🏥 {dept?.ten_khoa || 'Khoa/Phòng'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {ticket.isFocusTask && (
                                        <Tag color="purple" className="m-0 font-bold border-purple-300 text-[10px] px-1.5 py-0.5">
                                            🚶 Đi khoa
                                        </Tag>
                                    )}
                                    {statusBadge}
                                </div>
                            </div>

                            {/* HÀNG 2: TIÊU ĐỀ LỖI & MÃ HỒ SƠ / BỆNH ÁN */}
                            <div>
                                <div className="font-semibold text-slate-900 text-sm sm:text-base leading-snug">
                                    {ticket.ten_loi}
                                </div>
                                
                                {ticket.ma_ba && (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                        <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5 inline-flex items-center gap-1">
                                            📄 Mã BA / LK: {ticket.ma_ba}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* HÀNG 3: THÔNG TIN CHI TIẾT (NGƯỜI BÁO, SĐT, KỸ THUẬT VIÊN) */}
                            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <UserOutlined className="text-slate-400 shrink-0" />
                                    <span className="text-slate-500">Người báo:</span>
                                    <strong className="text-slate-700 truncate">{ticket.nguoi_bao || 'Cán bộ y tế'}</strong>
                                </div>

                                {phone && (
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <PhoneOutlined className="text-red-500 shrink-0" />
                                        <span className="text-slate-500">SĐT:</span>
                                        <a href={`tel:${phone}`} className="text-red-600 font-bold hover:underline">
                                            {phone}
                                        </a>
                                    </div>
                                )}

                                <div className="flex items-center gap-1.5 min-w-0 xs:col-span-2">
                                    <span className="text-slate-500 shrink-0">Kỹ thuật viên:</span>
                                    {ticket.assigneeName ? (
                                        <Tag color="purple" className="m-0 font-medium">
                                            {ticket.assigneeName}
                                        </Tag>
                                    ) : (
                                        <Tag color="default" className="m-0 italic text-slate-400">
                                            Chưa phân công
                                        </Tag>
                                    )}
                                    {ticket.assigneePhone && (
                                        <a href={`tel:${ticket.assigneePhone}`} className="text-[11px] text-slate-500 font-mono hover:text-blue-600">
                                            ({ticket.assigneePhone})
                                        </a>
                                    )}
                                </div>

                                {/* Thông tin đối tác ngoài nếu có */}
                                {ticket.vendorName && (
                                    <div className="xs:col-span-2 flex items-center gap-1.5 text-amber-800 bg-amber-50/90 p-1.5 rounded-lg border border-amber-200 text-xs">
                                        <ShopOutlined className="text-amber-600 shrink-0" />
                                        <span>Gửi đối tác: <strong>{ticket.vendorName}</strong></span>
                                        {ticket.vendorExpectedReturnAt && (
                                            <span className="text-[11px] text-amber-700">
                                                (Hạn: {dayjs(ticket.vendorExpectedReturnAt).format('DD/MM/YYYY')})
                                            </span>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center gap-1 text-[11px] text-slate-400 xs:col-span-2 mt-0.5">
                                    <ClockCircleOutlined className="shrink-0" />
                                    <span>Gửi lúc: {dayjs(ticket.createdAt).format('HH:mm DD/MM/YYYY')} ({dayjs(ticket.createdAt).fromNow()})</span>
                                </div>
                            </div>

                            {/* HÌNH ẢNH ĐÍNH KÈM (NẾU CÓ) */}
                            {attachments.length > 0 && (
                                <div className="pt-1">
                                    <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
                                        <PaperClipOutlined className="text-blue-500" /> Tệp đính kèm ({attachments.length}):
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        {attachments.map((url: string, idx: number) => (
                                            <TicketImage key={idx} url={url} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* HÀNG 4: THANH THAO TÁC HÀNH ĐỘNG DỄ BẤM BẰNG TAY */}
                            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                                    {/* 1. Nhận việc */}
                                    {canReceive && (
                                        <Button 
                                            size="middle" 
                                            type="primary" 
                                            className="bg-green-600 hover:bg-green-500 font-medium text-xs rounded-xl flex-1 xs:flex-initial"
                                            onClick={() => handleReceiveTicket(ticket.id)}
                                        >
                                            Nhận việc
                                        </Button>
                                    )}

                                    {/* 2. Tiếp tục khi đang tạm dừng */}
                                    {ticket.status === 'PAUSED' && isMyTask && (
                                        <Button 
                                            size="middle" 
                                            type="primary" 
                                            className="bg-amber-600 hover:bg-amber-500 font-medium text-xs rounded-xl flex items-center gap-1 flex-1 xs:flex-initial"
                                            onClick={() => onResumeTicket ? onResumeTicket(ticket) : handleReceiveTicket(ticket.id)}
                                        >
                                            <PlayCircleOutlined /> Tiếp tục
                                        </Button>
                                    )}

                                    {/* 3. Tạm dừng khi đang xử lý */}
                                    {ticket.status === 'IN_PROGRESS' && isMyTask && onPauseTicket && (
                                        <Button 
                                            size="middle" 
                                            type="default" 
                                            className="text-amber-700 border-amber-300 hover:bg-amber-50 font-medium text-xs rounded-xl flex items-center gap-1"
                                            onClick={() => {
                                                let reasonText = '';
                                                Modal.confirm({
                                                    title: <span className="text-amber-700 font-bold">⏸️ TẠM DỪNG XỬ LÝ PHIẾU NÀY</span>,
                                                    content: (
                                                        <div className="py-2 space-y-2 text-xs">
                                                            <p>Nhập lý do tạm dừng:</p>
                                                            <Input.TextArea 
                                                                rows={3} 
                                                                placeholder="VD: Đang chờ khoa phòng gửi thêm dữ liệu..." 
                                                                onChange={(e) => { reasonText = e.target.value; }}
                                                            />
                                                        </div>
                                                    ),
                                                    okText: 'Tạm dừng',
                                                    cancelText: 'Hủy bỏ',
                                                    onOk: () => {
                                                        onPauseTicket(ticket, reasonText);
                                                    }
                                                });
                                            }}
                                        >
                                            <PauseCircleOutlined /> Tạm dừng
                                        </Button>
                                    )}

                                    {/* 4. Đi khoa / Về VP */}
                                    {ticket.status === 'IN_PROGRESS' && isMyTask && (
                                        <Button 
                                            size="middle" 
                                            loading={togglingOnSiteId === ticket.id}
                                            type={ticket.isFocusTask ? "primary" : "default"} 
                                            className={ticket.isFocusTask 
                                                ? "!bg-purple-600 hover:!bg-purple-500 font-medium text-xs rounded-xl flex items-center gap-1" 
                                                : "text-purple-700 border-purple-300 hover:bg-purple-50 font-medium text-xs rounded-xl flex items-center gap-1"
                                            }
                                            onClick={() => handleToggleOnSite(ticket)}
                                        >
                                            {ticket.isFocusTask ? '🏢 Về VP' : '🚶 Đi khoa'}
                                        </Button>
                                    )}

                                    {/* Nút Xử lý chính */}
                                    {hasPermission('MENU_ERROR_REQUESTS', 'EDIT') && (user?.role === 'ADMIN' || user?.role === targetDepartment) && (
                                        <Button 
                                            size="middle" 
                                            type="primary" 
                                            className="bg-blue-600 hover:bg-blue-500 font-medium text-xs rounded-xl flex-1 xs:flex-initial"
                                            onClick={() => onProcessClick(ticket)}
                                        >
                                            {ticket.status === 'RESOLVED' ? 'Xem lại' : 'Xử lý'}
                                        </Button>
                                    )}

                                    {/* Nút Hoàn thành nhanh 1-Click */}
                                    {canQuickResolve && (
                                        <button
                                            type="button"
                                            disabled={resolvingId === ticket.id}
                                            onClick={() => handleQuickResolve(ticket.id)}
                                            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-300 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                                            title="Xác nhận hoàn thành yêu cầu này"
                                        >
                                            {resolvingId === ticket.id ? (
                                                <LoadingOutlined className="text-xs animate-spin shrink-0" />
                                            ) : (
                                                <CheckCircleOutlined className="text-xs text-emerald-600 shrink-0" />
                                            )}
                                            <span>Hoàn thành</span>
                                        </button>
                                    )}
                                </div>

                                {/* Nút phụ: Thảo luận chat, Link, XML, Sửa, Xóa */}
                                <div className="flex items-center gap-1">
                                    {onChatClick && (
                                        <Badge count={ticket.unreadMessageCount || 0} size="small" offset={[-2, 2]}>
                                            <Button 
                                                size="middle" 
                                                type="dashed" 
                                                icon={<MessageOutlined />} 
                                                title="Thảo luận / Trao đổi" 
                                                className="rounded-xl"
                                                onClick={() => onChatClick(ticket)} 
                                            />
                                        </Badge>
                                    )}

                                    <Tooltip title="Sao chép Link phiếu">
                                        <Button 
                                            size="middle"
                                            type="default"
                                            icon={<LinkOutlined />}
                                            className="rounded-xl text-slate-600"
                                            onClick={() => copyTicketShareLink(ticket.id)}
                                        />
                                    </Tooltip>

                                    {ticket.ma_ba && ticket.hasXml && (
                                        <Tooltip title="Xem hồ sơ XML gốc">
                                            <Button 
                                                size="middle" 
                                                type="default"
                                                icon={<FileTextOutlined />}
                                                className="rounded-xl"
                                                onClick={() => window.open(`/xml1-viewer?search=${ticket.ma_ba}`, '_blank')}
                                            />
                                        </Tooltip>
                                    )}

                                    {hasPermission('MENU_ERROR_REQUESTS', 'DELETE') && ticket.status === 'PENDING' && (
                                        <>
                                            {onEditClick && (
                                                <Button 
                                                    size="middle" 
                                                    type="default" 
                                                    icon={<EditOutlined />}
                                                    className="rounded-xl text-blue-600 border-blue-200"
                                                    onClick={() => onEditClick(ticket)}
                                                />
                                            )}
                                            <Popconfirm 
                                                title="Xóa yêu cầu?" 
                                                description="Bạn có chắc chắn muốn xóa yêu cầu này?"
                                                onConfirm={() => onDeleteTicket(ticket.id)}
                                                okText="Xóa"
                                                cancelText="Hủy"
                                            >
                                                <Button 
                                                    size="middle" 
                                                    danger 
                                                    icon={<DeleteOutlined />} 
                                                    className="rounded-xl"
                                                />
                                            </Popconfirm>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Phân trang danh sách thẻ */}
            <div className="flex justify-center sm:justify-end bg-white p-3 rounded-2xl border border-slate-100 shadow-xs mt-3">
                <Pagination 
                    current={currentPage}
                    pageSize={pageSize}
                    total={tickets.length}
                    onChange={onPageChange}
                    size="small"
                    showSizeChanger
                    pageSizeOptions={['10', '20', '50']}
                />
            </div>
        </div>
    );
};
