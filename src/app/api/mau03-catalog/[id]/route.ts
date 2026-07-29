import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const body = await request.json();

        const updated = await prisma.mau03Catalog.update({
            where: { id },
            data: {
                isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
                STT: body.STT ? Number(body.STT) : null,
                MA_THUOC: body.MA_THUOC ? String(body.MA_THUOC).substring(0, 255) : null,
                TEN_HOAT_CHAT: body.TEN_HOAT_CHAT ? String(body.TEN_HOAT_CHAT) : null,
                TEN_THUOC: body.TEN_THUOC ? String(body.TEN_THUOC) : null,
                DON_VI_TINH: body.DON_VI_TINH ? String(body.DON_VI_TINH).substring(0, 50) : null,
                HAM_LUONG: body.HAM_LUONG ? String(body.HAM_LUONG) : null,
                DUONG_DUNG: body.DUONG_DUNG ? String(body.DUONG_DUNG).substring(0, 255) : null,
                MA_DUONG_DUNG: body.MA_DUONG_DUNG ? String(body.MA_DUONG_DUNG).substring(0, 10) : null,
                DANG_BAO_CHE: body.DANG_BAO_CHE ? String(body.DANG_BAO_CHE) : null,
                SO_DANG_KY: body.SO_DANG_KY ? String(body.SO_DANG_KY) : null,
                SO_LUONG: body.SO_LUONG ? Number(body.SO_LUONG) : null,
                DON_GIA: body.DON_GIA ? Number(body.DON_GIA) : null,
                DON_GIA_BH: body.DON_GIA_BH ? Number(body.DON_GIA_BH) : null,
                QUY_CACH: body.QUY_CACH ? String(body.QUY_CACH) : null,
                NHA_SX: body.NHA_SX ? String(body.NHA_SX) : null,
                NUOC_SX: body.NUOC_SX ? String(body.NUOC_SX).substring(0, 100) : null,
                NHA_THAU: body.NHA_THAU ? String(body.NHA_THAU) : null,
                TT_THAU: body.TT_THAU ? String(body.TT_THAU).substring(0, 50) : null,
                TU_NGAY_HD: body.TU_NGAY_HD ? String(body.TU_NGAY_HD).substring(0, 8) : null,
                DEN_NGAY_HD: body.DEN_NGAY_HD ? String(body.DEN_NGAY_HD).substring(0, 8) : null,
                MA_CSKCB: body.MA_CSKCB ? String(body.MA_CSKCB).substring(0, 5) : null,
                LOAI_THUOC: body.LOAI_THUOC ? Number(body.LOAI_THUOC) : null,
                LOAI_THAU: body.LOAI_THAU ? Number(body.LOAI_THAU) : null,
                HT_THAU: body.HT_THAU ? Number(body.HT_THAU) : null,
                MA_DVKT: body.MA_DVKT ? String(body.MA_DVKT) : null,
                TCCL: body.TCCL ? String(body.TCCL).substring(0, 50) : null,
                BO_PHAN_VT: body.BO_PHAN_VT ? Number(body.BO_PHAN_VT) : null,
                TEN_KHOA_HOC: body.TEN_KHOA_HOC ? String(body.TEN_KHOA_HOC).substring(0, 500) : null,
                NGUON_GOC: body.NGUON_GOC ? String(body.NGUON_GOC).substring(0, 500) : null,
                PP_CHEBIEN: body.PP_CHEBIEN ? String(body.PP_CHEBIEN) : null,
                MA_DL_NHAP: body.MA_DL_NHAP ? String(body.MA_DL_NHAP).substring(0, 3) : null,
                MA_DL_CB: body.MA_DL_CB ? String(body.MA_DL_CB).substring(0, 3) : null,
                TLHH_CB: body.TLHH_CB ? Number(body.TLHH_CB) : null,
                TLHH_BQ: body.TLHH_BQ ? Number(body.TLHH_BQ) : null,
                MA_CSKCB_THUOC: body.MA_CSKCB_THUOC ? String(body.MA_CSKCB_THUOC).substring(0, 5) : null,
                TU_NGAY: body.TU_NGAY ? String(body.TU_NGAY).substring(0, 8) : null,
                DEN_NGAY: body.DEN_NGAY ? String(body.DEN_NGAY).substring(0, 8) : null,
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating mau03 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await prisma.mau03Catalog.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting mau03 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
