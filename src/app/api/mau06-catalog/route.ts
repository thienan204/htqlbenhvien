import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const records = await prisma.mau06Catalog.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(records);
    } catch (error) {
        console.error('Error fetching mau06 catalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const result = await prisma.mau06Catalog.deleteMany({});
        return NextResponse.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Error deleting mau06 catalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Bulk insert
        if (Array.isArray(body)) {
            const validBody = body.filter(row => Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== ''));
            const createData = validBody.map((row: any) => ({
                STT: row.STT ? Number(row.STT) : null,
                TEN_TB: row.TEN_TB ? String(row.TEN_TB) : null,
                KY_HIEU: row.KY_HIEU ? String(row.KY_HIEU) : null,
                CONGTY_SX: row.CONGTY_SX ? String(row.CONGTY_SX) : null,
                NUOC_SX: row.NUOC_SX ? String(row.NUOC_SX).substring(0, 100) : null,
                NAM_SX: row.NAM_SX ? Number(row.NAM_SX) : null,
                NAM_SD: row.NAM_SD ? Number(row.NAM_SD) : null,
                MA_MAY: row.MA_MAY ? String(row.MA_MAY) : null,
                TEN_BV: row.TEN_BV ? String(row.TEN_BV) : null,
                SO_LUU_HANH: row.SO_LUU_HANH ? String(row.SO_LUU_HANH).substring(0, 20) : null,
                HD_TU: row.HD_TU ? String(row.HD_TU).substring(0, 8) : null,
                HD_DEN: row.HD_DEN ? String(row.HD_DEN).substring(0, 8) : null,
                TU_NGAY: row.TU_NGAY ? String(row.TU_NGAY).substring(0, 8) : null,
                DEN_NGAY: row.DEN_NGAY ? String(row.DEN_NGAY).substring(0, 8) : null,
                MA_CSKCB: row.MA_CSKCB ? String(row.MA_CSKCB).substring(0, 5) : null,
                loai_may_code: row.loai_may_code ? String(row.loai_may_code) : null,
            }));

            const result = await prisma.mau06Catalog.createMany({
                data: createData,
                skipDuplicates: true,
            });

            return NextResponse.json({ success: true, count: result.count });
        }

        // Single insert
        const newRecord = await prisma.mau06Catalog.create({
            data: {
                STT: body.STT ? Number(body.STT) : null,
                TEN_TB: body.TEN_TB ? String(body.TEN_TB) : null,
                KY_HIEU: body.KY_HIEU ? String(body.KY_HIEU) : null,
                CONGTY_SX: body.CONGTY_SX ? String(body.CONGTY_SX) : null,
                NUOC_SX: body.NUOC_SX ? String(body.NUOC_SX).substring(0, 100) : null,
                NAM_SX: body.NAM_SX ? Number(body.NAM_SX) : null,
                NAM_SD: body.NAM_SD ? Number(body.NAM_SD) : null,
                MA_MAY: body.MA_MAY ? String(body.MA_MAY) : null,
                TEN_BV: body.TEN_BV ? String(body.TEN_BV) : null,
                SO_LUU_HANH: body.SO_LUU_HANH ? String(body.SO_LUU_HANH).substring(0, 20) : null,
                HD_TU: body.HD_TU ? String(body.HD_TU).substring(0, 8) : null,
                HD_DEN: body.HD_DEN ? String(body.HD_DEN).substring(0, 8) : null,
                TU_NGAY: body.TU_NGAY ? String(body.TU_NGAY).substring(0, 8) : null,
                DEN_NGAY: body.DEN_NGAY ? String(body.DEN_NGAY).substring(0, 8) : null,
                MA_CSKCB: body.MA_CSKCB ? String(body.MA_CSKCB).substring(0, 5) : null,
                loai_may_code: body.loai_may_code ? String(body.loai_may_code) : null,
                isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
            }
        });

        return NextResponse.json(newRecord);
    } catch (error) {
        console.error('Error creating mau06 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
