import React from 'react';
import { Button } from 'antd';
import { Ticket } from '../types';

interface TicketNotificationProps {
    tickets: Ticket[];
    onSelectTicket?: (ticket: Ticket) => void;
    onNavigateToMyTickets?: () => void;
    onQuickReceiveTicket?: (ticket: Ticket) => void;
    onCloseNotification?: () => void;
}

export const TicketNotificationTitle: React.FC = () => (
    <div className="flex items-center gap-1.5 font-bold text-amber-800 text-[14px]">
        <span>🚨</span>
        <span>Nhắc nhở: Có việc chưa tiếp nhận!</span>
    </div>
);

export const TicketNotificationContent: React.FC<TicketNotificationProps> = ({
    tickets,
    onSelectTicket,
    onNavigateToMyTickets,
    onQuickReceiveTicket,
    onCloseNotification
}) => {
    return (
        <div className="space-y-2 pt-1 text-sm">
            <div className="text-slate-600 text-xs">
                Bạn đang có <b className="text-red-600 font-semibold">{tickets.length}</b> yêu cầu cần xử lý:
            </div>
            <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                {tickets.slice(0, 3).map((ticket: Ticket) => {
                    const deptText = ticket.ten_khoa || ticket.ma_khoa;
                    const reporterText = ticket.nguoi_bao || ticket.dynamicFields?.['Người báo'];
                    return (
                        <div 
                            key={ticket.id}
                            onClick={() => {
                                onCloseNotification?.();
                                onSelectTicket?.(ticket);
                            }}
                            className="group flex flex-col p-2 rounded-lg bg-amber-50/90 hover:bg-blue-50/90 border border-amber-200 hover:border-blue-400 cursor-pointer transition-all shadow-2xs"
                            title="Bấm vào để mở trực tiếp công việc này"
                        >
                            <div className="flex items-center gap-1 font-semibold text-blue-700 group-hover:text-blue-800 text-[13px] leading-snug">
                                <span className="text-blue-500">🔗</span>
                                <span className="underline decoration-blue-300 group-hover:decoration-blue-600 transition-colors">
                                    {ticket.ten_loi || 'Yêu cầu hỗ trợ'}
                                </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                {deptText && <span>Khoa: <b className="text-slate-700">{deptText}</b></span>}
                                {ticket.ma_ba && <span className="text-blue-600 font-mono font-medium">BA: {ticket.ma_ba}</span>}
                                {reporterText && <span>Báo bởi: {reporterText}</span>}
                            </div>
                        </div>
                    );
                })}
                {tickets.length > 3 && (
                    <div 
                        className="text-[12px] text-blue-600 hover:underline cursor-pointer italic text-center py-0.5"
                        onClick={() => {
                            onCloseNotification?.();
                            onNavigateToMyTickets?.();
                        }}
                    >
                        + Xem thêm {tickets.length - 3} việc khác...
                    </div>
                )}
            </div>

            {/* Cụm nút hành động tích hợp ngay trong nội dung */}
            <div className="flex items-center gap-2 pt-2 border-t border-amber-200/60 mt-1.5">
                {tickets.length === 1 && onQuickReceiveTicket && (
                    <Button 
                        type="primary" 
                        size="small"
                        className="bg-green-600 hover:bg-green-500 font-medium text-xs h-7 shadow-xs"
                        onClick={() => {
                            onCloseNotification?.();
                            onQuickReceiveTicket(tickets[0]);
                        }}
                    >
                        ⚡ Nhận việc ngay
                    </Button>
                )}
                <Button 
                    type="default"
                    size="small" 
                    className="text-xs h-7 text-blue-600 hover:text-blue-700 hover:border-blue-400"
                    onClick={() => {
                        onCloseNotification?.();
                        onNavigateToMyTickets?.();
                    }}
                >
                    📋 Việc của tôi ({tickets.length})
                </Button>
            </div>
        </div>
    );
};
