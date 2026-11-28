import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authorizeMau06Action, normalizeMaDichVuList } from '../_auth';

const prisma = new PrismaClient();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeMau06Action(request, 'EDIT');
        if (auth.errorResponse) return auth.errorResponse;

        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const body = await request.json();

        const updateData: any = {};
        if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
        if (body.STT !== undefined) updateData.STT = body.STT ? Number(body.STT) : null;
        if (body.TEN_TB !== undefined) updateData.TEN_TB = body.TEN_TB ? String(body.TEN_TB).trim() : null;
        if (body.KY_HIEU !== undefined) updateData.KY_HIEU = body.KY_HIEU ? String(body.KY_HIEU).trim() : null;
        if (body.CONGTY_SX !== undefined) updateData.CONGTY_SX = body.CONGTY_SX ? String(body.CONGTY_SX).trim() : null;
        if (body.NUOC_SX !== undefined) updateData.NUOC_SX = body.NUOC_SX ? String(body.NUOC_SX).trim().substring(0, 100) : null;
        if (body.NAM_SX !== undefined) updateData.NAM_SX = body.NAM_SX ? Number(body.NAM_SX) : null;
        if (body.NAM_SD !== undefined) updateData.NAM_SD = body.NAM_SD ? Number(body.NAM_SD) : null;
        if (body.MA_MAY !== undefined) updateData.MA_MAY = body.MA_MAY ? String(body.MA_MAY).trim() : null;
        if (body.TEN_BV !== undefined) updateData.TEN_BV = body.TEN_BV ? String(body.TEN_BV).trim() : null;
        if (body.SO_LUU_HANH !== undefined) updateData.SO_LUU_HANH = body.SO_LUU_HANH ? String(body.SO_LUU_HANH).trim().substring(0, 20) : null;
        if (body.HD_TU !== undefined) updateData.HD_TU = body.HD_TU ? String(body.HD_TU).trim().substring(0, 8) : null;
        if (body.HD_DEN !== undefined) updateData.HD_DEN = body.HD_DEN ? String(body.HD_DEN).trim().substring(0, 8) : null;
        if (body.TU_NGAY !== undefined) updateData.TU_NGAY = body.TU_NGAY ? String(body.TU_NGAY).trim().substring(0, 8) : null;
        if (body.DEN_NGAY !== undefined) updateData.DEN_NGAY = body.DEN_NGAY ? String(body.DEN_NGAY).trim().substring(0, 8) : null;
        if (body.MA_CSKCB !== undefined) updateData.MA_CSKCB = body.MA_CSKCB ? String(body.MA_CSKCB).trim().substring(0, 5) : null;
        if (body.loai_may_code !== undefined) updateData.loai_may_code = body.loai_may_code ? String(body.loai_may_code).trim() : null;
        if (body.ma_dich_vu_thuc_hien !== undefined) updateData.ma_dich_vu_thuc_hien = normalizeMaDichVuList(body.ma_dich_vu_thuc_hien);

        const updated = await prisma.mau06Catalog.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating mau06 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeMau06Action(request, 'DELETE');
        if (auth.errorResponse) return auth.errorResponse;

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
