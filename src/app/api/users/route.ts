import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getCurrentUser } from '@/actions/auth';

const prisma = new PrismaClient();

// Hàm kiểm tra quyền xem / thao tác danh sách người dùng
async function checkUserAccess(action: 'VIEW' | 'EDIT' | 'DELETE' = 'VIEW') {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('Unauthorized');
    }
    // ADMIN và CNTT có toàn quyền
    if (user.role === 'ADMIN' || user.role === 'CNTT') {
        return user;
    }
    // Kiểm tra quyền MENU_USERS
    const perms: any = user.permissions;
    if (Array.isArray(perms) && (perms.includes('*') || perms.includes('MENU_USERS'))) {
        return user;
    }
    if (typeof perms === 'object' && perms?.MENU_USERS) {
        if (action === 'VIEW' && perms.MENU_USERS.VIEW) return user;
        if (action === 'EDIT' && (perms.MENU_USERS.EDIT || perms.MENU_USERS.VIEW)) return user;
        if (action === 'DELETE' && perms.MENU_USERS.DELETE) return user;
    }
    throw new Error('Unauthorized');
}

export async function GET() {
    try {
        await checkUserAccess('VIEW');
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
                idHIS: true,
                isAvailable: true,
                isActive: true,
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
        await checkUserAccess('EDIT');
        const body = await request.json();
        const { username, password, name, role, ma_khoa, telegram_id, staffId, userHIS, idHIS, isActive } = body;

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
                idHIS: idHIS || null,
                staffId: staffId || null,
                isActive: isActive !== undefined ? isActive : true,
                ma_khoa: role === 'KHOA' ? ma_khoa : null
            },
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                userHIS: true,
                idHIS: true,
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
        await checkUserAccess('EDIT');
        const body = await request.json();
        const { id, username, password, name, role, ma_khoa, telegram_id, staffId, userHIS, idHIS, isActive } = body;

        if (!id) {
            return NextResponse.json({ error: 'Thiếu ID user cần cập nhật' }, { status: 400 });
        }

        const dataToUpdate: any = { username, name, role, ma_khoa: role === 'KHOA' ? ma_khoa : null, telegram_id: telegram_id || null, userHIS: userHIS || null, idHIS: idHIS || null, staffId: staffId || null, isActive: isActive !== undefined ? isActive : true };

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
                idHIS: true,
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
        await checkUserAccess('DELETE');
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
