import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/actions/auth';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        
        const whereClause = type ? { type } : {};
        
        const categories = await prisma.systemCategory.findMany({
            where: whereClause,
            orderBy: [
                { type: 'asc' },
                { order: 'asc' },
                { name: 'asc' }
            ]
        });
        
        return NextResponse.json(categories);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const body = await request.json();
        
        if (Array.isArray(body)) {
            // Bulk insert
            const validData = body.filter(item => item.type && item.code && item.name).map(item => ({
                type: item.type,
                code: item.code,
                name: item.name,
                description: item.description || null,
                order: item.order || 0,
                isActive: item.isActive !== undefined ? item.isActive : true
            }));
            
            if (validData.length === 0) return NextResponse.json({ error: 'No valid data to import' }, { status: 400 });
            
            const result = await prisma.systemCategory.createMany({
                data: validData,
                skipDuplicates: true
            });
            
            return NextResponse.json({ success: true, count: result.count }, { status: 201 });
        } else {
            // Single insert
            const { type, code, name, description, order } = body;

            if (!type || !code || !name) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
            }

            const category = await prisma.systemCategory.create({
                data: { type, code, name, description, order: order || 0 }
            });

            return NextResponse.json(category, { status: 201 });
        }
    } catch (error: any) {
        if (error.code === 'P2002') return NextResponse.json({ error: 'Mã (Code) đã tồn tại trong loại danh mục này' }, { status: 400 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const body = await request.json();
        const { id, code, name, description, order, isActive } = body;

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const category = await prisma.systemCategory.update({
            where: { id },
            data: { code, name, description, order, isActive }
        });

        return NextResponse.json(category);
    } catch (error: any) {
        if (error.code === 'P2002') return NextResponse.json({ error: 'Mã (Code) đã tồn tại' }, { status: 400 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await prisma.systemCategory.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: 'Không thể xóa danh mục đang được sử dụng' }, { status: 400 });
    }
}
