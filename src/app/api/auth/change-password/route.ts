import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/actions/auth';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Vui lòng cung cấp đủ mật khẩu cũ và mới' }, { status: 400 });
        }

        // Fetch user with password
        const userRecord = await prisma.user.findUnique({
            where: { id: user.id }
        });

        if (!userRecord) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, userRecord.password);
        if (!isMatch) {
            return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });

        return NextResponse.json({ message: 'Đổi mật khẩu thành công' });
    } catch (error: any) {
        console.error('Change password error:', error);
        return NextResponse.json({ error: 'Lỗi hệ thống khi đổi mật khẩu' }, { status: 500 });
    }
}
