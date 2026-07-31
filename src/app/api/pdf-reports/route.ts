import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { unlink } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const maKhoa = url.searchParams.get('ma_khoa');
        const role = url.searchParams.get('role');

        let whereClause = {};
        if (role !== 'ADMIN' && maKhoa) {
            whereClause = { ma_khoa: maKhoa };
        }

        const reports = await prisma.pdfReport.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ success: true, data: reports });
    } catch (error: any) {
        console.error('Lỗi khi lấy danh sách báo cáo:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, message: 'Thiếu ID báo cáo' }, { status: 400 });
        }

        const report = await prisma.pdfReport.findUnique({ where: { id } });
        if (!report) {
            return NextResponse.json({ success: false, message: 'Báo cáo không tồn tại' }, { status: 404 });
        }

        // Xóa file vật lý
        try {
            // report.url is something like /reports/YYYY-MM/filename.pdf
            const filePath = join(process.cwd(), 'public', report.url);
            await unlink(filePath);
        } catch (fsError) {
            console.warn('Không thể xóa file vật lý hoặc file không tồn tại:', fsError);
        }

        // Xóa bản ghi DB
        await prisma.pdfReport.delete({ where: { id } });

        return NextResponse.json({ success: true, message: 'Xóa báo cáo thành công' });
    } catch (error: any) {
        console.error('Lỗi khi xóa báo cáo:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
