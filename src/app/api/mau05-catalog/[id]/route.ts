import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authorizeApiRequest } from '@/lib/deleteProtection';

const prisma = new PrismaClient();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const body = await request.json();

        const updateData: any = {};
        if (body.STT !== undefined) updateData.STT = body.STT ? Number(body.STT) : null;
        if (body.MA_DICH_VU !== undefined) updateData.MA_DICH_VU = body.MA_DICH_VU ? String(body.MA_DICH_VU).substring(0, 20) : null;
        if (body.TEN_DICH_VU !== undefined) updateData.TEN_DICH_VU = body.TEN_DICH_VU ? String(body.TEN_DICH_VU) : null;
        if (body.TEN_DVKT_GIA !== undefined) updateData.TEN_DVKT_GIA = body.TEN_DVKT_GIA ? String(body.TEN_DVKT_GIA) : null;
        if (body.DON_GIA !== undefined) updateData.DON_GIA = body.DON_GIA !== null && body.DON_GIA !== '' ? Number(body.DON_GIA) : null;
        if (body.QUY_TRINH !== undefined) updateData.QUY_TRINH = body.QUY_TRINH ? String(body.QUY_TRINH).substring(0, 50) : null;
        if (body.SO_LUONG_CGKT !== undefined) updateData.SO_LUONG_CGKT = body.SO_LUONG_CGKT ? Number(body.SO_LUONG_CGKT) : null;
        if (body.CSKCB_CGKT !== undefined) updateData.CSKCB_CGKT = body.CSKCB_CGKT ? String(body.CSKCB_CGKT).substring(0, 5) : null;
        if (body.CSKCB_CLS !== undefined) updateData.CSKCB_CLS = body.CSKCB_CLS ? String(body.CSKCB_CLS).substring(0, 5) : null;
        if (body.QD_DVKT !== undefined) updateData.QD_DVKT = body.QD_DVKT ? String(body.QD_DVKT).substring(0, 50) : null;
        if (body.QD_PD_GIA !== undefined) updateData.QD_PD_GIA = body.QD_PD_GIA ? String(body.QD_PD_GIA).substring(0, 50) : null;
        if (body.GHI_CHU !== undefined) updateData.GHI_CHU = body.GHI_CHU ? String(body.GHI_CHU) : null;
        if (body.MA_THUOC !== undefined) updateData.MA_THUOC = body.MA_THUOC ? String(body.MA_THUOC).substring(0, 15) : null;
        if (body.TEN_THUOC !== undefined) updateData.TEN_THUOC = body.TEN_THUOC ? String(body.TEN_THUOC) : null;
        if (body.SO_DANG_KY !== undefined) updateData.SO_DANG_KY = body.SO_DANG_KY ? String(body.SO_DANG_KY).substring(0, 50) : null;
        if (body.DON_VI_TINH !== undefined) updateData.DON_VI_TINH = body.DON_VI_TINH ? String(body.DON_VI_TINH) : null;
        if (body.TT_THAU !== undefined) updateData.TT_THAU = body.TT_THAU ? String(body.TT_THAU) : null;
        if (body.DON_GIA_THUOC !== undefined) updateData.DON_GIA_THUOC = body.DON_GIA_THUOC ? Number(body.DON_GIA_THUOC) : null;
        if (body.DM_NSX_CDD !== undefined) updateData.DM_NSX_CDD = body.DM_NSX_CDD ? Number(body.DM_NSX_CDD) : null;
        if (body.DM_THUCTE_CDD !== undefined) updateData.DM_THUCTE_CDD = body.DM_THUCTE_CDD ? Number(body.DM_THUCTE_CDD) : null;
        if (body.LIEU_BQ_PX !== undefined) updateData.LIEU_BQ_PX = body.LIEU_BQ_PX ? Number(body.LIEU_BQ_PX) : null;
        if (body.TL_THUCTE_BQ_PX !== undefined) updateData.TL_THUCTE_BQ_PX = body.TL_THUCTE_BQ_PX ? Number(body.TL_THUCTE_BQ_PX) : null;
        if (body.THANH_TIEN_THUOC !== undefined) updateData.THANH_TIEN_THUOC = body.THANH_TIEN_THUOC ? Number(body.THANH_TIEN_THUOC) : null;
        if (body.GIA_THANH_TOAN !== undefined) updateData.GIA_THANH_TOAN = body.GIA_THANH_TOAN ? Number(body.GIA_THANH_TOAN) : null;
        if (body.TU_NGAY !== undefined) updateData.TU_NGAY = body.TU_NGAY ? String(body.TU_NGAY).substring(0, 8) : null;
        if (body.DEN_NGAY !== undefined) updateData.DEN_NGAY = body.DEN_NGAY ? String(body.DEN_NGAY).substring(0, 8) : null;
        if (body.MA_CSKCB !== undefined) updateData.MA_CSKCB = body.MA_CSKCB ? String(body.MA_CSKCB).substring(0, 5) : null;
        if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
        if (body.bat_buoc_co_ma_may !== undefined) updateData.bat_buoc_co_ma_may = Boolean(body.bat_buoc_co_ma_may);
        if (body.nguon_du_lieu !== undefined) updateData.nguon_du_lieu = String(body.nguon_du_lieu);
        if (body.ngay_hieu_luc_bhyt !== undefined) updateData.ngay_hieu_luc_bhyt = body.ngay_hieu_luc_bhyt ? String(body.ngay_hieu_luc_bhyt) : null;

        const updated = await prisma.mau05Catalog.update({
            where: { id },
            data: updateData
        });

        // Nếu có cập nhật trạng thái bắt buộc mã máy, đồng bộ cho tất cả bản ghi có cùng MA_DICH_VU
        if (body.bat_buoc_co_ma_may !== undefined && updated.MA_DICH_VU) {
            await prisma.mau05Catalog.updateMany({
                where: { MA_DICH_VU: updated.MA_DICH_VU },
                data: { bat_buoc_co_ma_may: Boolean(body.bat_buoc_co_ma_may) }
            });
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating mau05 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeApiRequest(request, {
            allowedRoles: ['ADMIN', 'CNTT', 'VTYT'],
            menuKeys: ['MENU_CATALOG_05'],
            action: 'DELETE',
        });
        if (auth.errorResponse) return auth.errorResponse;

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
