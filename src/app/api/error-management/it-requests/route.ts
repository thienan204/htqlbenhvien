import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/actions/auth';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { sendPushNotification } from '@/lib/firebase-admin';

const prisma = new PrismaClient();

// Telegram Bot details (nên để ở .env)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(message: string, chatId?: string, botToken?: string) {
    const targetBotToken = botToken || process.env.TELEGRAM_BOT_TOKEN;
    const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
    if (!targetBotToken || !targetChatId) return;
    try {
        await fetch(`https://api.telegram.org/bot${targetBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: targetChatId,
                text: message,
                parse_mode: 'HTML'
            })
        });
    } catch (err) {
        console.error('Lỗi gửi Telegram:', err);
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

        // Phân quyền: KHOA chỉ thấy phiếu của mình
        if (user.role === 'KHOA') {
            if (!user.ma_khoa) return NextResponse.json({ error: 'Tài khoản chưa gán khoa' }, { status: 403 });
            whereClause.ma_khoa = user.ma_khoa;
        }

        if (statusFilter) {
            whereClause.status = statusFilter;
        }

        const requests = await prisma.iTRequest.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });

        // Lấy danh sách tên người xử lý để map ID -> Tên
        const assignees = await prisma.user.findMany({
            where: { role: { in: ['CNTT', 'VTYT', 'HCQT', 'ADMIN'] } },
            select: { id: true, name: true, username: true }
        });
        const assigneeMap = assignees.reduce((acc: any, curr) => {
            acc[curr.id] = curr.name || curr.username;
            return acc;
        }, {});

        const enrichedRequests = requests.map(req => ({
            ...req,
            assigneeName: req.assigneeId ? assigneeMap[req.assigneeId] : 'Chưa phân công',
            transferToName: req.transferToId ? assigneeMap[req.transferToId] : null
        }));

        return NextResponse.json(enrichedRequests);
    } catch (error) {
        console.error('Error GET it-requests:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { ma_ba, ten_loi, assigneeId, dynamicFields, category, nguoi_bao_id, sdt, xmlErrorId, action, targetDepartment = 'CNTT' } = body;

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

        if (configRule && configRule.logicConfig) {
            const config: any = configRule.logicConfig;
            if (!Array.isArray(config)) {
                assignmentMode = config.assignmentMode || 'A';
                if (config.telegramBotToken) targetBotToken = config.telegramBotToken;
                if (config.telegramChatId) targetChatId = config.telegramChatId;
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
            let telegramMsg = `🔴 <b>HỐI THÚC XỬ LÝ (Lần ${newPingCount})</b>\n\n`;
            telegramMsg += `🏢 <b>Khoa:</b> ${tenKhoa}\n`;
            telegramMsg += `👤 <b>Người báo:</b> ${nguoiBaoName}\n`;
            telegramMsg += `📝 <b>Bệnh án:</b> ${ma_ba}\n`;
            telegramMsg += `❌ <b>Lỗi:</b> ${ten_loi}\n`;
            if (dynamicFields?.['Ghi chú']) {
                telegramMsg += `🗒 <b>Ghi chú gửi lại:</b> ${dynamicFields['Ghi chú']}\n`;
            }

            if (targetChatId) {
                await sendTelegramMessage(telegramMsg, targetChatId, targetBotToken);
            }

            return NextResponse.json({ success: true, pingCount: newPingCount });
        }

        if (!ten_loi || !ma_khoa) {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
        }

        const isManager = (user as any).isManager || user.role === 'ADMIN';

        let finalAssignee = assigneeId || null;
        if (!isManager && assigneeId) {
            finalAssignee = null; // Từ chối assign ngay lúc tạo nếu không phải manager
        }

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
        if (!finalAssignee) {
            if (assignmentMode === 'C') {
                // Cách C: Chia việc tự động cho người online rảnh nhất
                const availableUsers = await prisma.user.findMany({
                    where: {
                        role: targetDepartment,
                        isAvailable: true,
                        id: { not: user.id } // Chốt chặn: KHÔNG tự giao việc cho chính người đang bấm nút tạo
                    }
                });

                if (availableUsers.length > 0) {
                    const startOfDay = new Date();
                    startOfDay.setHours(0, 0, 0, 0);

                    // Đếm số task đang xử lý hoặc chờ xử lý của mỗi người TRONG NGÀY HÔM NAY
                    const ticketCounts = await Promise.all(availableUsers.map(async (u) => {
                        const count = await prisma.iTRequest.count({
                            where: {
                                assigneeId: u.id,
                                status: { in: ['PENDING', 'IN_PROGRESS'] },
                                createdAt: { gte: startOfDay }
                            }
                        });
                        return { id: u.id, count };
                    }));

                    // Tìm người có số task ít nhất
                    ticketCounts.sort((a, b) => a.count - b.count);
                    finalAssignee = ticketCounts[0].id;
                }
            } else if (assignmentMode === 'A' || assignmentMode === 'B') {
                // Cách A (Tự nhận) và Cách B (Admin gán thủ công) -> Khởi tạo không có ai
                finalAssignee = null;
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
                status: 'PENDING',
                messages: {
                    create: [
                        {
                            senderId: nguoi_bao_id || user.id,
                            senderName: dynamicFields['Người báo'] || (user as any).name || user.username,
                            content: ten_loi,
                            imageUrl: dynamicFields['Hình ảnh đính kèm'] && dynamicFields['Hình ảnh đính kèm'].length > 0 ? dynamicFields['Hình ảnh đính kèm'][0] : null
                        }
                    ]
                }
            }
        });

        // Lấy tên Khoa nếu có
        const dept = await prisma.department.findUnique({ where: { ma_khoa } });
        const tenKhoa = dept?.ten_khoa || ma_khoa;

        // Lấy thông tin người nhận (Tên và Telegram ID)
        let assigneeInfo = 'Chờ Admin duyệt';
        let assigneeUser = null;
        if (finalAssignee) {
            assigneeUser = await prisma.user.findUnique({ where: { id: finalAssignee } });
            if (assigneeUser) {
                assigneeInfo = assigneeUser.name || assigneeUser.username;
                if (assigneeUser.telegram_id) {
                    // Nếu là tên @username thì tag, còn nếu là ID số thì không hiển thị thô ra
                    assigneeInfo += assigneeUser.telegram_id.startsWith('@') ? ` (${assigneeUser.telegram_id})` : '';
                }
            } else {
                assigneeInfo = 'Đã phân công';
            }
        }

        // Tạo thông điệp Telegram
        let telegramMsg = `🚨 <b>YÊU CẦU HỖ TRỢ MỚI</b>\n\n`;
        telegramMsg += `🏢 <b>Khoa:</b> ${tenKhoa}\n`;
        telegramMsg += `👤 <b>Người báo:</b> ${dynamicFields['Người báo'] || 'Không rõ'} - <b>SĐT:</b> ${finalSdt || 'Không có'}\n`;
        telegramMsg += `📌 <b>Loại sự cố:</b> ${category === 'SOFTWARE' ? 'Phần Mềm / Nghiệp Vụ' : 'Phần Cứng / Sửa Chữa'}\n`;

        if (category === 'SOFTWARE') {
            telegramMsg += `📝 <b>Bệnh án:</b> ${ma_ba}\n`;
            telegramMsg += `📊 <b>Trạng thái:</b> ${dynamicFields['Trạng thái BA'] || ''}\n`;
        }

        telegramMsg += `❌ <b>Lỗi:</b> ${ten_loi}\n`;

        if (dynamicFields['Ghi chú']) {
            telegramMsg += `🗒 <b>Ghi chú:</b> ${dynamicFields['Ghi chú']}\n`;
        }

        telegramMsg += `\n🧑‍💻 <b>Người nhận:</b> ${assigneeInfo}`;

        // Bắn Telegram vào Group chung
        if (targetChatId) {
            await sendTelegramMessage(telegramMsg, targetChatId, targetBotToken);
        }

        // Bắn Telegram trực tiếp (Direct Message) cho Nhân viên CNTT nếu họ có điền ID Telegram dạng số
        if (assigneeUser && assigneeUser.telegram_id && /^-?\d+$/.test(assigneeUser.telegram_id)) {
            const dmMsg = `🔔 <b>BẠN VỪA ĐƯỢC GIAO MỘT VIỆC MỚI:</b>\n\n${telegramMsg}`;
            await sendTelegramMessage(dmMsg, assigneeUser.telegram_id, targetBotToken);
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

        return NextResponse.json(newRequest);
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
        const { id, status, it_note, assigneeId, transferToId, action, ten_loi, category, dynamicFields } = body;

        if (!id) return NextResponse.json({ error: 'Thiếu ID' }, { status: 400 });

        // Ai cũng có thể update, nhưng Khoa chỉ có thể update của khoa họ, CNTT/Admin update thoải mái
        const ticket = await prisma.iTRequest.findUnique({ where: { id } });
        if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        if (user.role === 'KHOA' && ticket.ma_khoa !== user.ma_khoa) {
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

        if (newStatus === 'IN_PROGRESS' && ticket.status !== 'IN_PROGRESS' && !newStartedAt) {
            newStartedAt = new Date();
        }
        if (newStatus === 'RESOLVED' && ticket.status !== 'RESOLVED' && !newResolvedAt) {
            newResolvedAt = new Date();
        }

        const updated = await prisma.iTRequest.update({
            where: { id },
            data: {
                status: newStatus,
                it_note: it_note !== undefined ? it_note : ticket.it_note,
                assigneeId: assigneeId !== undefined ? assigneeId : ticket.assigneeId,
                startedAt: newStartedAt,
                resolvedAt: newResolvedAt
            }
        });

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

        if (user.role === 'KHOA' && ticket.ma_khoa !== user.ma_khoa) {
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
