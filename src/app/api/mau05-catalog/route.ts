import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const records = await prisma.mau05Catalog.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(records);
    } catch (error) {
        console.error('Error fetching mau05 catalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const result = await prisma.mau05Catalog.deleteMany({});
        return NextResponse.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Error deleting mau05 catalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Bulk insert
        if (Array.isArray(body)) {
            const createData = body.map((row: any) => ({
                STT: row.STT ? Number(row.STT) : null,
                MA_DICH_VU: row.MA_DICH_VU ? String(row.MA_DICH_VU).substring(0, 20) : null,
                TEN_DICH_VU: row.TEN_DICH_VU ? String(row.TEN_DICH_VU) : null,
                TEN_DVKT_GIA: row.TEN_DVKT_GIA ? String(row.TEN_DVKT_GIA) : null,
                DON_GIA: row.DON_GIA ? Number(row.DON_GIA) : null,
                QUY_TRINH: row.QUY_TRINH ? String(row.QUY_TRINH).substring(0, 50) : null,
                SO_LUONG_CGKT: row.SO_LUONG_CGKT ? Number(row.SO_LUONG_CGKT) : null,
                CSKCB_CGKT: row.CSKCB_CGKT ? String(row.CSKCB_CGKT).substring(0, 5) : null,
                CSKCB_CLS: row.CSKCB_CLS ? String(row.CSKCB_CLS).substring(0, 5) : null,
                QD_DVKT: row.QD_DVKT ? String(row.QD_DVKT).substring(0, 50) : null,
                QD_PD_GIA: row.QD_PD_GIA ? String(row.QD_PD_GIA).substring(0, 50) : null,
                GHI_CHU: row.GHI_CHU ? String(row.GHI_CHU) : null,
                MA_THUOC: row.MA_THUOC ? String(row.MA_THUOC).substring(0, 15) : null,
                TEN_THUOC: row.TEN_THUOC ? String(row.TEN_THUOC) : null,
                SO_DANG_KY: row.SO_DANG_KY ? String(row.SO_DANG_KY).substring(0, 50) : null,
                DON_VI_TINH: row.DON_VI_TINH ? String(row.DON_VI_TINH) : null,
                TT_THAU: row.TT_THAU ? String(row.TT_THAU) : null,
                DON_GIA_THUOC: row.DON_GIA_THUOC ? Number(row.DON_GIA_THUOC) : null,
                DM_NSX_CDD: row.DM_NSX_CDD ? Number(row.DM_NSX_CDD) : null,
                DM_THUCTE_CDD: row.DM_THUCTE_CDD ? Number(row.DM_THUCTE_CDD) : null,
                LIEU_BQ_PX: row.LIEU_BQ_PX ? Number(row.LIEU_BQ_PX) : null,
                TL_THUCTE_BQ_PX: row.TL_THUCTE_BQ_PX ? Number(row.TL_THUCTE_BQ_PX) : null,
                THANH_TIEN_THUOC: row.THANH_TIEN_THUOC ? Number(row.THANH_TIEN_THUOC) : null,
                GIA_THANH_TOAN: row.GIA_THANH_TOAN ? Number(row.GIA_THANH_TOAN) : null,
                TU_NGAY: row.TU_NGAY ? String(row.TU_NGAY).substring(0, 8) : null,
                DEN_NGAY: row.DEN_NGAY ? String(row.DEN_NGAY).substring(0, 8) : null,
                MA_CSKCB: row.MA_CSKCB ? String(row.MA_CSKCB).substring(0, 5) : null,
            }));

            const result = await prisma.mau05Catalog.createMany({
                data: createData,
                skipDuplicates: true,
            });

            return NextResponse.json({ success: true, count: result.count });
        }

        // Single insert
        const newRecord = await prisma.mau05Catalog.create({
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
            }
        });

        return NextResponse.json(newRecord);
    } catch (error) {
        console.error('Error creating mau05 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
