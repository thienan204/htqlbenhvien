import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const body = await request.json();

        const updated = await prisma.mau04Catalog.update({
            where: { id },
            data: {
                isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
                STT: body.STT ? Number(body.STT) : null,
                MA_VAT_TU: body.MA_VAT_TU ? String(body.MA_VAT_TU).substring(0, 50) : null,
                NHOM_VAT_TU: body.NHOM_VAT_TU ? String(body.NHOM_VAT_TU) : null,
                TEN_VAT_TU: body.TEN_VAT_TU ? String(body.TEN_VAT_TU) : null,
                MA_HIEU: body.MA_HIEU ? String(body.MA_HIEU) : null,
                SO_LUU_HANH: body.SO_LUU_HANH ? String(body.SO_LUU_HANH).substring(0, 20) : null,
                TINHNANG_KT: body.TINHNANG_KT ? String(body.TINHNANG_KT) : null,
                QUY_CACH: body.QUY_CACH ? String(body.QUY_CACH) : null,
                HANG_SX: body.HANG_SX ? String(body.HANG_SX) : null,
                NUOC_SX: body.NUOC_SX ? String(body.NUOC_SX).substring(0, 100) : null,
                DON_VI_TINH: body.DON_VI_TINH ? String(body.DON_VI_TINH).substring(0, 50) : null,
                DON_GIA: body.DON_GIA ? Number(body.DON_GIA) : null,
                DON_GIA_BH: body.DON_GIA_BH ? Number(body.DON_GIA_BH) : null,
                TYLE_TT_BH: body.TYLE_TT_BH ? Number(body.TYLE_TT_BH) : null,
                SO_LUONG: body.SO_LUONG ? Number(body.SO_LUONG) : null,
                DINH_MUC: body.DINH_MUC ? Number(body.DINH_MUC) : null,
                NHA_THAU: body.NHA_THAU ? String(body.NHA_THAU) : null,
                TT_THAU: body.TT_THAU ? String(body.TT_THAU).substring(0, 50) : null,
                TU_NGAY_HD: body.TU_NGAY_HD ? String(body.TU_NGAY_HD).substring(0, 8) : null,
                DEN_NGAY_HD: body.DEN_NGAY_HD ? String(body.DEN_NGAY_HD).substring(0, 8) : null,
                MA_CSKCB: body.MA_CSKCB ? String(body.MA_CSKCB).substring(0, 5) : null,
                LOAI_THAU: body.LOAI_THAU ? Number(body.LOAI_THAU) : null,
                HT_THAU: body.HT_THAU ? Number(body.HT_THAU) : null,
                MA_CSKCB_TBYT: body.MA_CSKCB_TBYT ? String(body.MA_CSKCB_TBYT).substring(0, 5) : null,
                TU_NGAY: body.TU_NGAY ? String(body.TU_NGAY).substring(0, 8) : null,
                DEN_NGAY: body.DEN_NGAY ? String(body.DEN_NGAY).substring(0, 8) : null,
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating mau04 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await prisma.mau04Catalog.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting mau04 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
