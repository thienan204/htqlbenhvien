import { message } from 'antd';
import dayjs from 'dayjs';
import { getBasePath } from '@/utils/config';

export function getTicketShareUrl(ticketId: string): string {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${getBasePath()}/error-management/it-requests/share/${ticketId}`;
}

export function copyTicketShareLink(ticketId: string) {
    if (!ticketId) return;
    const url = getTicketShareUrl(ticketId);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(url)
            .then(() => message.success('Đã sao chép liên kết phiếu gửi đối tác!'))
            .catch(() => message.error('Không thể sao chép liên kết'));
    }
}

export function copyTicketZaloMessage(ticket: any, options?: { deptName?: string }) {
    if (!ticket) return;
    const shareUrl = getTicketShareUrl(ticket.id);
    const dept = options?.deptName || ticket.ten_khoa || ticket.ma_khoa || '';
    const nguoiBao = ticket.dynamicFields?.['Người báo'] || ticket.nguoi_bao || '';
    const sdt = ticket.dynamicFields?.['SĐT'] || ticket.sdt || '';

    const lines = [
        `🏥 [BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN]`,
        `📋 YÊU CẦU HỖ TRỢ KỸ THUẬT GỬI ĐỐI TÁC`,
        `----------------------------------------`,
        `🏢 Đơn vị phụ trách: ${ticket.vendorName || 'Đối tác ngoài'}`,
        `📌 Sự cố: ${ticket.ten_loi || 'Hỗ trợ kỹ thuật'}`,
        ticket.ma_ba ? `📄 Mã Bệnh Án: ${ticket.ma_ba}` : null,
        dept ? `🏥 Khoa/Phòng yêu cầu: ${dept}` : null,
        nguoiBao ? `👤 Người báo: ${nguoiBao} ${sdt ? `(SĐT: ${sdt})` : ''}` : null,
        ticket.assigneeName ? `👨‍💻 Kỹ thuật CNTT phụ trách: ${ticket.assigneeName} ${ticket.assigneePhone ? `(SĐT: ${ticket.assigneePhone})` : ''}` : null,
        ticket.it_note ? `⚙️ Yêu cầu kỹ thuật & Kế hoạch: ${ticket.it_note}` : null,
        ticket.vendorExpectedReturnAt ? `⏰ Hạn hoàn thành: ${dayjs(ticket.vendorExpectedReturnAt).format('DD/MM/YYYY')}` : null,
        ticket.vendorTicketCode ? `🎫 Mã ticket hãng: ${ticket.vendorTicketCode}` : null,
        `🔗 Link xem chi tiết & tệp đính kèm: ${shareUrl}`,
        `----------------------------------------`
    ].filter(Boolean).join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(lines)
            .then(() => message.success('Đã sao chép tin nhắn Zalo kèm liên kết!'))
            .catch(() => message.error('Không thể sao chép tin nhắn'));
    }
}
