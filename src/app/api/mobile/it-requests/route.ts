import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUserFromRequest } from '@/actions/auth';
import { sendPushNotification } from '@/lib/firebase-admin';

const prisma = new PrismaClient();

// Hàm hỗ trợ gửi Telegram
async function sendTelegramMessage(message: string, chatId?: string, botToken?: string) {
    const targetBotToken = botToken || process.env.TELEGRAM_BOT_TOKEN;
    const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
    if (!targetBotToken || !targetChatId) return;
    try {
        await fetch(`https://api.telegram.org/bot${targetBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: targetChatId, text: message, parse_mode: 'HTML' })
        });
    } catch (err) {
        console.error('Lỗi gửi Telegram:', err);
    }
}

export async function GET(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized - Vui lòng đăng nhập lại' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get('status');
        const targetDepartment = searchParams.get('targetDepartment');
        const assigneeId = searchParams.get('assigneeId');
        const maKhoaFilter = searchParams.get('ma_khoa');

        let whereClause: any = {};
        
        // Phân quyền cho Mobile giống Web
        const isManager = (user as any).isManager || user.role === 'ADMIN';
        if (['CNTT', 'VTYT', 'HCQT'].includes(user.role)) {
            whereClause.targetDepartment = user.role;
            // Nếu không phải Manager, chỉ thấy phiếu của chính mình
            if (!isManager) {
                whereClause.assigneeId = user.id;
            }
        } else if (targetDepartment) {
            whereClause.targetDepartment = targetDepartment;
        }
        
        if (user.role === 'KHOA') {
            if (!user.ma_khoa) return NextResponse.json({ error: 'Tài khoản chưa gán khoa' }, { status: 403 });
            whereClause.ma_khoa = user.ma_khoa;
        }

        if (statusFilter) whereClause.status = statusFilter;
        if (assigneeId) whereClause.assigneeId = assigneeId; // Dành cho tab "Việc của tôi" trên Mobile
        if (maKhoaFilter && user.role !== 'KHOA') whereClause.ma_khoa = maKhoaFilter; // Cho phép filter theo khoa nếu không phải role KHOA

        const requests = await prisma.iTRequest.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: 50 // Giới hạn số lượng trả về cho Mobile để tối ưu hiệu năng
        });

        // Lấy tên người xử lý
        const assignees = await prisma.user.findMany({
            where: { role: { in: ['CNTT', 'VTYT', 'HCQT', 'ADMIN'] } },
            select: { id: true, name: true, username: true }
        });
        const assigneeMap = assignees.reduce((acc: any, curr) => {
            acc[curr.id] = curr.name || curr.username;
            return acc;
        }, {});

        // Lấy danh sách tên Khoa
        const departments = await prisma.department.findMany({
            select: { ma_khoa: true, ten_khoa: true }
        });
        const deptMap = departments.reduce((acc: any, curr) => {
            acc[curr.ma_khoa] = curr.ten_khoa;
            return acc;
        }, {});

        const enrichedRequests = requests.map(req => ({
            ...req,
            ten_khoa: deptMap[req.ma_khoa] || req.ma_khoa,
            assigneeName: req.assigneeId ? assigneeMap[req.assigneeId] : 'Chưa phân công',
            transferToName: req.transferToId ? assigneeMap[req.transferToId] : null
        }));

        return NextResponse.json(enrichedRequests);
    } catch (error) {
        console.error('Error GET mobile it-requests:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { ma_ba, ten_loi, assigneeId, dynamicFields, category, nguoi_bao_id, sdt, targetDepartment = 'CNTT' } = body;
        
        let ma_khoa = body.ma_khoa;
        if (!['ADMIN', 'CNTT', 'VTYT', 'HCQT'].includes(user.role)) {
            ma_khoa = user.ma_khoa; // Ghi đè bằng mã khoa thực tế của user
        }

        if (!ten_loi || !ma_khoa) {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc (ten_loi, ma_khoa)' }, { status: 400 });
        }

        const isManager = (user as any).isManager || user.role === 'ADMIN';

        let finalAssignee = assigneeId || null;
        if (!isManager && assigneeId) {
            finalAssignee = null; // Từ chối assign ngay lúc tạo nếu không phải manager
        }

        // Tự động cập nhật số điện thoại vào bảng Staff nếu có
        let finalSdt = sdt || '';
        if (nguoi_bao_id && sdt) {
            try {
                await prisma.staff.update({
                    where: { id: nguoi_bao_id },
                    data: { so_dien_thoai: sdt }
                });
                if (dynamicFields) dynamicFields['SĐT'] = sdt;
            } catch (err) {
                console.error("Lỗi đồng bộ sdt nhân viên từ Mobile:", err);
            }
        }

        // Tạo Request Mới
        const newRequest = await prisma.iTRequest.create({
            data: {
                targetDepartment,
                ma_ba: ma_ba || null,
                category: category || 'SOFTWARE',
                ten_loi,
                ma_khoa,
                assigneeId: finalAssignee,
                dynamicFields: dynamicFields || {},
                status: 'PENDING',
                messages: {
                    create: [
                        {
                            senderId: nguoi_bao_id || user.id,
                            senderName: dynamicFields?.['Người báo'] || (user as any).name || user.username,
                            content: ten_loi,
                            imageUrl: dynamicFields?.['Hình ảnh đính kèm'] && dynamicFields['Hình ảnh đính kèm'].length > 0 ? dynamicFields['Hình ảnh đính kèm'][0] : null
                        }
                    ]
                }
            }
        });

        // Bắn Telegram thông báo
        const dept = await prisma.department.findUnique({ where: { ma_khoa } });
        const tenKhoa = dept?.ten_khoa || ma_khoa;
        
        let telegramMsg = `📱 <b>YÊU CẦU MỚI (TỪ APP MOBILE)</b>\n\n`;
        telegramMsg += `🏢 <b>Khoa:</b> ${tenKhoa}\n`;
        telegramMsg += `👤 <b>Người báo:</b> ${dynamicFields?.['Người báo'] || 'Không rõ'} - <b>SĐT:</b> ${finalSdt || 'Không có'}\n`;
        telegramMsg += `❌ <b>Lỗi:</b> ${ten_loi}\n`;
        if (dynamicFields?.['Ghi chú']) telegramMsg += `🗒 <b>Ghi chú:</b> ${dynamicFields['Ghi chú']}\n`;

        // Chỉ gửi vào Group chung, Logic Auto-assign phức tạp tạm thời bị lược bớt cho Mobile API để giữ tốc độ nhanh.
        await sendTelegramMessage(telegramMsg);

        // Bắn Push Notification qua Firebase
        try {
            let userIdsToNotify: string[] = [];
            if (finalAssignee) {
                userIdsToNotify.push(finalAssignee);
            } else {
                const deptUsers = await prisma.user.findMany({ where: { role: targetDepartment }, select: { id: true } });
                userIdsToNotify = deptUsers.map(u => u.id);
            }

            if (userIdsToNotify.length > 0) {
                const deviceTokens = await prisma.userDeviceToken.findMany({
                    where: { userId: { in: userIdsToNotify } },
                    select: { token: true }
                });
                
                const tokens = deviceTokens.map(dt => dt.token);
                if (tokens.length > 0) {
                    const title = finalAssignee ? '🔔 Bạn được giao một việc mới!' : `🚨 Yêu cầu mới từ ${tenKhoa} (App)`;
                    const body = `Lỗi: ${ten_loi}`;
                    await sendPushNotification(tokens, title, body, { itRequestId: newRequest.id });
                }
            }
        } catch (pushErr) {
            console.error('Error sending push notification in mobile it-requests POST:', pushErr);
        }

        return NextResponse.json({ success: true, data: newRequest });
    } catch (error: any) {
        console.error('Error POST mobile it-requests:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
