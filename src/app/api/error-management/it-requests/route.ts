import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/actions/auth';
import { unlink } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

// Telegram Bot details (nên để ở .env)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(message: string, chatId?: string) {
    const targetChatId = chatId || TELEGRAM_CHAT_ID;
    if (!TELEGRAM_BOT_TOKEN || !targetChatId) return;
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
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

        let whereClause: any = {};
        
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
            where: { role: { in: ['CNTT', 'ADMIN'] } },
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
        const { ma_ba, ten_loi, assigneeId, dynamicFields, category, nguoi_bao_id, sdt } = body;
        
        let ma_khoa = body.ma_khoa;
        if (!['ADMIN', 'CNTT'].includes(user.role)) {
            ma_khoa = user.ma_khoa; // Ghi đè bằng mã khoa thực tế
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

        // Lấy cấu hình chia việc
        const configRule = await prisma.specializedRule.findUnique({
            where: { slug: 'it-request-fields-config' }
        });
        
        let assignmentMode = 'A';
        if (configRule && configRule.logicConfig) {
            const config: any = configRule.logicConfig;
            if (!Array.isArray(config)) {
                assignmentMode = config.assignmentMode || 'A';
            }
        }

        // Nếu Khoa không chọn ai (Khoa không có quyền chọn, nên luôn là null)
        if (!finalAssignee) {
            if (assignmentMode === 'C') {
                // Cách C: Chia việc tự động cho người online rảnh nhất
                const availableUsers = await prisma.user.findMany({
                    where: { role: 'CNTT', isAvailable: true }
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
        if (TELEGRAM_CHAT_ID) {
            await sendTelegramMessage(telegramMsg, TELEGRAM_CHAT_ID);
        }

        // Bắn Telegram trực tiếp (Direct Message) cho Nhân viên CNTT nếu họ có điền ID Telegram dạng số
        if (assigneeUser && assigneeUser.telegram_id && /^-?\d+$/.test(assigneeUser.telegram_id)) {
            const dmMsg = `🔔 <b>BẠN VỪA ĐƯỢC GIAO MỘT VIỆC MỚI:</b>\n\n${telegramMsg}`;
            await sendTelegramMessage(dmMsg, assigneeUser.telegram_id);
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
        const { id, status, it_note, assigneeId, transferToId, action } = body;

        if (!id) return NextResponse.json({ error: 'Thiếu ID' }, { status: 400 });

        // Ai cũng có thể update, nhưng Khoa chỉ có thể update của khoa họ, CNTT/Admin update thoải mái
        const ticket = await prisma.iTRequest.findUnique({ where: { id } });
        if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        if (user.role === 'KHOA' && ticket.ma_khoa !== user.ma_khoa) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const isManager = (user as any).isManager || user.role === 'ADMIN';

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
