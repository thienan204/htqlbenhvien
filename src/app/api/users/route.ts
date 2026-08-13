import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getCurrentUser } from '@/actions/auth';

const prisma = new PrismaClient();

// Hàm kiểm tra quyền ADMIN
async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
        throw new Error('Unauthorized');
    }
    return user;
}

export async function GET() {
    try {
        await requireAdmin();
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                ma_khoa: true,
                staffId: true,
                telegram_id: true,
                userHIS: true,
                isAvailable: true,
                dutyOrder: true,
                createdAt: true
            }
        });
        return NextResponse.json(users);
    } catch (error: any) {
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await requireAdmin();
        const body = await request.json();
        const { username, password, name, role, ma_khoa, telegram_id, staffId, userHIS } = body;

        if (!username || !password || !role) {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc (username, password, role)' }, { status: 400 });
        }

        // Check if username exists
        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) {
            return NextResponse.json({ error: 'Tên đăng nhập đã tồn tại' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name,
                role,
                telegram_id: telegram_id || null,
                userHIS: userHIS || null,
                staffId: staffId || null,
                ma_khoa: role === 'KHOA' ? ma_khoa : null
            },
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                userHIS: true,
                staffId: true,
                ma_khoa: true
            }
        });

        return NextResponse.json(newUser, { status: 201 });
    } catch (error: any) {
        if (error.code === 'P2002') {
            const target = error.meta?.target as string[];
            if (target && target.includes('staffId')) {
                return NextResponse.json({ error: 'Nhân viên này đã được liên kết với tài khoản khác' }, { status: 400 });
            }
        }
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        await requireAdmin();
        const body = await request.json();
        const { id, username, password, name, role, ma_khoa, telegram_id, staffId, userHIS } = body;

        if (!id) {
            return NextResponse.json({ error: 'Thiếu ID user cần cập nhật' }, { status: 400 });
        }

        const dataToUpdate: any = { username, name, role, ma_khoa: role === 'KHOA' ? ma_khoa : null, telegram_id: telegram_id || null, userHIS: userHIS || null, staffId: staffId || null };

        // Nếu có nhập password mới thì hash và cập nhật
        if (password && password.trim() !== '') {
            dataToUpdate.password = await bcrypt.hash(password, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: dataToUpdate,
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                userHIS: true,
                staffId: true,
                ma_khoa: true
            }
        });

        return NextResponse.json(updatedUser);
    } catch (error: any) {
        // Handle unique constraint error if changing to an existing username
        if (error.code === 'P2002') {
            const target = error.meta?.target as string[];
            if (target && target.includes('staffId')) {
                return NextResponse.json({ error: 'Nhân viên này đã được liên kết với tài khoản khác' }, { status: 400 });
            }
            return NextResponse.json({ error: 'Tên đăng nhập đã tồn tại' }, { status: 400 });
        }
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        await requireAdmin();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Thiếu ID user cần xóa' }, { status: 400 });
        }

        await prisma.user.delete({
            where: { id }
        });

        return NextResponse.json({ success: true, message: 'Xóa user thành công' });
    } catch (error: any) {
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        return NextResponse.json({ error: 'Lỗi khi xóa user (có thể đang có dữ liệu liên kết)' }, { status: 500 });
    }
}
