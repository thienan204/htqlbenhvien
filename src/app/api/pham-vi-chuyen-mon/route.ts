import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get('activeOnly') === 'true';

        const data = await prisma.scopeOfPracticeCatalog.findMany({
            where: activeOnly ? { isActive: true } : undefined,
            orderBy: {
                ma_pham_vi: 'asc'
            }
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching ScopeOfPracticeCatalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        // Handle bulk import
        if (Array.isArray(body)) {
            const results = [];
            for (const item of body) {
                const existing = await prisma.scopeOfPracticeCatalog.findUnique({
                    where: { ma_pham_vi: item.ma_pham_vi }
                });
                
                if (existing) {
                    const updated = await prisma.scopeOfPracticeCatalog.update({
                        where: { id: existing.id },
                        data: {
                            ten_chuc_danh: item.ten_chuc_danh,
                            ghi_chu: item.ghi_chu || existing.ghi_chu,
                            isActive: item.isActive !== undefined ? item.isActive : existing.isActive
                        }
                    });
                    results.push(updated);
                } else {
                    const created = await prisma.scopeOfPracticeCatalog.create({
                        data: {
                            id: crypto.randomUUID(),
                            ma_pham_vi: item.ma_pham_vi,
                            ten_chuc_danh: item.ten_chuc_danh,
                            ghi_chu: item.ghi_chu || null,
                            isActive: item.isActive !== undefined ? item.isActive : true,
                            updatedAt: new Date()
                        }
                    });
                    results.push(created);
                }
            }
            return NextResponse.json({ success: true, count: results.length });
        }

        const { ma_pham_vi, ten_chuc_danh, ghi_chu, isActive } = body;

        const existing = await prisma.scopeOfPracticeCatalog.findUnique({
            where: { ma_pham_vi }
        });

        if (existing) {
            return NextResponse.json({ error: 'Mã phạm vi đã tồn tại' }, { status: 400 });
        }

        const data = await prisma.scopeOfPracticeCatalog.create({
            data: {
                id: crypto.randomUUID(),
                ma_pham_vi,
                ten_chuc_danh,
                ghi_chu: ghi_chu || null,
                isActive: isActive !== undefined ? isActive : true,
                updatedAt: new Date()
            }
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error creating ScopeOfPracticeCatalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { id, ma_pham_vi, ten_chuc_danh, ghi_chu, isActive } = await request.json();

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const existingCode = await prisma.scopeOfPracticeCatalog.findFirst({
            where: { ma_pham_vi, NOT: { id } }
        });

        if (existingCode) {
            return NextResponse.json({ error: 'Mã phạm vi đã tồn tại' }, { status: 400 });
        }

        const data = await prisma.scopeOfPracticeCatalog.update({
            where: { id },
            data: {
                ma_pham_vi,
                ten_chuc_danh,
                ghi_chu,
                isActive
            }
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error updating ScopeOfPracticeCatalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const deleteAll = searchParams.get('deleteAll');

        if (deleteAll === 'true') {
            await prisma.scopeOfPracticeCatalog.deleteMany({});
            return NextResponse.json({ success: true });
        }

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await prisma.scopeOfPracticeCatalog.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting ScopeOfPracticeCatalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
