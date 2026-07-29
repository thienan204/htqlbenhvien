import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const records = await prisma.mau04Catalog.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(records);
    } catch (error) {
        console.error('Error fetching mau04 catalog:', error);
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
                MA_VAT_TU: row.MA_VAT_TU ? String(row.MA_VAT_TU).substring(0, 50) : null,
                NHOM_VAT_TU: row.NHOM_VAT_TU ? String(row.NHOM_VAT_TU) : null,
                TEN_VAT_TU: row.TEN_VAT_TU ? String(row.TEN_VAT_TU) : null,
                MA_HIEU: row.MA_HIEU ? String(row.MA_HIEU) : null,
                SO_LUU_HANH: row.SO_LUU_HANH ? String(row.SO_LUU_HANH).substring(0, 20) : null,
                TINHNANG_KT: row.TINHNANG_KT ? String(row.TINHNANG_KT) : null,
                QUY_CACH: row.QUY_CACH ? String(row.QUY_CACH) : null,
                HANG_SX: row.HANG_SX ? String(row.HANG_SX) : null,
                NUOC_SX: row.NUOC_SX ? String(row.NUOC_SX).substring(0, 100) : null,
                DON_VI_TINH: row.DON_VI_TINH ? String(row.DON_VI_TINH).substring(0, 50) : null,
                DON_GIA: row.DON_GIA ? Number(row.DON_GIA) : null,
                DON_GIA_BH: row.DON_GIA_BH ? Number(row.DON_GIA_BH) : null,
                TYLE_TT_BH: row.TYLE_TT_BH ? Number(row.TYLE_TT_BH) : null,
                SO_LUONG: row.SO_LUONG ? Number(row.SO_LUONG) : null,
                DINH_MUC: row.DINH_MUC ? Number(row.DINH_MUC) : null,
                NHA_THAU: row.NHA_THAU ? String(row.NHA_THAU) : null,
                TT_THAU: row.TT_THAU ? String(row.TT_THAU).substring(0, 50) : null,
                TU_NGAY_HD: row.TU_NGAY_HD ? String(row.TU_NGAY_HD).substring(0, 8) : null,
                DEN_NGAY_HD: row.DEN_NGAY_HD ? String(row.DEN_NGAY_HD).substring(0, 8) : null,
                MA_CSKCB: row.MA_CSKCB ? String(row.MA_CSKCB).substring(0, 5) : null,
                LOAI_THAU: row.LOAI_THAU ? Number(row.LOAI_THAU) : null,
                HT_THAU: row.HT_THAU ? Number(row.HT_THAU) : null,
                MA_CSKCB_TBYT: row.MA_CSKCB_TBYT ? String(row.MA_CSKCB_TBYT).substring(0, 5) : null,
                TU_NGAY: row.TU_NGAY ? String(row.TU_NGAY).substring(0, 8) : null,
                DEN_NGAY: row.DEN_NGAY ? String(row.DEN_NGAY).substring(0, 8) : null,
            }));

            const result = await prisma.mau04Catalog.createMany({
                data: createData,
                skipDuplicates: true,
            });

            return NextResponse.json({ success: true, count: result.count });
        }

        // Single insert
        const newRecord = await prisma.mau04Catalog.create({
            data: {
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

        return NextResponse.json(newRecord);
    } catch (error) {
        console.error('Error creating mau04 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const result = await prisma.mau04Catalog.deleteMany({});
        return NextResponse.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Error deleting all mau04 catalog records:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
