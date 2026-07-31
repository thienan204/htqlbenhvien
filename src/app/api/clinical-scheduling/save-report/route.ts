import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const ten_bao_cao = formData.get('ten_bao_cao') as string;
        const loai_bao_cao = formData.get('loai_bao_cao') as string;
        const ma_khoa = formData.get('ma_khoa') as string;
        const nguoi_tao = formData.get('nguoi_tao') as string;

        if (!file) {
            return NextResponse.json({ success: false, message: 'Không tìm thấy file' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Tạo thư mục nếu chưa có
        const today = new Date();
        const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const uploadDir = join(process.cwd(), 'public', 'reports', yearMonth);
        
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }

        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
        const filePath = join(uploadDir, fileName);
        const url = `/reports/${yearMonth}/${fileName}`;

        // Lưu file vật lý
        await writeFile(filePath, buffer);

        // Lưu vào DB
        const report = await prisma.pdfReport.create({
            data: {
                url,
                ten_bao_cao,
                loai_bao_cao,
                ma_khoa,
                nguoi_tao,
            }
        });

        return NextResponse.json({ success: true, data: report });
    } catch (error: any) {
        console.error('Lỗi khi lưu báo cáo:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
