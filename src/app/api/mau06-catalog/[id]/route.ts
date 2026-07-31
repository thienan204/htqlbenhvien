import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const body = await request.json();

        const updated = await prisma.mau06Catalog.update({
            where: { id },
            data: {
                isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
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
                loai_may_code: body.loai_may_code !== undefined ? (body.loai_may_code ? String(body.loai_may_code) : null) : undefined,
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating mau06 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await prisma.mau06Catalog.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting mau06 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
