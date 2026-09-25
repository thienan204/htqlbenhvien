import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/actions/auth';
import { sendPushNotification } from '@/lib/firebase-admin';
import { emitEvent } from '@/lib/notificationService';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const messages = await prisma.requestMessage.findMany({
            where: { itRequestId: params.id },
            orderBy: { createdAt: 'asc' }
        });

        return NextResponse.json(messages);
    } catch (error) {
        console.error('Error GET it-request messages:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { content, imageUrl } = body;

        const ticket = await prisma.iTRequest.findUnique({
            where: { id: params.id },
            include: { assignee: true }
        });

        if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

        const newMessage = await prisma.requestMessage.create({
            data: {
                itRequestId: params.id,
                senderId: user.id,
                senderName: user.name || user.username,
                content: content || '',
                imageUrl: imageUrl || null
            }
        });

        // Notify logic
        const isFromIT = ['ADMIN', 'CNTT', 'VTYT', 'HCQT'].includes(user.role);
        let notifyUserIds: string[] = [];
        
        if (isFromIT) {
            // IT replied -> Notify creator (Khoa)
            if (ticket.nguoi_bao_id && ticket.nguoi_bao_id !== user.id) {
                notifyUserIds.push(ticket.nguoi_bao_id);
            }
        } else {
            // Khoa replied -> Notify Assignee
            if (ticket.assigneeId && ticket.assigneeId !== user.id) {
                notifyUserIds.push(ticket.assigneeId);
            }
        }

        if (notifyUserIds.length > 0) {
            // Note: sendPushNotification requires exact imports from firebase-admin, error handling is inside
            await sendPushNotification(notifyUserIds, 'Tin nhắn mới từ Hỗ trợ', `${user.name || user.username} vừa phản hồi trong BA: ${ticket.ma_ba}`, `/error-management/it-requests`);
        }
        
        // Triggers UI refresh for anyone looking at it
        emitEvent('NEW_IT_REQUEST_MESSAGE', { ticketId: ticket.id });

        return NextResponse.json(newMessage);
    } catch (error) {
        console.error('Error POST it-request messages:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
