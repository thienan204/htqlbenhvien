'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, Tag, Button, Spin, message, Image as AntImage, Alert } from 'antd';
import { 
    ShopOutlined, 
    CalendarOutlined, 
    PhoneOutlined, 
    UserOutlined, 
    FileTextOutlined, 
    CopyOutlined, 
    CheckCircleOutlined, 
    ClockCircleOutlined, 
    ToolOutlined, 
    DownloadOutlined, 
    ShareAltOutlined,
    ReloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { TicketImage } from '@/components/shared/TicketImage';
import { getBasePath } from '@/utils/config';

export default function TicketSharePage() {
    const params = useParams();
    const id = params?.id as string;

    const [ticket, setTicket] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTicket = async () => {
        if (!id) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${getBasePath()}/api/error-management/it-requests/share/${id}`);
            if (res.ok) {
                const data = await res.json();
                setTicket(data);
            } else {
                const errData = await res.json();
                setError(errData.error || 'Không tìm thấy thông tin phiếu yêu cầu');
            }
        } catch (err: any) {
            console.error(err);
            setError('Lỗi kết nối đến máy chủ bệnh viện');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTicket();
    }, [id]);

    const handleCopyLink = () => {
        if (typeof window !== 'undefined') {
            navigator.clipboard.writeText(window.location.href);
            message.success('Đã sao chép liên kết vào bộ nhớ tạm!');
        }
    };

    const handleCopyZaloMessage = () => {
        if (!ticket) return;
        const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
        const lines = [
            `🏥 [BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN]`,
            `📋 PHIẾU YÊU CẦU HỖ TRỢ KỸ THUẬT GỬI ĐỐI TÁC`,
            `----------------------------------------`,
            `🏢 Đơn vị xử lý: ${ticket.vendorName || 'Đối tác ngoài'}`,
            `📌 Sự cố: ${ticket.ten_loi}`,
            ticket.ma_ba ? `📄 Mã Bệnh Án: ${ticket.ma_ba}` : null,
            `🏥 Khoa/Phòng yêu cầu: ${ticket.ten_khoa || ticket.ma_khoa}`,
            ticket.nguoi_bao ? `👤 Người báo: ${ticket.nguoi_bao} ${ticket.sdt ? `(SĐT: ${ticket.sdt})` : ''}` : null,
            ticket.assigneeName ? `👨‍💻 Kỹ thuật CNTT phụ trách: ${ticket.assigneeName} ${ticket.assigneePhone ? `(SĐT: ${ticket.assigneePhone})` : ''}` : null,
            `⚙️ Yêu cầu kỹ thuật & Kế hoạch: ${ticket.it_note || 'Đề nghị đơn vị kiểm tra, phối hợp xử lý'}`,
            ticket.vendorExpectedReturnAt ? `⏰ Hạn hoàn thành: ${dayjs(ticket.vendorExpectedReturnAt).format('DD/MM/YYYY')}` : null,
            ticket.vendorTicketCode ? `🎫 Mã ticket hãng: ${ticket.vendorTicketCode}` : null,
            `🔗 Xem chi tiết & tệp đính kèm: ${shareUrl}`,
            `----------------------------------------`
        ].filter(Boolean).join('\n');

        if (typeof window !== 'undefined') {
            navigator.clipboard.writeText(lines);
            message.success('Đã sao chép nội dung tóm tắt để gửi Zalo!');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <Spin size="large" />
                <p className="mt-4 text-slate-500 font-medium text-sm">Đang tải thông tin yêu cầu kỹ thuật...</p>
            </div>
        );
    }

    if (error || !ticket) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full text-center rounded-2xl shadow-sm border border-slate-200">
                    <div className="text-4xl mb-3">⚠️</div>
                    <h2 className="text-lg font-bold text-slate-800 mb-2">Không tìm thấy yêu cầu</h2>
                    <p className="text-sm text-slate-500 mb-4">{error || 'Phiếu yêu cầu không tồn tại hoặc đã được thu hồi.'}</p>
                    <Button type="primary" onClick={fetchTicket} icon={<ReloadOutlined />}>Thử lại</Button>
                </Card>
            </div>
        );
    }

    const allFiles = Array.from(new Set([
        ...(ticket.dynamicFiles || []),
        ...(ticket.it_images || [])
    ]));

    let isOverdue = false;
    let overdueDays = 0;
    if (ticket.vendorExpectedReturnAt && ticket.status !== 'RESOLVED') {
        const expected = dayjs(ticket.vendorExpectedReturnAt).endOf('day');
        const now = dayjs();
        if (now.isAfter(expected)) {
            isOverdue = true;
            overdueDays = now.diff(expected, 'day') + 1;
        }
    }

    return (
        <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6">
            <div className="max-w-3xl mx-auto space-y-4">
                {/* Header bệnh viện */}
                <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold text-xl shrink-0">
                            🏥
                        </div>
                        <div>
                            <div className="text-[12px] uppercase font-bold tracking-wider text-blue-700">
                                Bệnh Viện Đa Khoa Tỉnh Lạng Sơn
                            </div>
                            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
                                Phiếu Yêu Cầu Hỗ Trợ Kỹ Thuật
                            </h1>
                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                                <span>Mã phiếu: <strong className="font-mono text-slate-700">#{ticket.id.slice(-6).toUpperCase()}</strong></span>
                                <span>•</span>
                                <span>Tạo ngày: {dayjs(ticket.createdAt).format('DD/MM/YYYY HH:mm')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button 
                            icon={<CopyOutlined />} 
                            onClick={handleCopyLink}
                            className="flex-1 sm:flex-initial rounded-xl text-xs"
                        >
                            Sao chép Link
                        </Button>
                        <Button 
                            type="primary" 
                            icon={<ShareAltOutlined />} 
                            onClick={handleCopyZaloMessage}
                            className="flex-1 sm:flex-initial rounded-xl bg-blue-600 text-xs font-semibold"
                        >
                            Gửi Zalo
                        </Button>
                    </div>
                </div>

                {/* Banner trạng thái & Hạn hoàn thành */}
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-4 text-white shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl shrink-0">
                            <ShopOutlined />
                        </div>
                        <div>
                            <div className="text-xs text-amber-100 font-medium">Đơn vị / Đối tác phụ trách</div>
                            <div className="text-base sm:text-lg font-bold">
                                {ticket.vendorName || 'Đối tác ngoài'}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {ticket.status === 'RESOLVED' ? (
                            <span className="bg-green-500 text-white font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1 shadow-xs">
                                <CheckCircleOutlined /> Đã hoàn thành
                            </span>
                        ) : isOverdue ? (
                            <span className="bg-red-600 text-white font-bold px-3 py-1 rounded-full text-xs animate-pulse flex items-center gap-1 shadow-xs">
                                ⚠️ Quá hạn {overdueDays} ngày
                            </span>
                        ) : (
                            <span className="bg-white text-amber-800 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1 shadow-xs">
                                <ClockCircleOutlined /> Đang xử lý
                            </span>
                        )}

                        {ticket.vendorExpectedReturnAt && (
                            <div className="text-xs bg-black/20 px-2.5 py-1 rounded-full text-amber-50">
                                Hạn xong: <strong>{dayjs(ticket.vendorExpectedReturnAt).format('DD/MM/YYYY')}</strong>
                            </div>
                        )}
                        {ticket.vendorTicketCode && (
                            <div className="text-xs bg-black/20 px-2.5 py-1 rounded-full text-amber-50 font-mono">
                                Ticket hãng: <strong>{ticket.vendorTicketCode}</strong>
                            </div>
                        )}
                    </div>
                </div>

                {/* Kế hoạch & Yêu cầu kỹ thuật từ phòng CNTT */}
                <Card 
                    className="rounded-2xl border-amber-200 shadow-2xs overflow-hidden"
                    title={
                        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                            <ToolOutlined className="text-amber-600 text-base" />
                            <span>Yêu Cầu Kỹ Thuật & Kế Hoạch Phối Hợp (Từ CNTT Bệnh viện)</span>
                        </div>
                    }
                >
                    <div className="space-y-3">
                        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/70 text-slate-800 text-[14px] leading-relaxed whitespace-pre-wrap font-medium">
                            {ticket.it_note || 'Đề nghị đơn vị đối tác kiểm tra và phối hợp khắc phục sự cố.'}
                        </div>

                        {ticket.assigneeName && (
                            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600">
                                <div className="flex items-center gap-2">
                                    <UserOutlined className="text-blue-600" />
                                    <span>Kỹ thuật viên CNTT theo dõi: <strong>{ticket.assigneeName}</strong></span>
                                </div>
                                {ticket.assigneePhone && (
                                    <a 
                                        href={`tel:${ticket.assigneePhone}`}
                                        className="font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-100 flex items-center gap-1.5"
                                    >
                                        <PhoneOutlined /> Gọi: {ticket.assigneePhone}
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                </Card>

                {/* Nội dung sự cố từ Bệnh viện */}
                <Card 
                    className="rounded-2xl border-slate-200 shadow-2xs"
                    title={
                        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                            <FileTextOutlined className="text-blue-600 text-base" />
                            <span>Chi Tiết Sự Cố Từ Khoa Phòng Bệnh Viện</span>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <div className="text-xs text-slate-400 font-medium">Tên sự cố / Mô tả lỗi:</div>
                            <div className="text-base font-bold text-slate-900 mt-0.5">
                                {ticket.ten_loi}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                            <div className="space-y-1">
                                <span className="text-slate-400">Khoa / Phòng báo:</span>
                                <div className="font-semibold text-slate-800 text-sm">
                                    🏥 {ticket.ten_khoa || ticket.ma_khoa}
                                </div>
                            </div>

                            {ticket.ma_ba && (
                                <div className="space-y-1">
                                    <span className="text-slate-400">Mã Bệnh Án liên quan:</span>
                                    <div className="font-mono font-bold text-blue-600 text-sm bg-blue-50 px-2 py-0.5 rounded inline-block">
                                        {ticket.ma_ba}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                <span className="text-slate-400">Người báo sự cố:</span>
                                <div className="font-semibold text-slate-800 text-sm">
                                    👤 {ticket.nguoi_bao || 'Cán bộ khoa phòng'}
                                </div>
                            </div>

                            {ticket.sdt && (
                                <div className="space-y-1">
                                    <span className="text-slate-400">Số điện thoại liên hệ:</span>
                                    <div>
                                        <a 
                                            href={`tel:${ticket.sdt}`}
                                            className="font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-lg border border-red-200 inline-flex items-center gap-1"
                                        >
                                            <PhoneOutlined /> {ticket.sdt}
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Tệp đính kèm & Hình ảnh */}
                {allFiles.length > 0 && (
                    <Card 
                        className="rounded-2xl border-slate-200 shadow-2xs"
                        title={
                            <div className="flex items-center justify-between text-slate-800 font-bold text-sm">
                                <span>📎 Tệp Đính Kèm & Hình Ảnh Biên Nhận ({allFiles.length})</span>
                                <span className="text-xs text-slate-400 font-normal">Nhấp vào ảnh để phóng to hoặc bấm để tải tệp</span>
                            </div>
                        }
                    >
                        <div className="flex flex-wrap gap-3 items-center">
                            <AntImage.PreviewGroup>
                                {allFiles.map((url: string, idx: number) => (
                                    <div key={idx} className="relative group">
                                        <TicketImage url={url} />
                                    </div>
                                ))}
                            </AntImage.PreviewGroup>
                        </div>
                    </Card>
                )}

                {/* Footer chân trang */}
                <div className="text-center text-xs text-slate-400 py-4 space-y-1">
                    <div>Hệ thống Quản lý Sự cố & Yêu cầu Kỹ thuật • Bệnh viện Đa khoa tỉnh Lạng Sơn</div>
                    <div>Thôn Đại Sơn, Xã Hợp Thành, Thành phố Lạng Sơn, Tỉnh Lạng Sơn</div>
                </div>
            </div>
        </div>
    );
}
