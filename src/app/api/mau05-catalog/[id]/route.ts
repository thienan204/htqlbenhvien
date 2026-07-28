import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const body = await request.json();

        const updated = await prisma.mau05Catalog.update({
            where: { id },
            data: {
                STT: body.STT ? Number(body.STT) : null,
                MA_DICH_VU: body.MA_DICH_VU ? String(body.MA_DICH_VU).substring(0, 20) : null,
                TEN_DICH_VU: body.TEN_DICH_VU ? String(body.TEN_DICH_VU) : null,
                TEN_DVKT_GIA: body.TEN_DVKT_GIA ? String(body.TEN_DVKT_GIA) : null,
                DON_GIA: body.DON_GIA ? Number(body.DON_GIA) : null,
                QUY_TRINH: body.QUY_TRINH ? String(body.QUY_TRINH).substring(0, 50) : null,
                SO_LUONG_CGKT: body.SO_LUONG_CGKT ? Number(body.SO_LUONG_CGKT) : null,
                CSKCB_CGKT: body.CSKCB_CGKT ? String(body.CSKCB_CGKT).substring(0, 5) : null,
                CSKCB_CLS: body.CSKCB_CLS ? String(body.CSKCB_CLS).substring(0, 5) : null,
                QD_DVKT: body.QD_DVKT ? String(body.QD_DVKT).substring(0, 50) : null,
                QD_PD_GIA: body.QD_PD_GIA ? String(body.QD_PD_GIA).substring(0, 50) : null,
                GHI_CHU: body.GHI_CHU ? String(body.GHI_CHU) : null,
                MA_THUOC: body.MA_THUOC ? String(body.MA_THUOC).substring(0, 15) : null,
                TEN_THUOC: body.TEN_THUOC ? String(body.TEN_THUOC) : null,
                SO_DANG_KY: body.SO_DANG_KY ? String(body.SO_DANG_KY).substring(0, 50) : null,
                DON_VI_TINH: body.DON_VI_TINH ? String(body.DON_VI_TINH) : null,
                TT_THAU: body.TT_THAU ? String(body.TT_THAU) : null,
                DON_GIA_THUOC: body.DON_GIA_THUOC ? Number(body.DON_GIA_THUOC) : null,
                DM_NSX_CDD: body.DM_NSX_CDD ? Number(body.DM_NSX_CDD) : null,
                DM_THUCTE_CDD: body.DM_THUCTE_CDD ? Number(body.DM_THUCTE_CDD) : null,
                LIEU_BQ_PX: body.LIEU_BQ_PX ? Number(body.LIEU_BQ_PX) : null,
                TL_THUCTE_BQ_PX: body.TL_THUCTE_BQ_PX ? Number(body.TL_THUCTE_BQ_PX) : null,
                THANH_TIEN_THUOC: body.THANH_TIEN_THUOC ? Number(body.THANH_TIEN_THUOC) : null,
                GIA_THANH_TOAN: body.GIA_THANH_TOAN ? Number(body.GIA_THANH_TOAN) : null,
                TU_NGAY: body.TU_NGAY ? String(body.TU_NGAY).substring(0, 8) : null,
                DEN_NGAY: body.DEN_NGAY ? String(body.DEN_NGAY).substring(0, 8) : null,
                MA_CSKCB: body.MA_CSKCB ? String(body.MA_CSKCB).substring(0, 5) : null,
                isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating mau05 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await prisma.mau05Catalog.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting mau05 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
