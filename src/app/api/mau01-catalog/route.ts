import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const records = await prisma.departmentCatalog.findMany({
            orderBy: { STT: 'asc' },
        });
        return NextResponse.json(records);
    } catch (error) {
        console.error('Error fetching mau01 catalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (Array.isArray(body)) {
            // Bulk Create
            // Validate and prepare data
            const validBody = body.filter(row => Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== ''));
            const cleanData = validBody.map((row: any) => ({
                STT: row.STT ? Number(row.STT) : null,
                MA_KHOA: String(row.MA_KHOA || '').substring(0, 50),
                TEN_KHOA: String(row.TEN_KHOA || ''),
                BAN_KHAM: row.BAN_KHAM ? Number(row.BAN_KHAM) : null,
                GIUONG_PD: row.GIUONG_PD ? Number(row.GIUONG_PD) : null,
                GIUONG_TK: row.GIUONG_TK ? Number(row.GIUONG_TK) : null,
                GIUONG_HSTC: row.GIUONG_HSTC ? Number(row.GIUONG_HSTC) : null,
                GIUONG_HSCC: row.GIUONG_HSCC ? Number(row.GIUONG_HSCC) : null,
                TU_NGAY: row.TU_NGAY ? String(row.TU_NGAY).substring(0, 8) : null,
                DEN_NGAY: row.DEN_NGAY ? String(row.DEN_NGAY).substring(0, 8) : null,
                MA_CSKCB: row.MA_CSKCB ? String(row.MA_CSKCB).substring(0, 5) : null,
            }));

            // Prisma currently has limited support for createMany with constraints handling in SQLite,
            // but for Postgres createMany is fully supported. We'll use a transaction for safety if needed,
            // or just createMany.
            await prisma.departmentCatalog.deleteMany({}); // Optional: Clear old data before bulk import
            const result = await prisma.departmentCatalog.createMany({
                data: cleanData
            });

            return NextResponse.json({ success: true, count: result.count });
        } else {
            // Single Create
            const row = body;
            const newRecord = await prisma.departmentCatalog.create({
                data: {
                    STT: row.STT ? Number(row.STT) : null,
                    MA_KHOA: String(row.MA_KHOA || '').substring(0, 50),
                    TEN_KHOA: String(row.TEN_KHOA || ''),
                    BAN_KHAM: row.BAN_KHAM ? Number(row.BAN_KHAM) : null,
                    GIUONG_PD: row.GIUONG_PD ? Number(row.GIUONG_PD) : null,
                    GIUONG_TK: row.GIUONG_TK ? Number(row.GIUONG_TK) : null,
                    GIUONG_HSTC: row.GIUONG_HSTC ? Number(row.GIUONG_HSTC) : null,
                    GIUONG_HSCC: row.GIUONG_HSCC ? Number(row.GIUONG_HSCC) : null,
                    TU_NGAY: row.TU_NGAY ? String(row.TU_NGAY).substring(0, 8) : null,
                    DEN_NGAY: row.DEN_NGAY ? String(row.DEN_NGAY).substring(0, 8) : null,
                    MA_CSKCB: row.MA_CSKCB ? String(row.MA_CSKCB).substring(0, 5) : null,
                }
            });
            return NextResponse.json(newRecord);
        }
    } catch (error) {
        console.error('Error creating mau01 catalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const result = await prisma.departmentCatalog.deleteMany({});
        return NextResponse.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Error deleting mau01 catalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
