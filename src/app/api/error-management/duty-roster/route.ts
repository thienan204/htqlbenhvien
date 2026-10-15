import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Lấy danh sách nhân viên CNTT
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const targetDepartment = searchParams.get('targetDepartment') || 'CNTT';

        const users = await prisma.user.findMany({
            where: {
                role: targetDepartment
            },
            orderBy: {
                dutyOrder: 'asc'
            },
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                isAvailable: true,
                dutyOrder: true,
                autoAssignDisabled: true,
                focusReason: true
            }
        });
        return NextResponse.json(users);
    } catch (error) {
        console.error('Error fetching duty roster:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Cập nhật trạng thái trực và thứ tự
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { users } = body; // Mảng user: { id, isAvailable, dutyOrder, autoAssignDisabled, focusReason }

        if (!Array.isArray(users)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        // Thực hiện update hàng loạt bằng transaction
        const updates = users.map(user => 
            prisma.user.update({
                where: { id: user.id },
                data: {
                    ...(user.isAvailable !== undefined && { isAvailable: user.isAvailable }),
                    ...(user.dutyOrder !== undefined && { dutyOrder: user.dutyOrder }),
                    ...(user.autoAssignDisabled !== undefined && { autoAssignDisabled: user.autoAssignDisabled }),
                    ...(user.focusReason !== undefined && { focusReason: user.focusReason })
                }
            })
        );

        await prisma.$transaction(updates);

        return NextResponse.json({ success: true, message: 'Cập nhật ca trực thành công!' });
    } catch (error) {
        console.error('Error updating duty roster:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
