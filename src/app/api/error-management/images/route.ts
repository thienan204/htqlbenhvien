import { NextResponse } from 'next/server';
import { readdir, stat, unlink } from 'fs/promises';
import { join, extname } from 'path';
import { getCurrentUser } from '@/actions/auth';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user || !['ADMIN', 'CNTT'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const uploadDir = join(process.cwd(), 'public', 'uploads', 'tickets');
        let files: string[] = [];
        try {
            files = await readdir(uploadDir);
        } catch (e) {
            // Folder might not exist yet
            return NextResponse.json([]);
        }

        const images = await Promise.all(files.map(async (file) => {
            const filepath = join(uploadDir, file);
            const stats = await stat(filepath);
            const ext = extname(file).toLowerCase();
            return {
                name: file,
                url: `/uploads/tickets/${file}`,
                size: stats.size, // bytes
                ext: ext,
                createdAt: stats.mtime // Lấy thời gian modify thay vì birthtime vì trên linux birthtime có thể không chính xác
            };
        }));

        // Sắp xếp mới nhất lên đầu
        images.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        return NextResponse.json(images);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || !['ADMIN', 'CNTT'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const name = searchParams.get('name');

        if (!name) return NextResponse.json({ error: 'Thiếu tên file' }, { status: 400 });

        // Ngăn chặn path traversal
        const safeName = name.replace(/^.*[\\\/]/, '');
        
        // Kiểm tra xem file này có thuộc về yêu cầu IT nào chưa hoàn thành không
        const fileUrl = `/uploads/tickets/${safeName}`;
        const activeRequests: any[] = await prisma.$queryRaw`
            SELECT id FROM "ITRequest"
            WHERE status != 'RESOLVED'
            AND (
                "dynamicFields"::text LIKE ${'%' + fileUrl + '%'}
                OR array_to_string("it_images", ',') LIKE ${'%' + fileUrl + '%'}
            )
            LIMIT 1
        `;

        if (activeRequests && activeRequests.length > 0) {
            return NextResponse.json({ error: 'Tệp này đang được sử dụng trong một yêu cầu chưa hoàn thành.' }, { status: 400 });
        }

        const filepath = join(process.cwd(), 'public', 'uploads', 'tickets', safeName);

        await unlink(filepath);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Không thể xóa file' }, { status: 500 });
    }
}
