import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeMau06Action, normalizeMaDichVuList } from '../_auth';
import { createDeleteSnapshot, SnapshotLimitError } from '@/lib/deleteProtection';

export async function PUT(request: Request) {
    try {
        const auth = await authorizeMau06Action(request, 'EDIT');
        if (auth.errorResponse) return auth.errorResponse;

        const { ids, isActive, ma_dich_vu_thuc_hien, mergeMode } = await request.json();
        
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Invalid input, ids must be a non-empty array' }, { status: 400 });
        }

        // Nếu gắn hàng loạt Mã dịch vụ thực hiện cho các thiết bị đã chọn
        if (ma_dich_vu_thuc_hien !== undefined) {
            const incomingCodes = normalizeMaDichVuList(ma_dich_vu_thuc_hien);
            if (mergeMode === 'APPEND' && incomingCodes) {
                const incomingArr = incomingCodes.split(',').map(s => s.trim()).filter(Boolean);
                const records = await prisma.mau06Catalog.findMany({
                    where: { id: { in: ids } },
                    select: { id: true, ma_dich_vu_thuc_hien: true }
                });
                await prisma.$transaction(
                    records.map(rec => {
                        const existingArr = rec.ma_dich_vu_thuc_hien
                            ? rec.ma_dich_vu_thuc_hien.split(/[;,\n]+/).map(s => s.trim()).filter(Boolean)
                            : [];
                        const merged = normalizeMaDichVuList([...existingArr, ...incomingArr]);
                        return prisma.mau06Catalog.update({
                            where: { id: rec.id },
                            data: { ma_dich_vu_thuc_hien: merged }
                        });
                    })
                );
                return NextResponse.json({ success: true, count: records.length });
            }

            const result = await prisma.mau06Catalog.updateMany({
                where: { id: { in: ids } },
                data: { ma_dich_vu_thuc_hien: incomingCodes }
            });
            return NextResponse.json({ success: true, count: result.count });
        }

        const result = await prisma.mau06Catalog.updateMany({
            where: { id: { in: ids } },
            data: { isActive }
        });

        return NextResponse.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Error in bulk update:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const auth = await authorizeMau06Action(request, 'DELETE');
        if (auth.errorResponse) return auth.errorResponse;

        const { ids } = await request.json();
        
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Danh sách ID không hợp lệ' }, { status: 400 });
        }

        const result = await prisma.$transaction(
            async (tx) => {
                const targetRows = await tx.mau06Catalog.findMany({ where: { id: { in: ids } } });
                const snap = await createDeleteSnapshot({
                    tx,
                    tableName: 'Mau06Catalog',
                    displayName: `Mẫu 06 (Xóa ${targetRows.length} thiết bị đã chọn)`,
                    actionType: 'BULK_DELETE',
                    filterSummary: `${ids.length} dòng đã chọn`,
                    recordsCount: targetRows.length,
                    data: targetRows,
                    user: auth.user,
                });
                const deleted = await tx.mau06Catalog.deleteMany({
                    where: { id: { in: ids } }
                });
                return { count: deleted.count, snapshotId: snap.snapshotId };
            },
            { timeout: 30000 }
        );

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error('Error in bulk delete mau06 catalog:', error);
        if (error instanceof SnapshotLimitError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
