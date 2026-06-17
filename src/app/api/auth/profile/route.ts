import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/actions/auth';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userData = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                telegram_id: true,
                isAvailable: true,
            }
        });

        if (!userData) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        return NextResponse.json(userData);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { name, telegram_id, isAvailable } = body;

        // Allow updates to name and telegram_id, and isAvailable for CNTT role
        const updateData: any = { name, telegram_id };
        if (user.role === 'CNTT' && isAvailable !== undefined) {
            updateData.isAvailable = isAvailable;
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: updateData,
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                telegram_id: true,
                isAvailable: true,
            }
        });

        return NextResponse.json({ message: 'Cập nhật thông tin thành công', user: updatedUser });
    } catch (error: any) {
        console.error('Update profile error:', error);
        return NextResponse.json({ error: 'Lỗi cập nhật hồ sơ' }, { status: 500 });
    }
}
