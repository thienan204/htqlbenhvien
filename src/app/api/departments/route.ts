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
                    update: { ten_khoa: String(item.ten_khoa) },
                    create: { ma_khoa: String(item.ma_khoa), ten_khoa: String(item.ten_khoa) }
                })
            );
            await prisma.$transaction(ops);
            return NextResponse.json({ message: 'Import successful', count: ops.length });
        } else {
            const { ma_khoa, ten_khoa } = body;
            if (!ma_khoa || !ten_khoa) {
                return NextResponse.json({ error: 'Missing ma_khoa or ten_khoa' }, { status: 400 });
            }
            const item = await prisma.department.upsert({
                where: { ma_khoa },
                update: { ten_khoa },
                create: { ma_khoa, ten_khoa }
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
        if (!ma_khoa) return NextResponse.json({ error: 'Missing ma_khoa' }, { status: 400 });

        await prisma.department.delete({ where: { ma_khoa } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error.code === 'P2003') {
            return NextResponse.json({ error: 'Không thể xóa Khoa/Phòng này vì đang có Nhân viên hoặc dữ liệu liên quan!' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Lỗi khi xóa' }, { status: 500 });
    }
}
