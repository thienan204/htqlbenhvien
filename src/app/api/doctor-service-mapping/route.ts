import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const search = searchParams.get('search') || '';
        
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { cchn: { contains: search } },
                { ma_dich_vu: { contains: search } },
                { ten_dich_vu: { contains: search } }
            ];
        }

        const [total, data] = await Promise.all([
            prisma.doctorServiceMapping.count({ where }),
            prisma.doctorServiceMapping.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            })
        ]);

        return NextResponse.json({
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error fetching mappings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // Support bulk insert
        if (Array.isArray(body)) {
            // Need to handle duplicates carefully. Prisma createMany with skipDuplicates is available.
            const created = await prisma.doctorServiceMapping.createMany({
                data: body.map((item: any) => ({
                    id: crypto.randomUUID(),
                    cchn: item.cchn,
                    ma_dich_vu: item.ma_dich_vu,
                    ten_dich_vu: item.ten_dich_vu,
                    source: item.source || 'XML_AUTO',
                    status: item.status || 'APPROVED',
                    updatedAt: new Date()
                })),
                skipDuplicates: true
            });
            return NextResponse.json({ success: true, count: created.count });
        } else {
            // Single insert
            const { cchn, ma_dich_vu, ten_dich_vu, source, status } = body;
            
            // Check if exists
            const exists = await prisma.doctorServiceMapping.findUnique({
                where: {
                    cchn_ma_dich_vu: {
                        cchn,
                        ma_dich_vu
                    }
                }
            });

            if (exists) {
                return NextResponse.json({ error: 'Mapping already exists' }, { status: 400 });
            }

            const mapping = await prisma.doctorServiceMapping.create({
                data: { 
                    id: crypto.randomUUID(),
                    cchn, 
                    ma_dich_vu, 
                    ten_dich_vu, 
                    source: source || 'MANUAL_ADD', 
                    status: status || 'APPROVED',
                    updatedAt: new Date()
                }
            });
            return NextResponse.json(mapping);
        }
    } catch (error) {
        console.error('Error creating mapping:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { ids, status } = body; // Support bulk update status

        if (!ids || !Array.isArray(ids) || !status) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const updated = await prisma.doctorServiceMapping.updateMany({
            where: { id: { in: ids } },
            data: { status }
        });

        return NextResponse.json({ success: true, count: updated.count });
    } catch (error) {
        console.error('Error updating mappings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const ids = searchParams.get('ids');

        if (!ids) {
            return NextResponse.json({ error: 'IDs required' }, { status: 400 });
        }

        if (ids === 'all') {
            const deleted = await prisma.doctorServiceMapping.deleteMany({});
            return NextResponse.json({ success: true, count: deleted.count, message: `Đã xóa toàn bộ ${deleted.count} bản ghi` });
        }

        const idArray = ids.split(',');

        const deleted = await prisma.doctorServiceMapping.deleteMany({
            where: { id: { in: idArray } }
        });

        return NextResponse.json({ success: true, count: deleted.count });
    } catch (error) {
        console.error('Error deleting mappings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
