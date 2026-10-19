export interface ZaloNotificationOptions {
    title: string;
    department?: string;
    senderName?: string;
    phone?: string;
    content: string;
    patientCode?: string;
    ticketUrl?: string;
    time?: string;
    priority?: 'NORMAL' | 'URGENT' | 'REPLY';
}

export async function sendZaloGroupNotification(
    webhookUrl: string | undefined | null,
    options: ZaloNotificationOptions
): Promise<{ success: boolean; error?: string }> {
    const url = webhookUrl || process.env.ZALO_WEBHOOK_URL;
    if (!url || !url.trim()) {
        return { success: false, error: 'Chưa cấu hình Zalo Webhook URL' };
    }

    try {
        const timeStr = options.time || new Date().toLocaleString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit', 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
        
        let headerIcon = '🔔';
        if (options.priority === 'URGENT') headerIcon = '🔴';
        else if (options.priority === 'REPLY') headerIcon = '💬';

        let text = `${headerIcon} [${options.title.toUpperCase()}]\n`;
        if (options.department) text += `🏢 Khoa/Phòng: ${options.department}\n`;
        if (options.senderName) {
            text += `👤 Người gửi: ${options.senderName}${options.phone ? ` (SĐT: ${options.phone})` : ''}\n`;
        }
        if (options.patientCode) text += `📝 Mã BA/LK: ${options.patientCode}\n`;
        text += `📄 Nội dung: ${options.content}\n`;
        text += `⏰ Thời gian: ${timeStr}\n`;
        if (options.ticketUrl) {
            text += `🔗 Xem chi tiết & Xử lý: ${options.ticketUrl}`;
        }

        const payload = {
            message: text,
            text: text,
            content: text,
            data: {
                title: options.title,
                department: options.department,
                sender: options.senderName,
                content: options.content,
                url: options.ticketUrl
            }
        };

        const res = await fetch(url.trim(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            console.error('Lỗi khi gọi Zalo Webhook:', res.status, errText);
            return { success: false, error: `Zalo Webhook phản hồi mã lỗi HTTP ${res.status}` };
        }

        return { success: true };
    } catch (err: any) {
        console.error('Lỗi gửi tin Zalo Group:', err);
        return { success: false, error: err.message || 'Lỗi kết nối Zalo Webhook' };
    }
}
