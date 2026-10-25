import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export async function GET() {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const passkeys = await prisma.userPasskey.findMany({
            where: { userId: currentUser.id },
            select: {
                id: true,
                deviceName: true,
                deviceType: true,
                createdAt: true,
                lastUsedAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ passkeys });
    } catch (error: any) {
        console.error('Error fetching passkeys:', error);
        return NextResponse.json({ error: error.message || 'Lỗi lấy danh sách sinh trắc học' }, { status: 500 });
    }
}
