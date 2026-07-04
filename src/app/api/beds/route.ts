import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const ma_khoa = searchParams.get('ma_khoa');
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '50');
        const search = searchParams.get('search');

        const skip = (page - 1) * pageSize;

        const where: any = {};
        if (ma_khoa) {
            where.ma_khoa = ma_khoa;
        }
        if (search) {
            where.ma_giuong = { contains: search, mode: 'insensitive' };
        }

        const [items, total] = await Promise.all([
            prisma.bedCatalog.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: [
                    { ma_khoa: 'asc' },
                    { ma_giuong: 'asc' }
                ],
            }),
            prisma.bedCatalog.count({ where })
        ]);

        return NextResponse.json({
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        });
    } catch (error: any) {
        console.error('Error fetching beds:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // Handle bulk generation
        if (body.action === 'auto_generate') {
            const { ma_khoa, prefix, start, end, padding, loai_giuong } = body;
            
            if (!ma_khoa || start === undefined || end === undefined) {
                return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
            }

            const startNum = parseInt(start);
            const endNum = parseInt(end);
            
            if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) {
                return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
            }

            // Check if department exists
            const dept = await prisma.department.findUnique({ where: { ma_khoa } });
            if (!dept) {
                return NextResponse.json({ error: 'Khoa không tồn tại' }, { status: 404 });
            }

            const dataToInsert = [];
            for (let i = startNum; i <= endNum; i++) {
                const numberStr = i.toString().padStart(padding || 1, '0');
                const ma_giuong = `${prefix || ''}${numberStr}`;
                
                dataToInsert.push({
                    id: crypto.randomUUID(),
                    ma_khoa,
                    ma_giuong,
                    loai_giuong: loai_giuong || null,
                    updatedAt: new Date()
                });
            }

            // Prisma currently doesn't have createMany with ignore duplicates out of the box in simple usage, 
            // but we can use createMany and let it fail if it hits a unique constraint, OR use a loop with upsert.
            // Using createMany with skipDuplicates: true (Available in recent Prisma versions for Postgres)
            const result = await prisma.bedCatalog.createMany({
                data: dataToInsert,
                skipDuplicates: true
            });

            return NextResponse.json({ 
                success: true, 
                message: `Đã tạo ${result.count} mã giường mới`,
                count: result.count
            });
        }
        
        // Single create
        const { ma_khoa, ma_giuong, loai_giuong } = body;
        
        if (!ma_khoa || !ma_giuong) {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
        }

        const bed = await prisma.bedCatalog.create({
            data: { 
                id: crypto.randomUUID(),
                ma_khoa, 
                ma_giuong, 
                loai_giuong,
                updatedAt: new Date()
            }
        });

        return NextResponse.json(bed);
    } catch (error: any) {
        console.error('Error creating beds:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const idsParam = searchParams.get('ids'); // For bulk delete
        
        if (idsParam) {
            const ids = idsParam.split(',').map(i => i.trim()).filter(Boolean);
            await prisma.bedCatalog.deleteMany({
                where: { id: { in: ids } }
            });
            return NextResponse.json({ success: true, message: `Đã xóa ${ids.length} mã giường` });
        }
        
        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        await prisma.bedCatalog.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting bed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
