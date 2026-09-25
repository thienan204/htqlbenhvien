import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/actions/auth';
import { sendPushNotification } from '@/lib/firebase-admin';
import { emitEvent } from '@/lib/notificationService';

const prisma = new PrismaClient();

export async function GET(request: Request, context: any) {
    try {
        const params = await context.params;
        const id = params.id;
        
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

        const messages = await prisma.requestMessage.findMany({
            where: { itRequestId: id },
            orderBy: { createdAt: 'asc' }
        });

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
        const { content, imageUrl } = body;

        const ticket = await prisma.iTRequest.findUnique({
            where: { id: id }
        });

        if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

        const newMessage = await prisma.requestMessage.create({
            data: {
                itRequestId: id,
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
            // nguoi_bao_id is stored in dynamicFields if available
            const dynamicFields: any = ticket.dynamicFields || {};
            const nguoi_bao_id = dynamicFields.nguoi_bao_id;
            
            if (nguoi_bao_id && nguoi_bao_id !== user.id) {
                notifyUserIds.push(nguoi_bao_id);
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
