import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export async function POST(request: Request) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'Thiếu id thiết bị cần xóa' }, { status: 400 });
        }

        // Đảm bảo chỉ xóa passkey thuộc sở hữu của người dùng hiện tại
        const existing = await prisma.userPasskey.findFirst({
            where: {
                id,
                userId: currentUser.id
            }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Không tìm thấy thiết bị hoặc bạn không có quyền xóa' }, { status: 404 });
        }

        await prisma.userPasskey.delete({
            where: { id }
        });

        return NextResponse.json({ success: true, message: 'Đã xóa thiết bị thành công' });
    } catch (error: any) {
        console.error('Error deleting passkey:', error);
        return NextResponse.json({ error: error.message || 'Lỗi xóa thiết bị sinh trắc học' }, { status: 500 });
    }
}
