import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { getCurrentUser } from '@/actions/auth';
import prisma from '@/lib/prisma';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Bạn chưa đăng nhập' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'Không tìm thấy tệp ảnh tải lên' }, { status: 400 });
        }

        // 1. Kiểm tra dung lượng
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ 
                error: 'Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.' 
            }, { status: 400 });
        }

        // 2. Kiểm tra phần mở rộng
        const fileExt = extname(file.name || '').toLowerCase();
        if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
            return NextResponse.json({ 
                error: `Định dạng ảnh không hợp lệ. Chỉ chấp nhận các định dạng: ${ALLOWED_EXTENSIONS.join(', ')}` 
            }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 3. Đặt tên file an toàn dựa theo user ID và timestamp
        const safeUserId = String(user.id).replace(/[^a-zA-Z0-9_\-]/g, '');
        const filename = `avatar_${safeUserId}_${Date.now()}${fileExt}`;
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'avatars');

        await mkdir(uploadDir, { recursive: true });

        const filePath = join(uploadDir, filename);
        await writeFile(filePath, buffer);

        const fileUrl = `/uploads/avatars/${filename}`;

        // 4. Tự động lưu ngay đường dẫn avatar vào database để không bị mất khi reload
        try {
            await prisma.$executeRawUnsafe('UPDATE "User" SET avatar = $1 WHERE id = $2', fileUrl, user.id);
        } catch (dbErr) {
            console.error('Lỗi tự động lưu avatar vào database:', dbErr);
        }

        return NextResponse.json({
            success: true,
            url: fileUrl,
            filename,
            size: file.size
        });
    } catch (error: any) {
        console.error('Avatar Upload Error:', error);
        return NextResponse.json({ error: error.message || 'Lỗi khi tải ảnh đại diện lên máy chủ' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Bạn chưa đăng nhập' }, { status: 401 });
        }

        await prisma.$executeRawUnsafe('UPDATE "User" SET avatar = NULL WHERE id = $1', user.id);

        return NextResponse.json({ success: true, message: 'Đã xóa ảnh đại diện thành công' });
    } catch (error: any) {
        console.error('Avatar Delete Error:', error);
        return NextResponse.json({ error: error.message || 'Lỗi khi xóa ảnh đại diện' }, { status: 500 });
    }
}
