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
        const records = await prisma.departmentCatalog.findMany({
            orderBy: { STT: 'asc' },
        });
        return NextResponse.json(records);
    } catch (error) {
        console.error('Error fetching mau01 catalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await authorizeApiRequest(request, {
            allowedRoles: ['ADMIN', 'CNTT', 'VTYT', 'PTCCB', 'TCCB'],
            menuKeys: ['MENU_CATALOG_01', 'MENU_MAU01_CATALOG'],
            action: 'EDIT',
        });
        if (auth.errorResponse) return auth.errorResponse;

        const body = await request.json();

        if (Array.isArray(body)) {
            // Bulk Create
            // Validate and prepare data
            const validBody = body.filter(row => Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== ''));
            const cleanData = validBody.map((row: any) => ({
                STT: row.STT ? Number(row.STT) : null,
                MA_KHOA: String(row.MA_KHOA || '').substring(0, 50),
                TEN_KHOA: String(row.TEN_KHOA || ''),
                BAN_KHAM: row.BAN_KHAM ? Number(row.BAN_KHAM) : null,
                GIUONG_PD: row.GIUONG_PD ? Number(row.GIUONG_PD) : null,
                GIUONG_TK: row.GIUONG_TK ? Number(row.GIUONG_TK) : null,
                GIUONG_HSTC: row.GIUONG_HSTC ? Number(row.GIUONG_HSTC) : null,
                GIUONG_HSCC: row.GIUONG_HSCC ? Number(row.GIUONG_HSCC) : null,
                TU_NGAY: row.TU_NGAY ? String(row.TU_NGAY).substring(0, 8) : null,
                DEN_NGAY: row.DEN_NGAY ? String(row.DEN_NGAY).substring(0, 8) : null,
                MA_CSKCB: row.MA_CSKCB ? String(row.MA_CSKCB).substring(0, 5) : null,
            }));

            const result = await prisma.$transaction(
                async (tx) => {
                    const oldRows = await tx.departmentCatalog.findMany();
                    await createDeleteSnapshot({
                        tx,
                        tableName: 'DepartmentCatalog',
                        displayName: 'Danh mục Mẫu 01 (trước khi Import ghi đè)',
                        actionType: 'SYNC_OVERWRITE',
                        filterSummary: `Import Excel (${cleanData.length} dòng mới)`,
                        recordsCount: oldRows.length,
                        data: oldRows,
                        user: auth.user,
                    });
                    await tx.departmentCatalog.deleteMany({});
                    return tx.departmentCatalog.createMany({ data: cleanData });
                },
                { timeout: 30000 }
            );

            return NextResponse.json({ success: true, count: result.count });
        } else {
            // Single Create
            const row = body;
            const newRecord = await prisma.departmentCatalog.create({
                data: {
                    STT: row.STT ? Number(row.STT) : null,
                    MA_KHOA: String(row.MA_KHOA || '').substring(0, 50),
                    TEN_KHOA: String(row.TEN_KHOA || ''),
                    BAN_KHAM: row.BAN_KHAM ? Number(row.BAN_KHAM) : null,
                    GIUONG_PD: row.GIUONG_PD ? Number(row.GIUONG_PD) : null,
                    GIUONG_TK: row.GIUONG_TK ? Number(row.GIUONG_TK) : null,
                    GIUONG_HSTC: row.GIUONG_HSTC ? Number(row.GIUONG_HSTC) : null,
                    GIUONG_HSCC: row.GIUONG_HSCC ? Number(row.GIUONG_HSCC) : null,
                    TU_NGAY: row.TU_NGAY ? String(row.TU_NGAY).substring(0, 8) : null,
                    DEN_NGAY: row.DEN_NGAY ? String(row.DEN_NGAY).substring(0, 8) : null,
                    MA_CSKCB: row.MA_CSKCB ? String(row.MA_CSKCB).substring(0, 5) : null,
                }
            });
            return NextResponse.json(newRecord);
        }
    } catch (error) {
        console.error('Error creating mau01 catalog:', error);
        if (error instanceof SnapshotLimitError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const selectedIds = await parseDeleteIdsFromRequest(request);
        if (selectedIds.length > 0) {
            const auth = await authorizeApiRequest(request, {
                allowedRoles: ['ADMIN', 'CNTT', 'VTYT', 'PTCCB', 'TCCB'],
                menuKeys: ['MENU_CATALOG_01', 'MENU_MAU01_CATALOG'],
                action: 'DELETE',
            });
            if (auth.errorResponse) return auth.errorResponse;

            const result = await prisma.$transaction(
                async (tx) => {
                    const targetRows = await tx.departmentCatalog.findMany({
                        where: { id: { in: selectedIds } },
                    });
                    const snap = await createDeleteSnapshot({
                        tx,
                        tableName: 'DepartmentCatalog',
                        displayName: `Mẫu 01 (Xóa ${targetRows.length} dòng đã chọn)`,
                        actionType: 'BULK_DELETE',
                        filterSummary: `${selectedIds.length} dòng đã chọn`,
                        recordsCount: targetRows.length,
                        data: targetRows,
                        user: auth.user,
                    });
                    const deleted = await tx.departmentCatalog.deleteMany({
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
                { error: 'Thiếu xác nhận confirmDeleteAll=true khi xóa toàn bộ Danh mục Mẫu 01.' },
                { status: 400 }
            );
        }

        const result = await prisma.$transaction(
            async (tx) => {
                const oldRows = await tx.departmentCatalog.findMany();
                const snap = await createDeleteSnapshot({
                    tx,
                    tableName: 'DepartmentCatalog',
                    displayName: 'Toàn bộ Danh mục Mẫu 01 (Khoa/Phòng BHYT)',
                    actionType: 'DELETE_ALL',
                    filterSummary: 'Toàn bệnh viện',
                    recordsCount: oldRows.length,
                    data: oldRows,
                    user: auth.user,
                });
                const deleted = await tx.departmentCatalog.deleteMany({});
                return { count: deleted.count, snapshotId: snap.snapshotId };
            },
            { timeout: 30000 }
        );

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error('Error deleting mau01 catalog:', error);
        if (error instanceof SnapshotLimitError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
