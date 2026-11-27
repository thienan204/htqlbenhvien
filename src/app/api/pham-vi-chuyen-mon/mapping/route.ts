import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    authorizeApiRequest,
    createDeleteSnapshot,
    SnapshotLimitError,
} from '@/lib/deleteProtection';

// GET all mappings for a specific ma_pham_vi
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const ma_pham_vi = searchParams.get('ma_pham_vi');

        if (!ma_pham_vi) {
            return NextResponse.json({ error: 'ma_pham_vi is required' }, { status: 400 });
        }

        const mappings = await prisma.scopeServiceMapping.findMany({
            where: { ma_pham_vi },
            select: { ma_dich_vu: true }
        });

        return NextResponse.json(mappings.map(m => m.ma_dich_vu));
    } catch (error) {
        console.error('Error fetching mappings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST update mappings for a specific ma_pham_vi
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ma_pham_vi, ma_dich_vu_list } = body;

        if (!ma_pham_vi || !Array.isArray(ma_dich_vu_list)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // Transaction: Delete existing, then insert new
        await prisma.$transaction(async (tx) => {
            await tx.scopeServiceMapping.deleteMany({
                where: { ma_pham_vi }
            });

            if (ma_dich_vu_list.length > 0) {
                // Ensure distinct ma_dich_vu to avoid unique constraint violations
                const uniqueServices = Array.from(new Set(ma_dich_vu_list));
                
                await tx.scopeServiceMapping.createMany({
                    data: uniqueServices.map(ma_dich_vu => ({
                        id: crypto.randomUUID(),
                        ma_pham_vi,
                        ma_dich_vu: String(ma_dich_vu),
                        updatedAt: new Date()
                    })),
                    skipDuplicates: true
                });
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating mappings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE mappings (either for selected ma_pham_vi_list OR explicit global reset with confirmDeleteAll=true)
export async function DELETE(request: Request) {
    try {
        let ma_pham_vi_list: string[] = [];
        let deleteAllBody = false;
        let confirmDeleteAllBody = false;

        try {
            const body = await request.json();
            if (body && Array.isArray(body.ma_pham_vi_list)) {
                ma_pham_vi_list = body.ma_pham_vi_list;
            }
            if (body?.deleteAll === true) deleteAllBody = true;
            if (body?.confirmDeleteAll === true) confirmDeleteAllBody = true;
        } catch {
            // Ignore JSON parse errors if body is empty
        }

        const { searchParams } = new URL(request.url);
        const single_ma_pham_vi = searchParams.get('ma_pham_vi');
        if (single_ma_pham_vi && ma_pham_vi_list.length === 0) {
            ma_pham_vi_list = [single_ma_pham_vi];
        }

        const isDeleteAll = deleteAllBody || searchParams.get('deleteAll') === 'true';
        const isConfirmed = confirmDeleteAllBody || searchParams.get('confirmDeleteAll') === 'true';

        if (ma_pham_vi_list.length > 0) {
            const auth = await authorizeApiRequest(request, {
                allowedRoles: ['ADMIN', 'PTCCB', 'TCCB', 'CNTT', 'KHOA'],
                menuKeys: ['PHAM_vi_cm', 'MENU_PHAM_VI_CHUYEN_MON'],
                action: 'DELETE',
            });
            if (auth.errorResponse) return auth.errorResponse;

            const result = await prisma.$transaction(
                async (tx) => {
                    const targetRows = await tx.scopeServiceMapping.findMany({
                        where: { ma_pham_vi: { in: ma_pham_vi_list } },
                    });
                    const snap = await createDeleteSnapshot({
                        tx,
                        tableName: 'ScopeServiceMapping',
                        displayName: `Gán Dịch vụ - Phạm vi (${ma_pham_vi_list.length} mã)`,
                        actionType: 'BULK_DELETE',
                        filterSummary: ma_pham_vi_list.slice(0, 10).join(', '),
                        recordsCount: targetRows.length,
                        data: targetRows,
                        user: auth.user,
                    });
                    const deleted = await tx.scopeServiceMapping.deleteMany({
                        where: { ma_pham_vi: { in: ma_pham_vi_list } },
                    });
                    return { count: deleted.count, snapshotId: snap.snapshotId };
                },
                { timeout: 30000 }
            );

            return NextResponse.json({ success: true, ...result });
        }

        if (!isDeleteAll) {
            return NextResponse.json(
                { error: 'Chưa chọn phạm vi nào để xóa. Nếu muốn xóa toàn bộ bảng gán dịch vụ, vui lòng dùng nút Xóa toàn viện.' },
                { status: 400 }
            );
        }

        const auth = await authorizeApiRequest(request, { requireAdmin: true });
        if (auth.errorResponse) return auth.errorResponse;

        if (!isConfirmed) {
            return NextResponse.json(
                { error: 'Thiếu xác nhận confirmDeleteAll=true khi xóa toàn bộ bảng gán Dịch vụ - Phạm vi.' },
                { status: 400 }
            );
        }

        const result = await prisma.$transaction(
            async (tx) => {
                const allRows = await tx.scopeServiceMapping.findMany();
                const snap = await createDeleteSnapshot({
                    tx,
                    tableName: 'ScopeServiceMapping',
                    displayName: 'Toàn bộ Gán Dịch vụ - Phạm vi chuyên môn',
                    actionType: 'DELETE_ALL',
                    filterSummary: 'Toàn bệnh viện',
                    recordsCount: allRows.length,
                    data: allRows,
                    user: auth.user,
                });
                const deleted = await tx.scopeServiceMapping.deleteMany({});
                return { count: deleted.count, snapshotId: snap.snapshotId };
            },
            { timeout: 30000 }
        );

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error('Error deleting mappings:', error);
        if (error instanceof SnapshotLimitError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
