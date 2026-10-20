import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendZaloGroupNotification } from '@/lib/zalo';

// Lấy danh sách nhân viên CNTT
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const targetDepartment = searchParams.get('targetDepartment') || 'CNTT';
        const userId = searchParams.get('userId');

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { role: targetDepartment },
                    ...(userId ? [{ id: userId }] : [])
                ]
            },
            orderBy: {
                dutyOrder: 'asc'
            },
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                isAvailable: true,
                dutyOrder: true,
                autoAssignDisabled: true,
                focusReason: true
            }
        });
        return NextResponse.json(users);
    } catch (error) {
        console.error('Error fetching duty roster:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Cập nhật trạng thái trực và thứ tự
export async function PUT(request: Request) {
    try {
        const currentUser = await getCurrentUser();
        const body = await request.json();
        const { users, targetDepartment: reqDept } = body; // Mảng user: { id, isAvailable, dutyOrder, autoAssignDisabled, focusReason }

        if (!Array.isArray(users)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        // Thực hiện update hàng loạt bằng transaction
        const updates = users.map(user => 
            prisma.user.update({
                where: { id: user.id },
                data: {
                    ...(user.isAvailable !== undefined && { isAvailable: user.isAvailable }),
                    ...(user.dutyOrder !== undefined && { dutyOrder: user.dutyOrder }),
                    ...(user.autoAssignDisabled !== undefined && { autoAssignDisabled: user.autoAssignDisabled }),
                    ...(user.focusReason !== undefined && { focusReason: user.focusReason })
                }
            })
        );

        await prisma.$transaction(updates);

        // Xác định phòng ban mục tiêu
        let targetDepartment = reqDept;
        if (!targetDepartment) {
            if (currentUser?.role === 'VTYT') targetDepartment = 'VTYT';
            else if (currentUser?.role === 'HCQT') targetDepartment = 'HCQT';
            else targetDepartment = 'CNTT';
        }

        // Kiểm tra xem thao tác vừa rồi có phải tắt nhận việc hoặc bật chế độ tập trung không
        const isDisablingAvailability = users.some(u => u.isAvailable === false || u.autoAssignDisabled === true);

        let allStaffOff = false;
        let warningMessage: string | null = null;

        if (isDisablingAvailability) {
            // Đếm số lượng nhân viên còn lại trong phòng ban đang SẴN SÀNG NHẬN VIỆC
            const activeStaffCount = await prisma.user.count({
                where: {
                    role: targetDepartment,
                    isActive: true,
                    isAvailable: true,
                    autoAssignDisabled: false
                }
            });

            // Nếu không còn ai bật nhận việc (tất cả đều OFF hoặc tập trung việc riêng)
            if (activeStaffCount === 0) {
                allStaffOff = true;
                warningMessage = `⚠️ CẢNH BÁO: Hiện tại phòng ${targetDepartment} KHÔNG CÒN nhân viên nào đang bật nhận việc! Hệ thống đã gửi cảnh báo khẩn cấp lên nhóm Telegram.`;

                // Đọc cấu hình Telegram / Zalo của phòng ban
                let slug = 'it-request-fields-config';
                if (targetDepartment === 'VTYT') slug = 'vtyt-request-fields-config';
                else if (targetDepartment === 'HCQT') slug = 'hcqt-request-fields-config';

                try {
                    const configRule = await prisma.specializedRule.findUnique({ where: { slug } });
                    const config: any = configRule?.logicConfig || {};

                    const targetBotToken = config.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
                    const targetChatId = config.telegramChatId || process.env.TELEGRAM_CHAT_ID;

                    const userAny = currentUser as any;
                    const operatorName = userAny?.name || userAny?.username || 'Nhân viên';
                    const operatorTag = userAny?.telegram_id ? (userAny.telegram_id.startsWith('@') ? ` (${userAny.telegram_id})` : '') : '';

                    const nowStr = new Intl.DateTimeFormat('vi-VN', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    }).format(new Date());

                    const origin = process.env.APP_URL || request.headers.get('origin') || 'http://localhost:3000';
                    const dutyUrl = `${origin}/htqlbenhvien/error-management/it-requests`;

                    // Soạn thông điệp Telegram cảnh báo
                    const telegramMsg = `🚨 <b>[CẢNH BÁO KHẨN: ${targetDepartment} KHÔNG CÒN AI NHẬN VIỆC]</b> 🚨\n\n` +
                        `⚠️ <b>Tình trạng:</b> Tất cả nhân viên phòng <b>${targetDepartment}</b> hiện đều đang <b>TẮT nhận việc</b> hoặc bật Chế độ tập trung!\n` +
                        `👤 <b>Nhân viên vừa tắt:</b> ${operatorName}${operatorTag}\n` +
                        `⏰ <b>Thời gian:</b> ${nowStr}\n\n` +
                        `👉 <b>Lưu ý khẩn:</b> Các sự cố, yêu cầu mới từ các Khoa/Phòng gửi lên sẽ <b>KHÔNG CÓ NGƯỜI TIẾP NHẬN</b>.\n` +
                        `Đề nghị kỹ thuật viên có ca trực kiểm tra và <b>BẬT NHẬN VIỆC</b> ngay!\n\n` +
                        `🔗 <a href="${dutyUrl}">👉 Bấm vào đây để mở hệ thống & bật nhận việc</a>`;

                    const replyMarkup = {
                        inline_keyboard: [
                            [
                                { text: '⚡ Mở xử lý & Bật nhận việc', url: dutyUrl }
                            ]
                        ]
                    };

                    // Gửi Telegram
                    if (targetBotToken && targetChatId) {
                        await sendTelegramMessage(telegramMsg, targetChatId, targetBotToken, replyMarkup);
                    }

                    // Gửi Zalo nếu có cấu hình
                    if (config.zaloEnabled && config.zaloWebhookUrl) {
                        await sendZaloGroupNotification(config.zaloWebhookUrl, {
                            title: `🚨 [CẢNH BÁO: ${targetDepartment} KHÔNG CÒN AI NHẬN VIỆC]`,
                            department: targetDepartment,
                            senderName: operatorName,
                            content: `⚠️ CẢNH BÁO: Tất cả nhân viên ${targetDepartment} hiện đều đang TẮT nhận việc! Đề nghị kỹ thuật viên trực ban BẬT nhận việc ngay để hỗ trợ các Khoa/Phòng.`,
                            ticketUrl: dutyUrl,
                            priority: 'URGENT'
                        });
                    }
                } catch (notifyErr) {
                    console.error('Lỗi gửi thông báo Telegram/Zalo khi tất cả nhân viên OFF:', notifyErr);
                }
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Cập nhật ca trực thành công!',
            allStaffOff,
            warningMessage
        });
    } catch (error) {
        console.error('Error updating duty roster:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

