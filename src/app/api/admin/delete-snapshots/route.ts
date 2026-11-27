import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    authorizeApiRequest,
    decompressSnapshotEnvelope,
    restoreFromDeleteSnapshot,
} from '@/lib/deleteProtection';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/delete-snapshots
 * - Không có ?id: Trả về danh sách metadata các snapshot (ẩn binary payloadGzip)
 * - Có ?id=...&download=true: Tải xuống file JSON giải nén gốc
 */
export async function GET(request: Request) {
    try {
        const auth = await authorizeApiRequest(request, { requireAdmin: true });
        if (auth.errorResponse) return auth.errorResponse;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const download = searchParams.get('download') === 'true';
        const tableName = searchParams.get('tableName');

        if (id && download) {
            const snapshot = await prisma.dataDeleteSnapshot.findUnique({
                where: { id },
            });
            if (!snapshot) {
                return NextResponse.json({ error: 'Không tìm thấy bản sao lưu Snapshot.' }, { status: 404 });
            }

            const envelope = decompressSnapshotEnvelope(snapshot.payloadGzip);
            const safeDate = snapshot.createdAt.toISOString().replace(/[:.]/g, '-');
            const filename = `snapshot_${snapshot.tableName}_${safeDate}.json`;

            return new NextResponse(JSON.stringify(envelope, null, 2), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });
        }

        const list = await prisma.dataDeleteSnapshot.findMany({
            where: tableName ? { tableName } : undefined,
            orderBy: { createdAt: 'desc' },
            take: 200,
            select: {
                id: true,
                tableName: true,
                displayName: true,
                actionType: true,
                filterSummary: true,
                recordCount: true,
                rawSizeBytes: true,
                restorable: true,
                deletedById: true,
                deletedByName: true,
                deletedByRole: true,
                restoredAt: true,
                restoredByName: true,
                createdAt: true,
            },
        });

        return NextResponse.json({ snapshots: list });
    } catch (error) {
        console.error('Error fetching delete snapshots:', error);
        return NextResponse.json({ error: 'Lỗi khi tải danh sách Snapshot.' }, { status: 500 });
    }
}

/**
 * POST /api/admin/delete-snapshots
 * Khôi phục dữ liệu từ một bản Snapshot
 */
export async function POST(request: Request) {
    try {
        const auth = await authorizeApiRequest(request, { requireAdmin: true });
        if (auth.errorResponse || !auth.user) {
            return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as { id?: string };
        if (!body.id) {
            return NextResponse.json({ error: 'Thiếu ID bản sao lưu cần khôi phục.' }, { status: 400 });
        }

        const result = await restoreFromDeleteSnapshot(body.id, auth.user);
        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('Error restoring snapshot:', error);
        const msg = error instanceof Error ? error.message : 'Lỗi không xác định khi khôi phục';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/delete-snapshots
 * Cho phép ADMIN xóa dọn từng snapshot (?id=...) hoặc xóa toàn bộ snapshot cũ (?deleteAll=true&confirmDeleteAll=true)
 */
export async function DELETE(request: Request) {
    try {
        const auth = await authorizeApiRequest(request, { requireAdmin: true });
        if (auth.errorResponse) return auth.errorResponse;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const deleteAll = searchParams.get('deleteAll') === 'true';
        const confirmDeleteAll = searchParams.get('confirmDeleteAll') === 'true';

        if (deleteAll) {
            if (!confirmDeleteAll) {
                return NextResponse.json(
                    { error: 'Thiếu xác nhận confirmDeleteAll=true khi dọn toàn bộ Snapshot.' },
                    { status: 400 }
                );
            }
            const deleted = await prisma.dataDeleteSnapshot.deleteMany({});
            return NextResponse.json({
                success: true,
                count: deleted.count,
                message: `Đã xóa sạch ${deleted.count} bản Snapshot để giải phóng dung lượng.`,
            });
        }

        if (!id) {
            return NextResponse.json({ error: 'Thiếu ID Snapshot cần xóa.' }, { status: 400 });
        }

        await prisma.dataDeleteSnapshot.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting snapshot:', error);
        const msg = error instanceof Error ? error.message : 'Lỗi khi xóa Snapshot';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

