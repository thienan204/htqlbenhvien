import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { sendPushNotification } from '@/lib/firebase-admin';
import { emitEvent } from '@/lib/notificationService';
import { sendZaloGroupNotification } from '@/lib/zalo';
import { getCurrentHospitalShift } from '@/lib/shiftUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Telegram Bot details (nên để ở .env)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(message: string, chatId?: string, botToken?: string, replyMarkup?: any) {
    const targetBotToken = botToken || process.env.TELEGRAM_BOT_TOKEN;
    const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
    if (!targetBotToken || !targetChatId) return { success: false, error: 'Thiếu Bot Token hoặc Chat ID' };
    try {
        const payload: any = {
            chat_id: targetChatId,
            text: message,
            parse_mode: 'HTML'
        };
        if (replyMarkup) {
            payload.reply_markup = replyMarkup;
        }
        const res = await fetch(`https://api.telegram.org/bot${targetBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
            console.error('Lỗi Telegram API:', data);
            return { success: false, error: data.description || 'Lỗi gửi tin nhắn Telegram' };
        }
        return { success: true, data };
    } catch (err: any) {
        console.error('Lỗi gửi Telegram:', err);
        return { success: false, error: err.message };
    }
}

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get('status');
        const targetDepartment = searchParams.get('targetDepartment');

        let whereClause: any = {};

        // Cố định targetDepartment theo Role nếu không phải Admin/Khoa
        if (user.role === 'CNTT') whereClause.targetDepartment = 'CNTT';
        else if (user.role === 'VTYT') whereClause.targetDepartment = 'VTYT';
        else if (user.role === 'HCQT') whereClause.targetDepartment = 'HCQT';
        else if (targetDepartment) whereClause.targetDepartment = targetDepartment;

        // Phân quyền: Người dùng khoa/phòng chỉ thấy phiếu của khoa mình
        const isDepartmentUser = !['ADMIN', 'CNTT', 'VTYT', 'HCQT'].includes(user.role);
        if (isDepartmentUser) {
            if (!user.ma_khoa) return NextResponse.json({ error: 'Tài khoản chưa gán khoa' }, { status: 403 });
            whereClause.ma_khoa = user.ma_khoa;
        }

        if (statusFilter) {
            whereClause.status = statusFilter;
        }

        const requests = await prisma.iTRequest.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { messages: true }
                },
                messages: {
                    orderBy: { createdAt: 'asc' },
                    select: { id: true, channel: true, senderId: true, senderName: true, readBy: true }
                }
            }
        });

        // Lấy danh sách tên người xử lý để map ID -> Tên và SĐT
        const assignees = await prisma.user.findMany({
            where: { role: { in: ['CNTT', 'VTYT', 'HCQT', 'ADMIN'] } },
            select: { 
                id: true, 
                name: true, 
                username: true,
                staff: {
                    select: {
                        so_dien_thoai: true
                    }
                }
            }
        });
        const assigneeMap = assignees.reduce((acc: any, curr) => {
            acc[curr.id] = {
                name: curr.name || curr.username,
                phone: curr.staff?.so_dien_thoai || null
            };
            return acc;
        }, {});

        // Tra cứu thông tin người báo cáo từ bảng Staff nếu phiếu có lưu nguoi_bao_id
        const staffIds = requests
            .map(r => (r.dynamicFields as any)?.nguoi_bao_id)
            .filter(Boolean) as string[];
        let staffMap = new Map<string, { ho_ten: string; so_dien_thoai: string | null }>();
        if (staffIds.length > 0) {
            const staffs = await prisma.staff.findMany({
                where: { id: { in: staffIds } },
                select: { id: true, ho_ten: true, so_dien_thoai: true }
            });
            staffMap = new Map(staffs.map(s => [s.id, { ho_ten: s.ho_ten, so_dien_thoai: s.so_dien_thoai }]));
        }

        const maBaList = requests.map(req => req.ma_ba).filter(Boolean) as string[];
        const existingXmls = await prisma.xml1.findMany({
            where: { MA_LK: { in: maBaList } },
            select: { MA_LK: true },
            distinct: ['MA_LK']
        });
        const existingXmlSet = new Set(existingXmls.map(xml => xml.MA_LK));

        const enrichedRequests = requests.map(req => {
            const allMessages = (req as any).messages || [];
            // Tin nhắn đầu tiên (index 0) là nội dung yêu cầu ban đầu của Khoa (đã hiển thị ở cột Lỗi yêu cầu), mặc định coi như đã đọc
            // Chỉ tính tin chưa đọc cho các tin nhắn thảo luận/trao đổi từ tin nhắn thứ 2 trở đi
            const conversationMessages = allMessages.slice(1);
            const unreadList = conversationMessages.filter((m: any) => 
                m.senderId !== user.id && (!m.readBy || !m.readBy.includes(user.id))
            );

            const dyn = (req.dynamicFields as any) || {};
            const staffInfo = dyn.nguoi_bao_id ? staffMap.get(dyn.nguoi_bao_id) : null;
            const nguoiBao = dyn['Người báo'] || dyn['nguoi_bao'] || dyn['nguoi_bao_ten'] || staffInfo?.ho_ten || allMessages[0]?.senderName || null;
            const phone = dyn['SĐT'] || dyn['Số điện thoại'] || staffInfo?.so_dien_thoai || null;

            return {
                ...req,
                nguoi_bao: nguoiBao,
                sdt: phone,
                assigneeName: req.assigneeId ? assigneeMap[req.assigneeId]?.name : 'Chưa phân công',
                assigneePhone: req.assigneeId ? assigneeMap[req.assigneeId]?.phone : null,
                transferToName: req.transferToId ? assigneeMap[req.transferToId]?.name : null,
                messageCount: req._count?.messages || 0,
                unreadMessageCount: unreadList.length,
                unreadInternalCount: unreadList.filter((m: any) => m.channel === 'INTERNAL').length,
                unreadVendorCount: unreadList.filter((m: any) => m.channel === 'VENDOR').length,
                hasXml: req.ma_ba ? existingXmlSet.has(req.ma_ba) : false,
                messages: undefined // Không gửi toàn bộ object messages ra list để giảm payload
            };
        });

        return NextResponse.json(enrichedRequests, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });
    } catch (error) {
        console.error('Error GET it-requests:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const urlObj = new URL(request.url);
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        let { ma_ba, ten_loi, assigneeId, dynamicFields, category, nguoi_bao_id, sdt, xmlErrorId, action, targetDepartment = 'CNTT', selfAssign, isFocusTask, focusReason } = body;

        let ma_khoa = body.ma_khoa;
        if (!['ADMIN', 'CNTT', 'VTYT', 'HCQT'].includes(user.role)) {
            ma_khoa = user.ma_khoa; // Ghi đè bằng mã khoa thực tế
        }

        let slug = 'it-request-fields-config';
        if (targetDepartment === 'VTYT') slug = 'vtyt-request-fields-config';
        else if (targetDepartment === 'HCQT') slug = 'hcqt-request-fields-config';

        // Lấy cấu hình
        const configRule = await prisma.specializedRule.findUnique({
            where: { slug }
        });

        let assignmentMode = 'A';
        let targetBotToken = process.env.TELEGRAM_BOT_TOKEN;
        let targetChatId = process.env.TELEGRAM_CHAT_ID;
        let targetZaloEnabled = false;
        let targetZaloWebhookUrl = process.env.ZALO_WEBHOOK_URL || '';
        let targetMaxConcurrentTasks = 2;
        let targetMorningStartTime = '07:00';
        let targetMorningEndTime = '11:30';
        let targetAfternoonStartTime = '13:30';
        let targetAfternoonEndTime = '16:50';
        let targetHolidays: string[] = [];
        let targetMakeupWorkdays: string[] = [];
        let targetNoStaffWarningEnabled = true;
        let targetNoStaffWarningMessage = 'Hiện tại ngoài khung giờ hành chính / kỹ thuật viên đang bận ca trực ngoài viện nên chưa thể tiếp nhận ngay. Yêu cầu của Khoa/Phòng đã được lưu trên hệ thống và chuyển đến nhóm trực. Nếu là sự cố khẩn cấp ảnh hưởng khám chữa bệnh, vui lòng gọi điện thoại trực ban để được hỗ trợ!';
        let targetSaveAssignReason = true;

        if (configRule && configRule.logicConfig) {
            const config: any = configRule.logicConfig;
            if (!Array.isArray(config)) {
                assignmentMode = config.assignmentMode || 'A';
                if (config.telegramBotToken) targetBotToken = config.telegramBotToken;
                if (config.telegramChatId) targetChatId = config.telegramChatId;
                if (config.zaloEnabled !== undefined) targetZaloEnabled = Boolean(config.zaloEnabled);
                if (config.zaloWebhookUrl) targetZaloWebhookUrl = config.zaloWebhookUrl;
                if (config.maxConcurrentTasks !== undefined) targetMaxConcurrentTasks = Number(config.maxConcurrentTasks);
                if (config.morningStartTime) targetMorningStartTime = config.morningStartTime;
                if (config.morningEndTime) targetMorningEndTime = config.morningEndTime;
                if (config.afternoonStartTime) targetAfternoonStartTime = config.afternoonStartTime;
                if (config.afternoonEndTime) targetAfternoonEndTime = config.afternoonEndTime;
                else if (config.officeEndTime) targetAfternoonEndTime = config.officeEndTime;
                if (Array.isArray(config.holidays)) targetHolidays = config.holidays;
                if (Array.isArray(config.makeupWorkdays)) targetMakeupWorkdays = config.makeupWorkdays;
                if (config.noStaffWarningEnabled !== undefined) targetNoStaffWarningEnabled = Boolean(config.noStaffWarningEnabled);
                if (config.noStaffWarningMessage) targetNoStaffWarningMessage = config.noStaffWarningMessage;
                if (config.saveAssignReason !== undefined) targetSaveAssignReason = Boolean(config.saveAssignReason);
            }
        }

        const currentShift = getCurrentHospitalShift({
            morningStart: targetMorningStartTime,
            morningEnd: targetMorningEndTime,
            afternoonStart: targetAfternoonStartTime,
            afternoonEnd: targetAfternoonEndTime,
            holidays: targetHolidays,
            makeupWorkdays: targetMakeupWorkdays
        });

        if (action === 'TEST_TELEGRAM') {
            const { testBotToken, testChatId } = body;
            const token = testBotToken || targetBotToken;
            const chat = testChatId || targetChatId;
            if (!token || !chat) {
                return NextResponse.json({ error: 'Vui lòng nhập đầy đủ Bot Token và Chat ID để kiểm tra' }, { status: 400 });
            }
            const origin = process.env.APP_URL || request.headers.get('origin') || `${urlObj.protocol}//${request.headers.get('host') || urlObj.host}`;
            const testUrl = `${origin}/htqlbenhvien/error-management/it-requests`;
            const testMsg = `🔔 <b>THÔNG BÁO THỬ NGHIỆM TỪ HỆ THỐNG BVĐK LẠNG SƠN</b>\n\n` +
                `✅ Kết nối Bot Telegram thành công!\n` +
                `📅 Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
                `🔗 <a href="${testUrl}">👉 Bấm vào đây để mở hệ thống Quản lý Yêu cầu</a>`;
            
            const replyMarkup = {
                inline_keyboard: [
                    [
                        { text: '⚡ Mở Quản lý Yêu cầu', url: testUrl }
                    ]
                ]
            };
            
            const result = await sendTelegramMessage(testMsg, chat, token, replyMarkup);
            if (!result.success) {
                return NextResponse.json({ error: result.error || 'Gửi tin nhắn Telegram thất bại' }, { status: 400 });
            }
            return NextResponse.json({ success: true, message: 'Đã gửi tin nhắn thử nghiệm thành công vào Telegram!' });
        }

        if (action === 'TEST_PERSONAL_TELEGRAM') {
            const { personalTelegramId } = body;
            const targetChat = personalTelegramId || (user as any).telegram_id;
            if (!targetChat || !targetChat.trim()) {
                return NextResponse.json({ error: 'Vui lòng nhập Telegram ID cá nhân của bạn để kiểm tra' }, { status: 400 });
            }
            if (!targetBotToken) {
                return NextResponse.json({ error: 'Chưa cấu hình Bot Token cho hệ thống' }, { status: 400 });
            }
            const origin = process.env.APP_URL || request.headers.get('origin') || `${urlObj.protocol}//${request.headers.get('host') || urlObj.host}`;
            const testUrl = `${origin}/htqlbenhvien/error-management/it-requests`;
            const testMsg = `🔔 <b>THÔNG BÁO THỬ NGHIỆM TỚI CÁ NHÂN KỸ THUẬT VIÊN</b>\n\n` +
                `👤 <b>Kỹ thuật viên:</b> ${(user as any).name || user.username}\n` +
                `✅ Kết nối Telegram cá nhân thành công! Khi có phiếu hỗ trợ được giao cho bạn, Bot sẽ nhắn tin riêng cho bạn tại đây.\n` +
                `📅 Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
                `🔗 <a href="${testUrl}">👉 Mở hệ thống Quản lý Yêu cầu</a>`;
            
            const replyMarkup = {
                inline_keyboard: [
                    [
                        { text: '⚡ Mở Quản lý Yêu cầu', url: testUrl }
                    ]
                ]
            };
            
            const result = await sendTelegramMessage(testMsg, targetChat.trim(), targetBotToken, replyMarkup);
            if (!result.success) {
                const errMsg = result.error || '';
                const isBlockedOrNotFound = errMsg.toLowerCase().includes('chat not found') || errMsg.toLowerCase().includes('blocked');
                return NextResponse.json({ 
                    error: isBlockedOrNotFound 
                        ? 'Không tìm thấy cuộc trò chuyện. Bạn vui lòng mở Bot trên Telegram và bấm nút [Start] (Bắt đầu) trước nhé!' 
                        : (errMsg || 'Gửi tin nhắn Telegram riêng thất bại') 
                }, { status: 400 });
            }
            return NextResponse.json({ success: true, message: 'Đã gửi tin nhắn thử nghiệm thành công vào Telegram riêng của bạn!' });
        }

        if (action === 'TEST_ZALO') {
            const { testWebhookUrl } = body;
            const webhookUrl = testWebhookUrl || targetZaloWebhookUrl;
            if (!webhookUrl || !webhookUrl.trim()) {
                return NextResponse.json({ error: 'Vui lòng nhập Webhook URL của Zalo để kiểm tra' }, { status: 400 });
            }
            const origin = process.env.APP_URL || request.headers.get('origin') || `${urlObj.protocol}//${request.headers.get('host') || urlObj.host}`;
            const testUrl = `${origin}/htqlbenhvien/error-management/it-requests`;
            const result = await sendZaloGroupNotification(webhookUrl, {
                title: `Thông báo thử nghiệm [${targetDepartment}]`,
                department: 'Phòng Kỹ thuật / Quản trị viên',
                senderName: (user as any).name || user.username,
                content: `Kết nối Zalo Webhook thành công! Hệ thống sẵn sàng nhận thông báo khi có yêu cầu mới, phản hồi hoặc hối thúc.`,
                ticketUrl: testUrl,
                priority: 'NORMAL'
            });
            if (!result.success) {
                return NextResponse.json({ error: result.error || 'Gửi tin nhắn Zalo thất bại' }, { status: 400 });
            }
            return NextResponse.json({ success: true, message: 'Đã gửi tin nhắn thử nghiệm thành công vào nhóm Zalo!' });
        }

        if (action === 'CLEAR_ASSIGN_REASONS') {
            const isITStaff = user.role === targetDepartment || user.role === 'ADMIN';
            if (!isITStaff) {
                return NextResponse.json({ error: 'Bạn không có quyền thực hiện thao tác này!' }, { status: 403 });
            }
            try {
                const allTickets = await prisma.iTRequest.findMany({
                    where: { targetDepartment },
                    select: { id: true, dynamicFields: true }
                });
                let cleanedCount = 0;
                for (const t of allTickets) {
                    if (t.dynamicFields && typeof t.dynamicFields === 'object') {
                        const fields = { ...(t.dynamicFields as any) };
                        if (fields['Lý do phân việc'] || fields['assignReason']) {
                            delete fields['Lý do phân việc'];
                            delete fields['assignReason'];
                            await prisma.iTRequest.update({
                                where: { id: t.id },
                                data: { dynamicFields: fields }
                            });
                            cleanedCount++;
                        }
                    }
                }
                return NextResponse.json({ 
                    success: true, 
                    count: cleanedCount, 
                    message: `Đã dọn dẹp sạch lý do phân việc của ${cleanedCount} phiếu thành công!` 
                });
            } catch (clearErr: any) {
                console.error('Lỗi khi xóa lý do phân việc:', clearErr);
                return NextResponse.json({ error: 'Lỗi trong quá trình dọn dẹp dữ liệu' }, { status: 500 });
            }
        }

        if (action === 'PING' && xmlErrorId) {
            const errorRecord = await prisma.xmlErrorRecord.findUnique({ where: { id: xmlErrorId } });
            if (!errorRecord || !errorRecord.itRequestId) {
                return NextResponse.json({ error: 'Không tìm thấy phiếu IT đã tạo' }, { status: 400 });
            }

            // Increment ping count
            const newPingCount = (errorRecord.itRequestPingCount || 0) + 1;
            await prisma.xmlErrorRecord.update({
                where: { id: xmlErrorId },
                data: { itRequestPingCount: newPingCount }
            });

            const nguoiBaoName = dynamicFields ? dynamicFields['Người báo'] : (user as any).name || user.username;
            const ghiChu = dynamicFields?.['Ghi chú'] ? `\n\nGhi chú thêm: ${dynamicFields['Ghi chú']}` : '';

            // Add message to ITRequest
            await prisma.iTRequest.update({
                where: { id: errorRecord.itRequestId },
                data: {
                    messages: {
                        create: [
                            {
                                senderId: nguoi_bao_id || user.id,
                                senderName: nguoiBaoName,
                                content: `🔴 KHOA ĐANG HỐI THÚC XỬ LÝ LỖI NÀY! (Gửi lại lần ${newPingCount})${ghiChu}`
                            }
                        ]
                    }
                }
            });

            // Gửi Telegram ping
            const dept = await prisma.department.findUnique({ where: { ma_khoa } });
            const tenKhoa = dept?.ten_khoa || ma_khoa;
            const origin = process.env.APP_URL || request.headers.get('origin') || `${urlObj.protocol}//${request.headers.get('host') || urlObj.host}`;
            const ticketUrl = `${origin}/htqlbenhvien/error-management/it-requests?highlight=${errorRecord.itRequestId}`;

            let telegramMsg = `🔴 <b>HỐI THÚC XỬ LÝ (Lần ${newPingCount})</b>\n\n`;
            telegramMsg += `🏢 <b>Khoa:</b> ${tenKhoa}\n`;
            telegramMsg += `👤 <b>Người báo:</b> ${nguoiBaoName}\n`;
            const isXmlPing = Boolean(ten_loi?.includes('[Hỗ trợ Lỗi Hồ sơ]') || dynamicFields?.['Loại lỗi']?.includes('Lỗi XML') || dynamicFields?.['Loại lỗi']?.includes('Lỗi Chuyên đề') || dynamicFields?.['Mã LK']);
            telegramMsg += `📝 <b>${isXmlPing ? 'Mã LK' : 'Bệnh án'}:</b> ${ma_ba}\n`;
            if (dynamicFields?.['Mã BN']) {
                telegramMsg += `🆔 <b>Mã BN:</b> ${dynamicFields['Mã BN']}\n`;
            }
            telegramMsg += `❌ <b>Lỗi:</b> ${ten_loi}\n`;
            if (dynamicFields?.['Ghi chú']) {
                telegramMsg += `🗒 <b>Ghi chú gửi lại:</b> ${dynamicFields['Ghi chú']}\n`;
            }
            telegramMsg += `\n🔗 <a href="${ticketUrl}">👉 Bấm vào đây để mở và xử lý yêu cầu</a>`;

            const replyMarkup = {
                inline_keyboard: [
                    [
                        { text: '⚡ Mở xử lý yêu cầu ngay', url: ticketUrl }
                    ]
                ]
            };

            if (targetChatId) {
                await sendTelegramMessage(telegramMsg, targetChatId, targetBotToken, replyMarkup);
            }

            // Gửi Zalo hối thúc
            if (targetZaloEnabled && targetZaloWebhookUrl) {
                try {
                    await sendZaloGroupNotification(targetZaloWebhookUrl, {
                        title: `Hối thúc xử lý (Lần ${newPingCount}) [${targetDepartment}]`,
                        department: tenKhoa,
                        senderName: nguoiBaoName,
                        patientCode: ma_ba ? `${isXmlPing ? 'Mã LK' : 'Mã BA'}: ${ma_ba}` : undefined,
                        content: `${ten_loi}${dynamicFields?.['Ghi chú'] ? ` (Ghi chú: ${dynamicFields['Ghi chú']})` : ''}`,
                        ticketUrl,
                        priority: 'URGENT'
                    });
                } catch (zErr) {
                    console.error('Lỗi gửi Zalo ping notification:', zErr);
                }
            }

            return NextResponse.json({ success: true, pingCount: newPingCount });
        }

        if (!ten_loi || !ma_khoa) {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
        }

        const isManager = (user as any).isManager || user.role === 'ADMIN';
        const isITStaff = user.role === targetDepartment || user.role === 'ADMIN';

        // CHỈ ĐƯỢC Ở TRẠNG THÁI 'IN_PROGRESS' (Đang xử lý) khi:
        // 1. Người tạo là nhân viên phòng kỹ thuật/CNTT hoặc ADMIN (isITStaff = true)
        // 2. VÀ người đó CHỦ ĐỘNG BẬT công tắc "⚡ Tôi trực tiếp xử lý" (selfAssign = true)
        // 3. HOẶC là nhiệm vụ tập trung và chọn trạng thái IN_PROGRESS
        const isSelfHandling = isITStaff && Boolean(selfAssign);
        let finalAssignee = assigneeId || null;
        if (isSelfHandling || (isITStaff && Boolean(isFocusTask) && (!assigneeId || assigneeId === user.id))) {
            finalAssignee = user.id;
        } else if (!isManager) {
            finalAssignee = null; // Khoa phòng tuyệt đối không được tự gán người xử lý
        }
        const isFocusAssignment = Boolean(isFocusTask) && Boolean(finalAssignee);

        let initialStatus = isSelfHandling ? 'IN_PROGRESS' : 'PENDING';
        if (isFocusAssignment && body.status) {
            initialStatus = body.status;
        } else if (isFocusAssignment && !body.status) {
            initialStatus = 'IN_PROGRESS'; // Mặc định nhiệm vụ đi khoa phòng/tập trung thì vào việc xử lý luôn
        }

        const newStartedAt = (initialStatus === 'IN_PROGRESS') ? new Date() : null;

        // Tự động cập nhật số điện thoại vào bảng Staff
        let finalSdt = sdt || '';
        if (nguoi_bao_id) {
            try {
                const staffInDb = await prisma.staff.findUnique({ where: { id: nguoi_bao_id } });
                if (sdt && sdt !== staffInDb?.so_dien_thoai) {
                    await prisma.staff.update({
                        where: { id: nguoi_bao_id },
                        data: { so_dien_thoai: sdt }
                    });
                    finalSdt = sdt;
                } else if (!sdt && staffInDb?.so_dien_thoai) {
                    finalSdt = staffInDb.so_dien_thoai;
                }

                // Đảm bảo dynamicFields luôn có SĐT mới nhất
                if (dynamicFields) {
                    dynamicFields['SĐT'] = finalSdt;
                }
            } catch (err) {
                console.error("Lỗi đồng bộ sdt nhân viên:", err);
            }
        }

        // Nếu Khoa không chọn ai (Khoa không có quyền chọn, nên luôn là null)
        if (!finalAssignee && !isSelfHandling) {
            if (assignmentMode === 'C' || assignmentMode === 'D') {
                // Lọc những người có thể nhận việc (đang bật trực ban, không bị khóa nhận việc, không phải người tạo)
                const availableUsers = await prisma.user.findMany({
                    where: {
                        role: targetDepartment,
                        isAvailable: true,
                        autoAssignDisabled: false,
                        id: { not: user.id }
                    },
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        dutyOrder: true
                    },
                    orderBy: {
                        dutyOrder: 'asc'
                    }
                });

                if (availableUsers.length > 0) {
                    // Mốc bắt đầu của ca trực / khung hành chính hiện tại
                    const shiftStart = currentShift.startTime;

                    // Tính tải chi tiết và lấy công việc hiện tại của từng nhân viên
                    const candidatesRaw = await Promise.all(availableUsers.map(async (u) => {
                        const staffName = u.name || u.username;

                        // 0. Lấy chi tiết công việc đang xử lý trực tiếp (IN_PROGRESS) nếu có
                        const currentActiveTask = await prisma.iTRequest.findFirst({
                            where: {
                                assigneeId: u.id,
                                status: 'IN_PROGRESS'
                            },
                            select: {
                                ten_loi: true,
                                ma_khoa: true,
                                isFocusTask: true
                            }
                        });

                        const isBusyOnSite = Boolean(currentActiveTask?.isFocusTask);

                        // 1. Số việc đang xử lý trực tiếp (IN_PROGRESS)
                        const inProgressTasks = currentActiveTask ? 1 : 0;

                        // 2. Số việc dở dang hiện tại (PENDING, IN_PROGRESS, PAUSED)
                        const activeTasks = await prisma.iTRequest.count({
                            where: {
                                assigneeId: u.id,
                                status: { in: ['PENDING', 'IN_PROGRESS', 'PAUSED'] },
                                AND: [
                                    { OR: [{ vendorId: null }, { vendorId: '' }] },
                                    { OR: [{ vendorName: null }, { vendorName: '' }] }
                                ]
                            }
                        });

                        // 3. Tổng số việc đã nhận trong khung giờ/ca trực hiện tại (Khung hành chính cộng dồn cả sáng + chiều)
                        const totalInShift = await prisma.iTRequest.count({
                            where: {
                                assigneeId: u.id,
                                createdAt: { gte: shiftStart },
                                status: { not: 'WAITING_VENDOR' },
                                AND: [
                                    { OR: [{ vendorId: null }, { vendorId: '' }] },
                                    { OR: [{ vendorName: null }, { vendorName: '' }] }
                                ]
                            }
                        });

                        // 4. Thời điểm gần nhất được giao việc (Round-Robin)
                        const lastTicket = await prisma.iTRequest.findFirst({
                            where: { assigneeId: u.id },
                            orderBy: { createdAt: 'desc' },
                            select: { createdAt: true }
                        });

                        return {
                            id: u.id,
                            name: staffName,
                            isBusyOnSite,
                            currentActiveTask,
                            dutyOrder: u.dutyOrder ?? 999,
                            inProgressTasks,
                            activeTasks,
                            totalInShift,
                            lastAssignedTime: lastTicket ? lastTicket.createdAt.getTime() : 0
                        };
                    }));

                    // Loại bỏ những kỹ thuật viên đang bận đi hiện trường / việc kéo dài
                    const candidates = candidatesRaw.filter(c => !c.isBusyOnSite);

                    if (candidates.length > 0) {
                        // Lọc những người chưa vượt trần maxConcurrentTasks
                        const eligible = candidates.filter(c => c.activeTasks < targetMaxConcurrentTasks);
                        const pool = eligible.length > 0 ? eligible : candidates; // Nếu tất cả đều chạm trần thì lấy từ danh sách chung

                        // Sắp xếp ứng viên đa tầng:
                        // 1. Ưu tiên người không có việc IN_PROGRESS (0 < 1)
                        // 2. Chế độ D: Cân bằng tổng việc trong khung (totalInShift) -> ít việc dở dang (activeTasks)
                        //    Chế độ C: Ít việc dở dang (activeTasks) -> Cân bằng tổng việc (totalInShift)
                        // 3. Thứ tự ưu tiên dutyOrder trên bảng trực ban (1 -> 2 -> 3...)
                        // 4. Xoay vòng Round-Robin: Ai lâu nhất chưa nhận việc mới (lastAssignedTime nhỏ hơn)
                        pool.sort((a, b) => {
                            if (a.inProgressTasks !== b.inProgressTasks) {
                                return a.inProgressTasks - b.inProgressTasks;
                            }
                            if (assignmentMode === 'D') {
                                if (a.totalInShift !== b.totalInShift) {
                                    return a.totalInShift - b.totalInShift;
                                }
                                if (a.activeTasks !== b.activeTasks) {
                                    return a.activeTasks - b.activeTasks;
                                }
                            } else {
                                if (a.activeTasks !== b.activeTasks) {
                                    return a.activeTasks - b.activeTasks;
                                }
                                if (a.totalInShift !== b.totalInShift) {
                                    return a.totalInShift - b.totalInShift;
                                }
                            }
                            if (a.dutyOrder !== b.dutyOrder) {
                                return a.dutyOrder - b.dutyOrder;
                            }
                            return a.lastAssignedTime - b.lastAssignedTime;
                        });

                        finalAssignee = pool[0].id;

                        // Tạo lý do phân việc chi tiết nếu bật cấu hình
                        if (targetSaveAssignReason) {
                            const winner = pool[0];
                            const modeTitle = assignmentMode === 'D' ? 'Cân bằng công bằng (2 tầng)' : 'Phản ứng nhanh (Tốc độ)';
                            
                            const otherStatusLines = candidatesRaw
                                .filter(c => c.id !== winner.id)
                                .map(c => {
                                    if (c.isBusyOnSite && c.currentActiveTask) {
                                        return ` • ${c.name}: Đang đi khoa phòng xử lý "${c.currentActiveTask.ten_loi}" (${c.currentActiveTask.ma_khoa || 'Khoa'}), tổng ca: ${c.totalInShift} việc`;
                                    }
                                    if (c.currentActiveTask) {
                                        return ` • ${c.name}: Đang xử lý "${c.currentActiveTask.ten_loi}" (${c.currentActiveTask.ma_khoa || 'Khoa'}), tổng ca: ${c.totalInShift} việc`;
                                    }
                                    return ` • ${c.name}: Dở dang ${c.activeTasks} việc, tổng ca: ${c.totalInShift} việc`;
                                });

                            const reasonLines = [
                                `🤖 CĂN CỨ TỰ ĐỘNG PHÂN VIỆC [${modeTitle.toUpperCase()}]`,
                                `─────────────────────────────────────`,
                                `✅ ĐƯỢC CHỌN: ${winner.name}`,
                                ` • Trạng thái: ${winner.inProgressTasks === 0 ? 'Đang rảnh tay (0 việc đang xử lý)' : `${winner.inProgressTasks} việc đang xử lý`}`,
                                ` • Tải trong ca: Đã nhận ${winner.totalInShift} việc (${assignmentMode === 'D' ? 'thấp nhất ca' : 'tổng ca'})`,
                                ` • Tồn đọng: ${winner.activeTasks} việc dở dang`,
                                ` • Trực ban: Đến lượt xoay vòng Round-Robin`,
                                ...(otherStatusLines.length > 0 ? [
                                    `\n📊 TÌNH TRẠNG CÁC NHÂN VIÊN KHÁC LÚC PHÂN VIỆC:`,
                                    ...otherStatusLines
                                ] : []),
                                `─────────────────────────────────────`,
                                `👉 Quyết định: Phân công cho ${winner.name} là tối ưu và công bằng nhất.`
                            ];

                            const autoReason = reasonLines.join('\n');
                            if (!dynamicFields) dynamicFields = {};
                            dynamicFields['Lý do phân việc'] = autoReason;
                            dynamicFields['assignReason'] = autoReason;
                        }
                    }
                }
            } else {
                // Cách A (Tự nhận) và Cách B (Admin gán thủ công) -> Khởi tạo không có ai
                finalAssignee = null;
            }
        }

        // Nếu tạo phiếu với trạng thái IN_PROGRESS trực tiếp cho nhân viên, tự động tạm dừng việc IN_PROGRESS cũ
        if (initialStatus === 'IN_PROGRESS' && finalAssignee) {
            try {
                const existingInProgress = await prisma.iTRequest.findMany({
                    where: {
                        assigneeId: finalAssignee,
                        status: 'IN_PROGRESS'
                    }
                });
                for (const oldTicket of existingInProgress) {
                    await prisma.iTRequest.update({
                        where: { id: oldTicket.id },
                        data: { status: 'PAUSED' }
                    });
                    await prisma.requestMessage.create({
                        data: {
                            itRequestId: oldTicket.id,
                            senderId: user.id,
                            senderName: (user as any).name || user.username || 'Hệ thống',
                            content: `⏸️ [TỰ ĐỘNG TẠM DỪNG]: Tạm dừng xử lý do bắt đầu tạo và xử lý việc mới: ${ten_loi}`,
                            isSystem: true
                        }
                    });
                }
            } catch (pErr) {
                console.error('Lỗi tự động tạm dừng việc cũ khi tạo việc mới:', pErr);
            }
        }

        const newRequest = await prisma.iTRequest.create({
            data: {
                targetDepartment,
                ma_ba: ma_ba || null,
                category: category || 'SOFTWARE',
                ten_loi,
                ma_khoa,
                assigneeId: finalAssignee,
                dynamicFields: dynamicFields || {},
                status: initialStatus,
                startedAt: newStartedAt,
                isFocusTask: Boolean(isFocusTask),
                messages: {
                    create: [
                        {
                            senderId: nguoi_bao_id || user.id,
                            senderName: dynamicFields?.['Người báo'] || (user as any).name || user.username,
                            content: ten_loi,
                            imageUrl: dynamicFields?.['Hình ảnh đính kèm'] && dynamicFields['Hình ảnh đính kèm']?.length > 0 ? dynamicFields['Hình ảnh đính kèm'][0] : null,
                            readBy: [user.id]
                        }
                    ]
                }
            }
        });

        // Nếu là nhiệm vụ tập trung -> Tự động đưa nhân viên vào trạng thái "Tập trung việc riêng" (Miễn chia việc tự động)
        if (isFocusAssignment && finalAssignee) {
            const taskReason = focusReason || (dynamicFields && dynamicFields['Lý do tập trung']) || `Tập trung: ${ten_loi.slice(0, 80)}`;
            try {
                await prisma.user.update({
                    where: { id: finalAssignee },
                    data: {
                        autoAssignDisabled: true,
                        focusReason: taskReason
                    }
                });
            } catch (err) {
                console.error("Lỗi tự động kích hoạt chế độ tập trung cho nhân viên:", err);
            }
        }

        // Trigger SSE Notification (Chỉ gửi về máy có maKhoa tương ứng)
        try {
            await emitEvent(
                'IT_REQUEST_NEW', 
                {
                    title: 'Yêu cầu hỗ trợ mới',
                    body: `Khoa: ${ma_khoa} - Lỗi: ${ten_loi}`,
                    url: `/error-management/it-requests?highlight=${newRequest.id}`, // Placeholder link
                    context: {
                        ma_khoa: ma_khoa,
                        ten_loi: ten_loi,
                        id: newRequest.id
                    }
                },
                ma_khoa // Phân luồng về đúng khoa này
            );
        } catch (e) {
            console.error('Lỗi khi gửi SSE Notification', e);
        }

        // Lấy tên Khoa nếu có
        const dept = await prisma.department.findUnique({ where: { ma_khoa } });
        const tenKhoa = dept?.ten_khoa || ma_khoa;

        // Lấy thông tin người nhận (Tên và Telegram ID)
        let assigneeInfo = 'Chờ tiếp nhận';
        let assigneeUser = null;
        let isNoStaffAlert = false;

        if (finalAssignee) {
            assigneeUser = await prisma.user.findUnique({ where: { id: finalAssignee } });
            if (assigneeUser) {
                assigneeInfo = assigneeUser.name || assigneeUser.username;
                if (assigneeUser.telegram_id) {
                    assigneeInfo += assigneeUser.telegram_id.startsWith('@') ? ` (${assigneeUser.telegram_id})` : '';
                }
            } else {
                assigneeInfo = 'Đã phân công';
            }
        } else if (targetNoStaffWarningEnabled) {
            isNoStaffAlert = true;
            assigneeInfo = '⚠️ CHƯA CÓ NGƯỜI TIẾP NHẬN';
        }

        // Tạo thông điệp Telegram
        let telegramMsg = '';
        if (isNoStaffAlert) {
            telegramMsg = `🚨 <b>[CẢNH BÁO: CHƯA CÓ KỸ THUẬT VIÊN NHẬN VIỆC]</b>\n\n` +
                `⚠️ <b>Tình trạng:</b> Hiện tại KHÔNG CÓ KỸ THUẬT VIÊN nào đang nhận việc / trực ban (${currentShift.shiftName})!\n` +
                `👉 Đề nghị kỹ thuật viên trực ban kiểm tra và bấm nút nhận việc ngay!\n\n`;
        } else if (isFocusAssignment) {
            telegramMsg = `👑 <b>NHIỆM VỤ TẬP TRUNG DO LÃNH ĐẠO GIAO</b>\n\n`;
        } else {
            telegramMsg = `🚨 <b>YÊU CẦU HỖ TRỢ MỚI</b>\n\n`;
        }
        telegramMsg += `🏢 <b>Khoa:</b> ${tenKhoa}\n`;
        telegramMsg += `👤 <b>Người báo:</b> ${dynamicFields['Người báo'] || 'Không rõ'} - <b>SĐT:</b> ${finalSdt || 'Không có'}\n`;
        telegramMsg += `📌 <b>Loại sự cố:</b> ${category === 'SOFTWARE' ? 'Phần Mềm / Nghiệp Vụ' : 'Phần Cứng / Sửa Chữa'}\n`;

        if (category === 'SOFTWARE') {
            const isXmlNew = Boolean(ten_loi?.includes('[Hỗ trợ Lỗi Hồ sơ]') || dynamicFields?.['Loại lỗi']?.includes('Lỗi XML') || dynamicFields?.['Loại lỗi']?.includes('Lỗi Chuyên đề') || dynamicFields?.['Mã LK']);
            telegramMsg += `📝 <b>${isXmlNew ? 'Mã LK' : 'Bệnh án'}:</b> ${ma_ba}\n`;
            if (dynamicFields['Mã BN']) {
                telegramMsg += `🆔 <b>Mã BN:</b> ${dynamicFields['Mã BN']}\n`;
            }
            if (dynamicFields['Trạng thái BA']) {
                telegramMsg += `📊 <b>Trạng thái:</b> ${dynamicFields['Trạng thái BA']}\n`;
            }
        }

        telegramMsg += `❌ <b>Lỗi:</b> ${ten_loi}\n`;

        if (dynamicFields['Ghi chú']) {
            telegramMsg += `🗒 <b>Ghi chú:</b> ${dynamicFields['Ghi chú']}\n`;
        }

        // Tạo link mở trực tiếp yêu cầu
        const origin = process.env.APP_URL || request.headers.get('origin') || `${urlObj.protocol}//${request.headers.get('host') || urlObj.host}`;
        const ticketUrl = `${origin}/htqlbenhvien/error-management/it-requests?highlight=${newRequest.id}`;

        telegramMsg += `\n🧑‍💻 <b>Người nhận:</b> ${assigneeInfo}\n`;
        telegramMsg += `\n🔗 <a href="${ticketUrl}">👉 Bấm vào đây để mở và tiếp nhận yêu cầu</a>`;

        const replyMarkup = {
            inline_keyboard: [
                [
                    { text: '⚡ Mở xử lý yêu cầu', url: ticketUrl }
                ]
            ]
        };

        // Bắn Telegram vào Group chung
        if (targetChatId) {
            await sendTelegramMessage(telegramMsg, targetChatId, targetBotToken, replyMarkup);
        }

        // Bắn Telegram trực tiếp (Direct Message) cho Nhân viên CNTT nếu họ có điền ID Telegram dạng số
        if (assigneeUser && assigneeUser.telegram_id && /^-?\d+$/.test(assigneeUser.telegram_id)) {
            const dmMsg = `🔔 <b>BẠN VỪA ĐƯỢC GIAO MỘT VIỆC MỚI:</b>\n\n${telegramMsg}`;
            await sendTelegramMessage(dmMsg, assigneeUser.telegram_id, targetBotToken, replyMarkup);
        }

        // Bắn Zalo vào Group chung nếu bật
        if (targetZaloEnabled && targetZaloWebhookUrl) {
            try {
                const isXmlTicket = category === 'SOFTWARE' && Boolean(ten_loi?.includes('[Hỗ trợ Lỗi Hồ sơ]') || dynamicFields?.['Loại lỗi']?.includes('Lỗi XML') || dynamicFields?.['Loại lỗi']?.includes('Lỗi Chuyên đề') || dynamicFields?.['Mã LK']);
                const zaloTitle = isNoStaffAlert 
                    ? `🚨 [CẢNH BÁO: CHƯA CÓ NGƯỜI NHẬN VIỆC] [${targetDepartment}]`
                    : `Yêu cầu mới [${targetDepartment}]`;
                const zaloContent = isNoStaffAlert
                    ? `⚠️ CẢNH BÁO: Hiện không có ai nhận việc! Lỗi: ${ten_loi}`
                    : `${ten_loi}${dynamicFields['Ghi chú'] ? ` (${dynamicFields['Ghi chú']})` : ''}`;

                await sendZaloGroupNotification(targetZaloWebhookUrl, {
                    title: zaloTitle,
                    department: tenKhoa,
                    senderName: dynamicFields['Người báo'] || (user as any).name || user.username,
                    phone: dynamicFields['Số điện thoại'] || (user as any).phone || '',
                    patientCode: ma_ba ? `${isXmlTicket ? 'Mã LK' : 'Mã BA'}: ${ma_ba}` : undefined,
                    content: zaloContent,
                    ticketUrl,
                    priority: isNoStaffAlert ? 'URGENT' : 'NORMAL'
                });
            } catch (zErr) {
                console.error('Lỗi gửi Zalo notification khi tạo ticket:', zErr);
            }
        }

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
                    const title = finalAssignee ? '🔔 Bạn được giao một việc mới!' : `🚨 Yêu cầu mới từ ${tenKhoa}`;
                    const body = `Lỗi: ${ten_loi}`;
                    await sendPushNotification(tokens, title, body, { itRequestId: newRequest.id });
                }
            }
        } catch (pushErr) {
            console.error('Error sending push notification in it-requests POST:', pushErr);
        }

        // Lưu ngược itRequestId vào XmlErrorRecord nếu có xmlErrorId
        if (xmlErrorId) {
            await prisma.xmlErrorRecord.update({
                where: { id: xmlErrorId },
                data: {
                    itRequestId: newRequest.id,
                    itRequestPingCount: 1
                }
            });
        }

        const warningMessage = (!finalAssignee && targetNoStaffWarningEnabled) ? targetNoStaffWarningMessage : null;

        return NextResponse.json({
            ...newRequest,
            hasAssignee: Boolean(finalAssignee),
            warningMessage
        });
    } catch (error: any) {
        console.error('Error POST it-requests:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { 
            id, status, it_note, assigneeId, transferToId, action, ten_loi, category, dynamicFields,
            vendorId, vendorName, vendorTicketCode, vendorExpectedReturnAt, it_images, isFocusTask,
            pauseReason, keepFocusTaskRunning
        } = body;

        if (!id) return NextResponse.json({ error: 'Thiếu ID' }, { status: 400 });

        // Ai cũng có thể update, nhưng Khoa chỉ có thể update của khoa họ, CNTT/Admin update thoải mái
        const ticket = await prisma.iTRequest.findUnique({ where: { id } });
        if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const isDepartmentUser = !['ADMIN', 'CNTT', 'VTYT', 'HCQT'].includes(user.role);
        if (isDepartmentUser && ticket.ma_khoa !== user.ma_khoa) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const isManager = (user as any).isManager || user.role === 'ADMIN';

        if (action === 'EDIT_REQUEST') {
            if (ticket.status !== 'PENDING') {
                return NextResponse.json({ error: 'Chỉ có thể sửa yêu cầu khi đang ở trạng thái Chờ xử lý' }, { status: 400 });
            }

            // Hợp nhất dynamicFields cũ và mới để giữ lại 'Hình ảnh đính kèm' nếu có
            const mergedDynamicFields = {
                ...(ticket.dynamicFields as any || {}),
                ...(dynamicFields || {})
            };

            const updated = await prisma.iTRequest.update({
                where: { id },
                data: {
                    ten_loi: ten_loi || ticket.ten_loi,
                    category: category || ticket.category,
                    dynamicFields: mergedDynamicFields
                }
            });
            return NextResponse.json(updated);
        }

        if (action === 'ACCEPT_TRANSFER') {
            try {
                const existingInProgress = await prisma.iTRequest.findMany({
                    where: {
                        assigneeId: user.id,
                        status: 'IN_PROGRESS',
                        id: { not: id },
                        ...(keepFocusTaskRunning ? { isFocusTask: false } : {})
                    }
                });
                for (const oldTicket of existingInProgress) {
                    await prisma.iTRequest.update({
                        where: { id: oldTicket.id },
                        data: { status: 'PAUSED' }
                    });
                    await prisma.requestMessage.create({
                        data: {
                            itRequestId: oldTicket.id,
                            senderId: user.id,
                            senderName: (user as any).name || user.username || 'Hệ thống',
                            content: `⏸️ [TỰ ĐỘNG TẠM DỪNG]: Tạm dừng xử lý do tiếp nhận chuyển giao phiếu khác: #${id.slice(-6)} (${ticket.ten_loi})`,
                            isSystem: true
                        }
                    });
                }
            } catch (err) {}

            const updated = await prisma.iTRequest.update({
                where: { id },
                data: {
                    assigneeId: user.id,
                    transferToId: null,
                    transferFromId: null,
                    status: 'IN_PROGRESS',
                    startedAt: ticket.startedAt || new Date()
                }
            });
            return NextResponse.json(updated);
        }

        if (action === 'REJECT_TRANSFER') {
            const updated = await prisma.iTRequest.update({
                where: { id },
                data: {
                    transferToId: null,
                    transferFromId: null,
                    status: 'IN_PROGRESS'
                }
            });
            return NextResponse.json(updated);
        }

        if (action === 'TRANSFER') {
            if (!transferToId) return NextResponse.json({ error: 'Missing transferToId' }, { status: 400 });
            if (!isManager && ticket.assigneeId !== user.id) {
                return NextResponse.json({ error: 'Không có quyền chuyển giao phiếu của người khác' }, { status: 403 });
            }
            const updated = await prisma.iTRequest.update({
                where: { id },
                data: {
                    transferToId: transferToId,
                    transferFromId: user.id,
                    status: 'TRANSFERRING',
                    it_note: it_note !== undefined ? it_note : ticket.it_note,
                }
            });
            return NextResponse.json(updated);
        }

        let newStartedAt = ticket.startedAt;
        let newResolvedAt = ticket.resolvedAt;
        const newStatus = status !== undefined ? status : ticket.status;
        const finalAssigneeId = assigneeId !== undefined ? assigneeId : ticket.assigneeId;

        // Phân quyền đổi assignee (Giao việc / Tự nhận)
        if (assigneeId !== undefined && assigneeId !== ticket.assigneeId) {
            const isUnassigned = !ticket.assigneeId;
            const isMyTicket = ticket.assigneeId === user.id;

            if (!isManager) {
                if (isUnassigned && assigneeId !== user.id) {
                    return NextResponse.json({ error: 'Bạn chỉ có thể tự nhận việc, không thể giao cho người khác' }, { status: 403 });
                }
                if (!isUnassigned && !isMyTicket) {
                    return NextResponse.json({ error: 'Bạn không có quyền thay đổi người xử lý của phiếu này' }, { status: 403 });
                }
            }
        }

        // Nhiệm vụ của ai người đó mới được hoàn thành (trừ Quản trị viên/Lãnh đạo khi cần can thiệp)
        if (newStatus === 'RESOLVED' && ticket.status !== 'RESOLVED' && !isManager && ticket.assigneeId !== user.id) {
            return NextResponse.json({ error: 'Nhiệm vụ của ai người đó mới được hoàn thành!' }, { status: 403 });
        }

        // Đơn tác vụ: Nếu chuyển sang IN_PROGRESS, tự động tạm dừng (PAUSED) tất cả các việc IN_PROGRESS khác của nhân viên này
        // (Nếu keepFocusTaskRunning = true thì ngoại lệ giữ các việc tập trung isFocusTask = true tiếp tục chạy song song)
        if (newStatus === 'IN_PROGRESS' && finalAssigneeId) {
            try {
                const existingInProgress = await prisma.iTRequest.findMany({
                    where: {
                        assigneeId: finalAssigneeId,
                        status: 'IN_PROGRESS',
                        id: { not: id },
                        ...(keepFocusTaskRunning ? { isFocusTask: false } : {})
                    }
                });
                for (const oldTicket of existingInProgress) {
                    await prisma.iTRequest.update({
                        where: { id: oldTicket.id },
                        data: { status: 'PAUSED' }
                    });
                    await prisma.requestMessage.create({
                        data: {
                            itRequestId: oldTicket.id,
                            senderId: user.id,
                            senderName: (user as any).name || user.username || 'Hệ thống',
                            content: `⏸️ [TỰ ĐỘNG TẠM DỪNG]: Tạm dừng xử lý do chuyển sang thực hiện yêu cầu khác: #${id.slice(-6)} (${ticket.ten_loi})`,
                            isSystem: true
                        }
                    });
                }
            } catch (pErr) {
                console.error('Lỗi tự động tạm dừng việc cũ trong PUT:', pErr);
            }
        }

        if (newStatus === 'IN_PROGRESS' && ticket.status !== 'IN_PROGRESS' && !newStartedAt) {
            newStartedAt = new Date();
        }
        if (newStatus === 'RESOLVED' && ticket.status !== 'RESOLVED' && !newResolvedAt) {
            newResolvedAt = new Date();
        }

        let vendorSentAt = ticket.vendorSentAt;
        if (newStatus === 'WAITING_VENDOR' && ticket.status !== 'WAITING_VENDOR') {
            vendorSentAt = new Date();
        }

        const updated = await prisma.iTRequest.update({
            where: { id },
            data: {
                status: newStatus,
                it_note: it_note !== undefined ? it_note : ticket.it_note,
                dynamicFields: (newStatus === 'PAUSED' && pauseReason) 
                    ? { ...(ticket.dynamicFields as any || {}), 'Lý do tạm dừng': pauseReason, pauseReason }
                    : (dynamicFields !== undefined ? dynamicFields : ticket.dynamicFields),
                assigneeId: assigneeId !== undefined ? assigneeId : ticket.assigneeId,
                isFocusTask: isFocusTask !== undefined ? Boolean(isFocusTask) : ticket.isFocusTask,
                startedAt: newStartedAt,
                resolvedAt: newResolvedAt,
                vendorId: vendorId !== undefined ? vendorId : ticket.vendorId,
                vendorName: vendorName !== undefined ? vendorName : ticket.vendorName,
                vendorTicketCode: vendorTicketCode !== undefined ? vendorTicketCode : ticket.vendorTicketCode,
                vendorSentAt: vendorSentAt,
                vendorExpectedReturnAt: vendorExpectedReturnAt !== undefined ? (vendorExpectedReturnAt ? new Date(vendorExpectedReturnAt) : null) : ticket.vendorExpectedReturnAt,
                it_images: it_images !== undefined ? it_images : ticket.it_images,
            }
        });

        // Xử lý khi thay đổi cờ "Đi khoa phòng / Xử lý kéo dài" (isFocusTask)
        if (isFocusTask !== undefined && Boolean(isFocusTask) !== ticket.isFocusTask) {
            const currentAssignee = updated.assigneeId || user.id;
            try {
                if (Boolean(isFocusTask) === true) {
                    await prisma.user.update({
                        where: { id: currentAssignee },
                        data: {
                            autoAssignDisabled: true,
                            focusReason: `Đi khoa phòng: ${ticket.ten_loi.slice(0, 80)}`
                        }
                    });
                    await prisma.requestMessage.create({
                        data: {
                            itRequestId: id,
                            senderId: user.id,
                            senderName: (user as any).name || user.username || 'Hệ thống',
                            content: `🚶 [ĐI KHOA PHÒNG / KÉO DÀI]: Đã bật chế độ xử lý tại hiện trường. Tạm ngưng nhận chia việc tự động cho kỹ thuật viên này.`,
                            isSystem: true
                        }
                    });
                } else {
                    const remainingTasks = await prisma.iTRequest.count({
                        where: {
                            assigneeId: currentAssignee,
                            isFocusTask: true,
                            status: { in: ['PENDING', 'IN_PROGRESS', 'TRANSFERRING'] },
                            id: { not: id }
                        }
                    });
                    if (remainingTasks === 0) {
                        await prisma.user.update({
                            where: { id: currentAssignee },
                            data: {
                                autoAssignDisabled: false,
                                focusReason: null
                            }
                        });
                    }
                    await prisma.requestMessage.create({
                        data: {
                            itRequestId: id,
                            senderId: user.id,
                            senderName: (user as any).name || user.username || 'Hệ thống',
                            content: `🏢 [TRỞ LẠI VĂN PHÒNG]: Đã tắt chế độ đi khoa phòng. Kỹ thuật viên sẵn sàng nhận việc tự động.`,
                            isSystem: true
                        }
                    });
                }
            } catch (fErr) {
                console.error('Lỗi cập nhật autoAssignDisabled khi đổi isFocusTask:', fErr);
            }
        }

        // Tạo tin nhắn thông báo khi Tạm dừng xử lý (PAUSED)
        if (newStatus === 'PAUSED' && ticket.status !== 'PAUSED') {
            try {
                const finalPauseReason = pauseReason || it_note;
                const reasonText = finalPauseReason ? `Lý do: ${finalPauseReason}` : 'Kỹ thuật viên tạm dừng xử lý công việc';
                await prisma.requestMessage.create({
                    data: {
                        itRequestId: id,
                        senderId: user.id,
                        senderName: (user as any).name || user.username || 'Kỹ thuật viên',
                        content: `⏸️ [TẠM DỪNG XỬ LÝ]: ${reasonText}`,
                        isSystem: true
                    }
                });
            } catch (pErr) {
                console.error('Lỗi tạo tin nhắn tạm dừng:', pErr);
            }
        }

        // Tạo tin nhắn thông báo khi Tiếp tục xử lý (RESUME từ PAUSED sang IN_PROGRESS)
        if (newStatus === 'IN_PROGRESS' && ticket.status === 'PAUSED') {
            try {
                await prisma.requestMessage.create({
                    data: {
                        itRequestId: id,
                        senderId: user.id,
                        senderName: (user as any).name || user.username || 'Kỹ thuật viên',
                        content: `▶️ [TIẾP TỤC XỬ LÝ]: Kỹ thuật viên tiếp tục thực hiện yêu cầu này.`,
                        isSystem: true
                    }
                });
            } catch (pErr) {
                console.error('Lỗi tạo tin nhắn tiếp tục:', pErr);
            }
        }

        // Tạo tin nhắn thông báo vào cuộc hội thoại khi chuyển trạng thái WAITING_VENDOR
        if (newStatus === 'WAITING_VENDOR' && ticket.status !== 'WAITING_VENDOR') {
            try {
                const partnerName = vendorName || ticket.vendorName || 'Đối tác ngoài';
                const formattedDate = vendorExpectedReturnAt ? new Date(vendorExpectedReturnAt).toLocaleDateString('vi-VN') : 'Chưa có ngày hẹn';
                const notePart = it_note ? `\n- Ghi chú kỹ thuật: ${it_note}` : '';
                const codePart = vendorTicketCode ? `\n- Mã phiếu/Ticket đối tác: ${vendorTicketCode}` : '';
                const msgContent = `🏢 [CHUYỂN ĐỐI TÁC NGOÀI]\n- Đơn vị tiếp nhận: ${partnerName}\n- Hẹn trả dự kiến: ${formattedDate}${codePart}${notePart}`;
                
                await prisma.requestMessage.create({
                    data: {
                        itRequestId: id,
                        senderId: user.id,
                        senderName: user.name || user.username || 'Kỹ thuật viên',
                        content: msgContent,
                        imageUrl: (Array.isArray(it_images) && it_images.length > 0) ? it_images[0] : null
                    }
                });
            } catch (msgErr) {
                console.error('Lỗi tự động tạo tin nhắn chuyển đối tác:', msgErr);
            }
        }

        // Đồng bộ trạng thái về bảng XmlErrorRecord nếu IT đánh dấu Hoàn thành
        if (newStatus === 'RESOLVED' && ticket.status !== 'RESOLVED') {
            const errorRecord = await prisma.xmlErrorRecord.findFirst({ where: { itRequestId: id } });
            if (errorRecord) {
                await prisma.xmlErrorRecord.update({
                    where: { id: errorRecord.id },
                    data: {
                        status: 'EXPLAINED',
                        itResolved: true,
                        adminNote: it_note !== undefined ? `[CNTT] ${it_note}` : (ticket.it_note ? `[CNTT] ${ticket.it_note}` : 'CNTT đã xử lý')
                    }
                });
            }

            // Nếu phiếu này là nhiệm vụ tập trung (isFocusTask: true)
            // Kiểm tra xem nhân viên này còn phiếu nhiệm vụ tập trung nào chưa hoàn thành không:
            const targetAssigneeId = updated.assigneeId;
            if (ticket.isFocusTask && targetAssigneeId) {
                try {
                    const remainingFocusTasks = await prisma.iTRequest.count({
                        where: {
                            assigneeId: targetAssigneeId,
                            isFocusTask: true,
                            status: { in: ['PENDING', 'IN_PROGRESS', 'TRANSFERRING'] },
                            id: { not: id }
                        }
                    });
                    if (remainingFocusTasks === 0) {
                        // Tự động mở lại trạng thái nhận việc bình thường cho nhân viên
                        await prisma.user.update({
                            where: { id: targetAssigneeId },
                            data: {
                                autoAssignDisabled: false,
                                focusReason: null
                            }
                        });
                    }
                } catch (focusErr) {
                    console.error("Lỗi tự động mở khóa trạng thái nhận việc cho nhân viên:", focusErr);
                }
            }
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error PUT it-requests:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const targetDepartment = searchParams.get('targetDepartment');

        // Quyền xóa tất cả chỉ dành cho ADMIN
        if (action === 'delete_all') {
            if (user.role !== 'ADMIN') {
                return NextResponse.json({ error: 'Chỉ Admin mới có quyền xóa tất cả' }, { status: 403 });
            }

            let whereClause: any = {};
            if (targetDepartment) whereClause.targetDepartment = targetDepartment;

            // Xóa tất cả file ảnh vật lý của các ticket
            const allTickets = await prisma.iTRequest.findMany({
                where: whereClause,
                select: { dynamicFields: true }
            });

            for (const ticket of allTickets) {
                if (ticket.dynamicFields) {
                    const fields: any = ticket.dynamicFields;
                    const images = fields['Hình ảnh đính kèm'];
                    if (Array.isArray(images)) {
                        for (const url of images) {
                            try {
                                if (typeof url === 'string' && url.startsWith('/uploads/tickets/')) {
                                    const filename = url.replace('/uploads/tickets/', '');
                                    const filepath = join(process.cwd(), 'public', 'uploads', 'tickets', filename);
                                    await unlink(filepath).catch(() => { });
                                }
                            } catch (e) {
                                // Bỏ qua lỗi xóa file
                            }
                        }
                    }
                }
            }

            await prisma.iTRequest.deleteMany({
                where: whereClause
            });
            return NextResponse.json({ success: true });
        }

        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Thiếu ID' }, { status: 400 });

        const ticket = await prisma.iTRequest.findUnique({ where: { id } });
        if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const isDepartmentUser = !['ADMIN', 'CNTT', 'VTYT', 'HCQT'].includes(user.role);
        if (isDepartmentUser && ticket.ma_khoa !== user.ma_khoa) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (ticket.status === 'IN_PROGRESS') {
            return NextResponse.json({ error: 'Không thể xóa yêu cầu đang xử lý' }, { status: 400 });
        }

        // Xóa các file ảnh vật lý đính kèm nếu có
        if (ticket.dynamicFields) {
            const fields: any = ticket.dynamicFields;
            const images = fields['Hình ảnh đính kèm'];
            if (Array.isArray(images)) {
                for (const url of images) {
                    try {
                        if (typeof url === 'string' && url.startsWith('/uploads/tickets/')) {
                            const filename = url.replace('/uploads/tickets/', '');
                            const filepath = join(process.cwd(), 'public', 'uploads', 'tickets', filename);
                            await unlink(filepath);
                        }
                    } catch (e) {
                        console.error('Không thể xóa file ảnh:', url);
                    }
                }
            }
        }

        await prisma.iTRequest.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error DELETE it-requests:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
