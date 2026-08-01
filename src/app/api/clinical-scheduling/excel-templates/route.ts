import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const templates = await prisma.excelTemplate.findMany({
            include: { mappings: true },
            orderBy: { createdAt: 'desc' }
        });
        
        return NextResponse.json({ success: true, data: templates });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, isDefault, mappings } = body;
        
        if (!name) {
            return NextResponse.json({ success: false, message: 'Tên mẫu (name) là bắt buộc.' }, { status: 400 });
        }
        
        if (isDefault) {
            await prisma.excelTemplate.updateMany({
                data: { isDefault: false }
            });
        }
        
        const template = await prisma.excelTemplate.create({
            data: {
                name,
                isDefault: isDefault || false,
                mappings: {
                    create: mappings.map((m: any) => ({
                        system_field: m.system_field,
                        excel_column: m.excel_column
                    }))
                }
            },
            include: { mappings: true }
        });
        
        return NextResponse.json({ success: true, data: template });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, name, isDefault, mappings } = body;
        
        if (!id) {
            return NextResponse.json({ success: false, message: 'ID mẫu (templateId) là bắt buộc.' }, { status: 400 });
        }
        
        if (isDefault) {
            await prisma.excelTemplate.updateMany({
                where: { id: { not: id } },
                data: { isDefault: false }
            });
        }
        
        const template = await prisma.excelTemplate.update({
            where: { id },
            data: {
                name,
                isDefault: isDefault || false,
            }
        });
        
        await prisma.excelTemplateMapping.deleteMany({
            where: { templateId: id }
        });
        
        if (mappings && mappings.length > 0) {
            await prisma.excelTemplateMapping.createMany({
                data: mappings.map((m: any) => ({
                    templateId: id,
                    system_field: m.system_field,
                    excel_column: m.excel_column
                }))
            });
        }
        
        const updatedTemplate = await prisma.excelTemplate.findUnique({
            where: { id },
            include: { mappings: true }
        });
        
        return NextResponse.json({ success: true, data: updatedTemplate });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ success: false, message: 'ID là bắt buộc.' }, { status: 400 });
        }
        
        await prisma.excelTemplate.delete({
            where: { id }
        });
        
        return NextResponse.json({ success: true, message: 'Đã xóa mẫu thành công.' });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
