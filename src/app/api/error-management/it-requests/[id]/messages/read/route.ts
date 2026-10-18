import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export async function POST(request: Request, context: any) {
    try {
        const params = await context.params;
        const id = params.id;
        
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

        await prisma.$executeRawUnsafe(`
            UPDATE "RequestMessage"
            SET "readBy" = array_append("readBy", $1)
            WHERE "itRequestId" = $2 AND NOT ($1 = ANY("readBy"))
        `, user.id, id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in mark messages as read:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
