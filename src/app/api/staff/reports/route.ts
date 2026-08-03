import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    try {
        const templates = await prisma.reportTemplate.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(templates);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const code = formData.get('code') as string;
        const name = formData.get('name') as string;
        const reportType = formData.get('reportType') as string || 'LISTING';
        const file = formData.get('file') as Blob | null;
        
        if (!code || !name) {
            return NextResponse.json({ error: 'Thiếu mã hoặc tên báo cáo' }, { status: 400 });
        }

        const exists = await prisma.reportTemplate.findUnique({ where: { code } });
        if (exists) {
            return NextResponse.json({ error: 'Mã báo cáo đã tồn tại' }, { status: 400 });
        }

        let excelFilePath = null;
        if (file) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const dir = path.join(process.cwd(), 'src', 'templates', 'reports');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const filename = `${code}_${Date.now()}.xlsx`;
            excelFilePath = path.join(dir, filename);
            fs.writeFileSync(excelFilePath, buffer);
        }

        const template = await prisma.reportTemplate.create({
            data: {
                code,
                name,
                reportType,
                excelFilePath,
            }
        });

        return NextResponse.json(template);
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
