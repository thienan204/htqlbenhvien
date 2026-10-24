import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';
import { sendPushNotification } from '@/lib/firebase-admin';
import { emitEvent } from '@/lib/notificationService';
import { sendZaloGroupNotification } from '@/lib/zalo';

export async function GET(request: Request, context: any) {
    try {
        const params = await context.params;
        const id = params.id;
        
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

        const ticket = await prisma.iTRequest.findUnique({
            where: { id: id }
        });
        if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

        const isDepartmentUser = !['ADMIN', 'CNTT', 'VTYT', 'HCQT', 'VENDOR'].includes(user.role);
        const isVendorUser = user.role === 'VENDOR';

        if (isDepartmentUser && ticket.ma_khoa !== user.ma_khoa) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const reqChannel = searchParams.get('channel');

        const messageWhere: any = { itRequestId: id };
        if (isDepartmentUser) {
            // Khoa phòng chỉ được đọc tin nhắn nội bộ
            messageWhere.channel = 'INTERNAL';
        } else if (isVendorUser) {
            // Đối tác ngoài chỉ được đọc tin nhắn kênh đối tác
            messageWhere.channel = 'VENDOR';
        } else if (reqChannel) {
            messageWhere.channel = reqChannel;
        }

        const messages = await prisma.requestMessage.findMany({
            where: messageWhere,
            orderBy: { createdAt: 'asc' }
        });

        // Tự động đánh dấu đã đọc các tin nhắn cho user hiện tại
        try {
            await prisma.$executeRawUnsafe(`
                UPDATE "RequestMessage"
                SET "readBy" = array_append("readBy", $1)
                WHERE "itRequestId" = $2 AND NOT ($1 = ANY("readBy"))
            `, user.id, id);
        } catch (e) {
            console.error('Error marking messages as read:', e);
        }

        return NextResponse.json(messages);
    } catch (error) {
        console.error('Error GET it-request messages:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request, context: any) {
    try {
        const params = await context.params;
        const id = params.id;
        
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

        const body = await request.json();
        const { content, imageUrl, channel = 'INTERNAL', vendorName } = body;

        const ticket = await prisma.iTRequest.findUnique({
            where: { id: id }
        });

        if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

        const isDepartmentUser = !['ADMIN', 'CNTT', 'VTYT', 'HCQT', 'VENDOR'].includes(user.role);
        const isVendorUser = user.role === 'VENDOR';

        if (isDepartmentUser && ticket.ma_khoa !== user.ma_khoa) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Ép buộc phân quyền channel khi gửi
        let safeChannel = channel || 'INTERNAL';
        if (isDepartmentUser) safeChannel = 'INTERNAL';
        else if (isVendorUser) safeChannel = 'VENDOR';

        // Tự động lưu vendorName vào ticket nếu chưa có
        if (safeChannel === 'VENDOR' && vendorName && !ticket.vendorName) {
            try {
                await prisma.iTRequest.update({
                    where: { id: id },
                    data: { vendorName: vendorName.trim() }
                });
            } catch (err) {
                console.warn('Lỗi cập nhật vendorName vào ticket:', err);
            }
        }

        const newMessage = await prisma.requestMessage.create({
            data: {
                itRequestId: id,
                senderId: user.id,
                senderName: user.name || user.username,
                content: content || '',
                imageUrl: imageUrl || null,
                channel: safeChannel,
                vendorName: vendorName || ticket.vendorName || null,
                readBy: [user.id] // Người gửi luôn là đã đọc
            }
        });

        // Notify logic
        const isFromIT = ['ADMIN', 'CNTT', 'VTYT', 'HCQT'].includes(user.role);
        let notifyUserIds: string[] = [];
        
        if (isFromIT) {
            // IT replied -> Notify creator (Khoa)
            const dynamicFields: any = ticket.dynamicFields || {};
            const nguoi_bao_id = dynamicFields.nguoi_bao_id;
            
            if (nguoi_bao_id && nguoi_bao_id !== user.id) {
                notifyUserIds.push(nguoi_bao_id);
            }
        } else {
            // Khoa replied -> Notify Assignee phụ trách phiếu
            if (ticket.assigneeId && ticket.assigneeId !== user.id) {
                notifyUserIds.push(ticket.assigneeId);
            } else if (!ticket.assigneeId) {
                // Nếu chưa phân công: Gửi tới các tài khoản phụ trách phòng kỹ thuật tương ứng
                try {
                    const deptRole = ticket.targetDepartment || 'CNTT';
                    const staffUsers = await prisma.user.findMany({
                        where: { role: { in: [deptRole, 'ADMIN'] }, isActive: true },
                        select: { id: true }
                    });
                    notifyUserIds = staffUsers.map(u => u.id).filter(uid => uid !== user.id);
                } catch (e) {
                    console.error('Error getting department staff users for notification:', e);
                }
            }
        }

        if (notifyUserIds.length > 0) {
            const senderName = user.name || user.username;
            const notifTitle = channel === 'VENDOR' 
                ? `Trao đổi Đối tác: ${vendorName || 'Công ty ngoài'}` 
                : `💬 Tin nhắn từ Khoa [${ticket.ma_khoa}]`;
            const snippet = newMessage.content ? (newMessage.content.length > 60 ? `${newMessage.content.slice(0, 60)}...` : newMessage.content) : '[Hình ảnh]';
            const notifBody = `${senderName}: ${snippet} (BA: ${ticket.ma_ba || 'Khác'})`;

            await sendPushNotification(
                notifyUserIds, 
                notifTitle, 
                notifBody, 
                `/error-management/it-requests?highlight=${ticket.id}`
            );
        }

        // Bắn thông báo Zalo vào Nhóm chung khi Khoa/Phòng phản hồi
        if (!isFromIT && !isVendorUser) {
            try {
                let slug = 'it-request-fields-config';
                if (ticket.targetDepartment === 'VTYT') slug = 'vtyt-request-fields-config';
                else if (ticket.targetDepartment === 'HCQT') slug = 'hcqt-request-fields-config';

                const configRule = await prisma.specializedRule.findUnique({ where: { slug } });
                const config: any = configRule?.logicConfig || {};
                
                if (config.zaloEnabled && config.zaloWebhookUrl) {
                    const dept = await prisma.department.findUnique({ where: { ma_khoa: ticket.ma_khoa } });
                    const tenKhoa = dept?.ten_khoa || ticket.ma_khoa;
                    const origin = process.env.APP_URL || request.headers.get('origin') || 'http://localhost:3000';
                    const ticketUrl = `${origin}/htqlbenhvien/error-management/it-requests?highlight=${ticket.id}`;
                    
                    await sendZaloGroupNotification(config.zaloWebhookUrl, {
                        title: `Phản hồi mới từ Khoa/Phòng [${ticket.targetDepartment}]`,
                        department: tenKhoa,
                        senderName: user.name || user.username,
                        phone: (user as any).phone || undefined,
                        patientCode: ticket.ma_ba ? `Mã BA: ${ticket.ma_ba}` : undefined,
                        content: newMessage.content || (newMessage.imageUrl ? '[Đã gửi một hình ảnh]' : ''),
                        ticketUrl,
                        priority: 'REPLY'
                    });
                }
            } catch (zErr) {
                console.error('Lỗi gửi Zalo notification khi khoa phản hồi tin nhắn:', zErr);
            }
        }
        
        // Triggers UI refresh for anyone looking at it
        emitEvent('NEW_IT_REQUEST_MESSAGE', { 
            ticketId: ticket.id,
            senderId: user.id,
            senderName: user.name || user.username,
            content: newMessage.content,
            channel: newMessage.channel,
            vendorName: newMessage.vendorName,
            ma_ba: ticket.ma_ba,
            ten_loi: ticket.ten_loi,
            ma_khoa: ticket.ma_khoa
        });

        return NextResponse.json(newMessage);
    } catch (error) {
        console.error('Error POST it-request messages:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
