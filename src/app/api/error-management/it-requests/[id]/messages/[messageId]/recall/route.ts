import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';
import { emitEvent } from '@/lib/notificationService';

export async function POST(
    request: Request,
    context: { params: Promise<{ id: string; messageId: string }> }
) {
    try {
        const { id: ticketId, messageId } = await context.params;

        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        if (!ticketId || !messageId) {
            return NextResponse.json({ error: 'Thiếu thông tin yêu cầu' }, { status: 400 });
        }

        // Tìm tin nhắn cần thu hồi
        const message = await prisma.requestMessage.findFirst({
            where: {
                id: messageId,
                itRequestId: ticketId
            }
        });

        if (!message) {
            return NextResponse.json({ error: 'Không tìm thấy tin nhắn' }, { status: 404 });
        }

        // 1. Chỉ người gửi tin nhắn mới được thu hồi
        if (message.senderId !== user.id) {
            return NextResponse.json({ error: 'Bạn chỉ có thể thu hồi tin nhắn của chính mình' }, { status: 403 });
        }

        // 2. Không cho phép thu hồi tin nhắn sự kiện tự động của hệ thống
        if (message.isSystem) {
            return NextResponse.json({ error: 'Không thể thu hồi thông báo sự kiện hệ thống' }, { status: 400 });
        }

        // 3. Nếu tin nhắn đã thu hồi rồi
        if (message.isRecalled) {
            return NextResponse.json({ error: 'Tin nhắn này đã được thu hồi trước đó' }, { status: 400 });
        }

        // 4. Đọc cấu hình thu hồi tin nhắn từ DB
        let allowMessageRecall = true;
        let messageRecallTimeLimitMinutes = 15;

        try {
            const configRule = await prisma.specializedRule.findUnique({
                where: { slug: 'it-request-fields-config' }
            });
            if (configRule && configRule.logicConfig && typeof configRule.logicConfig === 'object') {
                const conf: any = configRule.logicConfig;
                if (conf.allowMessageRecall !== undefined) {
                    allowMessageRecall = Boolean(conf.allowMessageRecall);
                }
                if (conf.messageRecallTimeLimitMinutes !== undefined) {
                    messageRecallTimeLimitMinutes = Number(conf.messageRecallTimeLimitMinutes);
                }
            }
        } catch (e) {
            console.warn('Lỗi đọc cấu hình thu hồi tin nhắn:', e);
        }

        if (!allowMessageRecall) {
            return NextResponse.json({ error: 'Tính năng thu hồi tin nhắn hiện đang tắt bởi Quản trị viên' }, { status: 400 });
        }

        // 5. Kiểm tra thời hạn cho phép thu hồi (nếu cấu hình > 0 phút)
        if (messageRecallTimeLimitMinutes > 0) {
            const elapsedMinutes = (Date.now() - new Date(message.createdAt).getTime()) / (1000 * 60);
            if (elapsedMinutes > messageRecallTimeLimitMinutes) {
                return NextResponse.json({ 
                    error: `Đã quá thời hạn cho phép thu hồi (${messageRecallTimeLimitMinutes} phút kể từ lúc gửi)` 
                }, { status: 400 });
            }
        }

        // 6. Kiểm tra xem người nhận đã đọc chưa
        // Mảng readBy chứa các userId đã đọc. Nếu có userId nào khác senderId => đã đọc!
        const otherReaders = (message.readBy || []).filter(uid => uid !== user.id);
        if (otherReaders.length > 0) {
            return NextResponse.json({ 
                error: 'Người nhận đã đọc tin nhắn này, không thể thu hồi' 
            }, { status: 400 });
        }

        // Cập nhật trạng thái thu hồi
        const updated = await prisma.requestMessage.update({
            where: { id: messageId },
            data: {
                isRecalled: true,
                recalledAt: new Date(),
                content: 'Tin nhắn đã được thu hồi',
                imageUrl: null
            }
        });

        // Phát sự kiện realtime thông báo tin nhắn đã thu hồi
        try {
            emitEvent('IT_REQUEST_MESSAGE_RECALLED', {
                ticketId,
                messageId,
                senderId: user.id
            });
        } catch (err) {
            // ignore
        }

        return NextResponse.json({
            success: true,
            message: 'Đã thu hồi tin nhắn thành công',
            recalledMessage: updated
        });
    } catch (error) {
        console.error('Lỗi khi thu hồi tin nhắn:', error);
        return NextResponse.json({ error: 'Lỗi máy chủ khi thu hồi tin nhắn' }, { status: 500 });
    }
}

