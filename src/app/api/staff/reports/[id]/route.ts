import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const template = await prisma.reportTemplate.findUnique({
            where: { id }
        });
        if (!template) {
            return NextResponse.json({ error: 'Không tìm thấy báo cáo' }, { status: 404 });
        }
        return NextResponse.json(template);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const formData = await req.formData();
        const code = formData.get('code') as string;
        const name = formData.get('name') as string;
        const description = formData.get('description') as string;
        const reportType = formData.get('reportType') as string;
        const startRow = formData.get('startRow') as string;
        const groupBy = formData.get('groupBy') as string;
        const columnMapping = formData.get('columnMapping') as string;
        const filters = formData.get('filters') as string;

        const updateData: any = {
            code,
            name,
            description,
            reportType,
            startRow: parseInt(startRow, 10),
            groupBy,
            columnMapping,
            filters
        };

        const file = formData.get('file') as File | null;
        if (file && file.size > 0) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const uploadsDir = path.join(process.cwd(), 'uploads', 'reports');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            const fileName = `${Date.now()}_${file.name}`;
            const filePath = path.join(uploadsDir, fileName);
            fs.writeFileSync(filePath, buffer);

            const oldTemplate = await prisma.reportTemplate.findUnique({ where: { id } });
            if (oldTemplate?.excelFilePath) {
                const oldPath = path.join(process.cwd(), oldTemplate.excelFilePath);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            updateData.excelFilePath = `/uploads/reports/${fileName}`;
        }

        const template = await prisma.reportTemplate.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json(template);
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const template = await prisma.reportTemplate.findUnique({ where: { id } });
        if (template?.excelFilePath) {
            const oldPath = path.join(process.cwd(), template.excelFilePath);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        await prisma.reportTemplate.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
