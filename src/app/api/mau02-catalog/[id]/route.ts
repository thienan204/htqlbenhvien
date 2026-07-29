import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const body = await request.json();

        const updated = await prisma.mau02Catalog.update({
            where: { id },
            data: {
                isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
                STT: body.STT ? Number(body.STT) : null,
                MA_KHOA: body.MA_KHOA ? String(body.MA_KHOA).substring(0, 100) : null,
                TEN_KHOA: body.TEN_KHOA ? String(body.TEN_KHOA) : null,
                HO_TEN: body.HO_TEN ? String(body.HO_TEN).substring(0, 250) : null,
                GIOI_TINH: body.GIOI_TINH ? Number(body.GIOI_TINH) : null,
                SO_DINH_DANH: body.SO_DINH_DANH ? String(body.SO_DINH_DANH).substring(0, 15) : null,
                CHUCDANH_NN: body.CHUCDANH_NN ? String(body.CHUCDANH_NN).substring(0, 2) : null,
                VI_TRI: body.VI_TRI ? String(body.VI_TRI).substring(0, 5) : null,
                MACCHN: body.MACCHN ? String(body.MACCHN).substring(0, 250) : null,
                NGAYCAP_CCHN: body.NGAYCAP_CCHN ? String(body.NGAYCAP_CCHN).substring(0, 8) : null,
                NOICAP_CCHN: body.NOICAP_CCHN ? String(body.NOICAP_CCHN).substring(0, 250) : null,
                PHAMVI_CM: body.PHAMVI_CM ? String(body.PHAMVI_CM).substring(0, 15) : null,
                PHAMVI_CMBS: body.PHAMVI_CMBS ? String(body.PHAMVI_CMBS).substring(0, 50) : null,
                DVKT_KHAC: body.DVKT_KHAC ? String(body.DVKT_KHAC) : null,
                VB_PHANCONG: body.VB_PHANCONG ? String(body.VB_PHANCONG).substring(0, 50) : null,
                THOIGIAN_DK: body.THOIGIAN_DK ? Number(body.THOIGIAN_DK) : null,
                THOIGIAN_NGAY: body.THOIGIAN_NGAY ? String(body.THOIGIAN_NGAY).substring(0, 200) : null,
                THOIGIAN_TUAN: body.THOIGIAN_TUAN ? String(body.THOIGIAN_TUAN).substring(0, 200) : null,
                CSKCB_KHAC: body.CSKCB_KHAC ? String(body.CSKCB_KHAC).substring(0, 30) : null,
                CSKCB_CGKT: body.CSKCB_CGKT ? String(body.CSKCB_CGKT).substring(0, 5) : null,
                QD_CGKT: body.QD_CGKT ? String(body.QD_CGKT).substring(0, 50) : null,
                TU_NGAY: body.TU_NGAY ? String(body.TU_NGAY).substring(0, 8) : null,
                DEN_NGAY: body.DEN_NGAY ? String(body.DEN_NGAY).substring(0, 8) : null,
                MA_CSKCB: body.MA_CSKCB ? String(body.MA_CSKCB).substring(0, 5) : null,
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating mau02 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await prisma.mau02Catalog.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting mau02 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
