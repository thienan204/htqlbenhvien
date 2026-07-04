import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const items = await prisma.department.findMany({
            orderBy: { ma_khoa: 'asc' }
        });
        return NextResponse.json(items);
    } catch (error) {
        console.error("API Departments GET Error:", error);
        return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Check if bulk create (array) or single create
        if (Array.isArray(body)) {
            // Bulk upsert is ideal, but createMany is faster if we assume new data or don't care about duplicates failing (skipDuplicates)
            // Or transaction of upserts.
            // Using transaction for robust upsert (update if exists, create if not)
            const ops = body.filter(i => i.ma_khoa && i.ten_khoa).map(item =>
                prisma.department.upsert({
                    where: { ma_khoa: String(item.ma_khoa) },
                    update: { 
                        ten_khoa: String(item.ten_khoa),
                        ma_khoa_bv: item.ma_khoa_bv ? String(item.ma_khoa_bv) : undefined,
                        ten_khoa_bv: item.ten_khoa_bv ? String(item.ten_khoa_bv) : undefined
                    },
                    create: { 
                        ma_khoa: String(item.ma_khoa), 
                        ten_khoa: String(item.ten_khoa),
                        ma_khoa_bv: item.ma_khoa_bv ? String(item.ma_khoa_bv) : undefined,
                        ten_khoa_bv: item.ten_khoa_bv ? String(item.ten_khoa_bv) : undefined,
                        type: 'CLINICAL'
                    }
                })
            );
            await prisma.$transaction(ops);
            return NextResponse.json({ message: 'Import successful', count: ops.length });
        } else {
            const { ma_khoa, ten_khoa, ma_khoa_bv, ten_khoa_bv, type, old_ma_khoa } = body;
            if (!ma_khoa || !ten_khoa) {
                return NextResponse.json({ error: 'Missing ma_khoa or ten_khoa' }, { status: 400 });
            }

            // Check if we are changing the primary key
            if (old_ma_khoa && old_ma_khoa !== ma_khoa) {
                try {
                    const item = await prisma.department.update({
                        where: { ma_khoa: old_ma_khoa },
                        data: { ma_khoa, ten_khoa, ma_khoa_bv, ten_khoa_bv, type: type || 'CLINICAL' }
                    });
                    return NextResponse.json(item);
                } catch (error: any) {
                    const errStr = String(error?.message || '');
                    if (error?.code === 'P2003' || errStr.includes('foreign key constraint') || errStr.includes('23001')) {
                        return NextResponse.json({ error: 'Không thể đổi Mã Khoa vì đang có Nhân sự hoặc dữ liệu liên quan. Vui lòng tạo khoa mới và chuyển dữ liệu sang!' }, { status: 400 });
                    }
                    throw error; // Let the outer catch handle it
                }
            }

            const item = await prisma.department.upsert({
                where: { ma_khoa },
                update: { ten_khoa, ma_khoa_bv, ten_khoa_bv, type: type || 'CLINICAL' },
                create: { ma_khoa, ten_khoa, ma_khoa_bv, ten_khoa_bv, type: type || 'CLINICAL' }
            });
            return NextResponse.json(item);
        }
    } catch (error) {
        console.error("Error saving department:", error);
        return NextResponse.json({ error: 'Failed to save department' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const ma_khoa = searchParams.get('ma_khoa');
        const deleteAll = searchParams.get('deleteAll');

        if (deleteAll === 'true') {
            const result = await prisma.department.deleteMany();
            return NextResponse.json({ success: true, count: result.count });
        }

        if (!ma_khoa) return NextResponse.json({ error: 'Missing ma_khoa' }, { status: 400 });

        // Check constraints manually to provide specific error message
        const staffCount = await prisma.staff.count({ where: { ma_khoa } });
        const warehouseCount = await prisma.warehouse.count({ where: { department_id: ma_khoa } });

        if (staffCount > 0 || warehouseCount > 0) {
            let msgParts = [];
            if (staffCount > 0) msgParts.push(`${staffCount} Nhân sự`);
            if (warehouseCount > 0) msgParts.push(`${warehouseCount} Kho vật tư`);
            return NextResponse.json({ 
                error: `Không thể xóa vì Khoa/Phòng này đang chứa ${msgParts.join(' và ')}. Vui lòng chuyển dữ liệu sang khoa khác trước khi xóa.` 
            }, { status: 400 });
        }

        await prisma.department.delete({ where: { ma_khoa } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Delete department error:", error);
        const errStr = String(error?.message || '');
        if (error?.code === 'P2003' || errStr.includes('foreign key constraint') || errStr.includes('23001') || errStr.includes('Foreign key constraint')) {
            return NextResponse.json({ error: 'Không thể xóa Khoa/Phòng này vì đang có Nhân sự hoặc dữ liệu liên quan!' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Lỗi khi xóa: ' + (error?.message || 'Unknown error') }, { status: 500 });
    }
}
