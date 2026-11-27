import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    authorizeApiRequest,
    createDeleteSnapshot,
    parseDeleteIdsFromRequest,
    SnapshotLimitError,
} from '@/lib/deleteProtection';

export async function GET() {
    try {
        const records = await prisma.mau02Catalog.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(records);
    } catch (error) {
        console.error('Error fetching mau02 catalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const selectedIds = await parseDeleteIdsFromRequest(request);
        if (selectedIds.length > 0) {
            const auth = await authorizeApiRequest(request, {
                allowedRoles: ['ADMIN', 'CNTT', 'VTYT', 'PTCCB', 'TCCB'],
                menuKeys: ['MENU_CATALOG_02', 'MENU_STAFF'],
                action: 'DELETE',
            });
            if (auth.errorResponse) return auth.errorResponse;

            const result = await prisma.$transaction(
                async (tx) => {
                    const targetRows = await tx.mau02Catalog.findMany({
                        where: { id: { in: selectedIds } },
                    });
                    const snap = await createDeleteSnapshot({
                        tx,
                        tableName: 'Mau02Catalog',
                        displayName: `Mẫu 02 (Xóa ${targetRows.length} dòng đã chọn)`,
                        actionType: 'BULK_DELETE',
                        filterSummary: `${selectedIds.length} dòng đã chọn`,
                        recordsCount: targetRows.length,
                        data: targetRows,
                        user: auth.user,
                    });
                    const deleted = await tx.mau02Catalog.deleteMany({
                        where: { id: { in: selectedIds } },
                    });
                    return { count: deleted.count, snapshotId: snap.snapshotId };
                },
                { timeout: 30000 }
            );

            return NextResponse.json({ success: true, ...result });
        }

        const auth = await authorizeApiRequest(request, { requireAdmin: true });
        if (auth.errorResponse) return auth.errorResponse;

        const { searchParams } = new URL(request.url);
        if (searchParams.get('confirmDeleteAll') !== 'true') {
            return NextResponse.json(
                { error: 'Thiếu xác nhận confirmDeleteAll=true khi xóa toàn bộ Danh mục Mẫu 02.' },
                { status: 400 }
            );
        }

        const result = await prisma.$transaction(
            async (tx) => {
                const oldRows = await tx.mau02Catalog.findMany();
                const snap = await createDeleteSnapshot({
                    tx,
                    tableName: 'Mau02Catalog',
                    displayName: 'Toàn bộ Danh mục Mẫu 02 (Nhân viên y tế)',
                    actionType: 'DELETE_ALL',
                    filterSummary: 'Toàn bệnh viện',
                    recordsCount: oldRows.length,
                    data: oldRows,
                    user: auth.user,
                });
                const deleted = await tx.mau02Catalog.deleteMany({});
                return { count: deleted.count, snapshotId: snap.snapshotId };
            },
            { timeout: 30000 }
        );

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error('Error deleting mau02 catalog:', error);
        if (error instanceof SnapshotLimitError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
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
                MA_KHOA: row.MA_KHOA ? String(row.MA_KHOA).substring(0, 100) : null,
                TEN_KHOA: row.TEN_KHOA ? String(row.TEN_KHOA) : null,
                HO_TEN: row.HO_TEN ? String(row.HO_TEN).substring(0, 250) : null,
                GIOI_TINH: row.GIOI_TINH ? Number(row.GIOI_TINH) : null,
                SO_DINH_DANH: row.SO_DINH_DANH ? String(row.SO_DINH_DANH).substring(0, 15) : null,
                CHUCDANH_NN: row.CHUCDANH_NN ? String(row.CHUCDANH_NN).substring(0, 2) : null,
                VI_TRI: row.VI_TRI ? String(row.VI_TRI).substring(0, 5) : null,
                MACCHN: row.MACCHN ? String(row.MACCHN).substring(0, 250) : null,
                NGAYCAP_CCHN: row.NGAYCAP_CCHN ? String(row.NGAYCAP_CCHN).substring(0, 8) : null,
                NOICAP_CCHN: row.NOICAP_CCHN ? String(row.NOICAP_CCHN).substring(0, 250) : null,
                PHAMVI_CM: row.PHAMVI_CM ? String(row.PHAMVI_CM).substring(0, 15) : null,
                PHAMVI_CMBS: row.PHAMVI_CMBS ? String(row.PHAMVI_CMBS).substring(0, 50) : null,
                DVKT_KHAC: row.DVKT_KHAC ? String(row.DVKT_KHAC) : null,
                VB_PHANCONG: row.VB_PHANCONG ? String(row.VB_PHANCONG).substring(0, 50) : null,
                THOIGIAN_DK: row.THOIGIAN_DK ? Number(row.THOIGIAN_DK) : null,
                THOIGIAN_NGAY: row.THOIGIAN_NGAY ? String(row.THOIGIAN_NGAY).substring(0, 200) : null,
                THOIGIAN_TUAN: row.THOIGIAN_TUAN ? String(row.THOIGIAN_TUAN).substring(0, 200) : null,
                CSKCB_KHAC: row.CSKCB_KHAC ? String(row.CSKCB_KHAC).substring(0, 30) : null,
                CSKCB_CGKT: row.CSKCB_CGKT ? String(row.CSKCB_CGKT).substring(0, 5) : null,
                QD_CGKT: row.QD_CGKT ? String(row.QD_CGKT).substring(0, 50) : null,
                TU_NGAY: row.TU_NGAY ? String(row.TU_NGAY).substring(0, 8) : null,
                DEN_NGAY: row.DEN_NGAY ? String(row.DEN_NGAY).substring(0, 8) : null,
                MA_CSKCB: row.MA_CSKCB ? String(row.MA_CSKCB).substring(0, 5) : null,
            }));

            const result = await prisma.mau02Catalog.createMany({
                data: createData,
                skipDuplicates: true,
            });

            return NextResponse.json({ success: true, count: result.count });
        }

        // Single insert
        const newRecord = await prisma.mau02Catalog.create({
            data: {
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

        return NextResponse.json(newRecord);
    } catch (error) {
        console.error('Error creating mau02 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
