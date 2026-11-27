import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    authorizeApiRequest,
    createDeleteSnapshot,
    SnapshotLimitError,
} from '@/lib/deleteProtection';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get('activeOnly') === 'true';

        const data = await prisma.scopeOfPracticeCatalog.findMany({
            where: activeOnly ? { isActive: true } : undefined,
            orderBy: {
                ma_pham_vi: 'asc'
            }
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching ScopeOfPracticeCatalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        // Handle bulk import
        if (Array.isArray(body)) {
            const results = [];
            for (const item of body) {
                const existing = await prisma.scopeOfPracticeCatalog.findUnique({
                    where: { ma_pham_vi: item.ma_pham_vi }
                });
                
                if (existing) {
                    const updated = await prisma.scopeOfPracticeCatalog.update({
                        where: { id: existing.id },
                        data: {
                            ten_chuc_danh: item.ten_chuc_danh,
                            ghi_chu: item.ghi_chu || existing.ghi_chu,
                            isActive: item.isActive !== undefined ? item.isActive : existing.isActive
                        }
                    });
                    results.push(updated);
                } else {
                    const created = await prisma.scopeOfPracticeCatalog.create({
                        data: {
                            id: crypto.randomUUID(),
                            ma_pham_vi: item.ma_pham_vi,
                            ten_chuc_danh: item.ten_chuc_danh,
                            ghi_chu: item.ghi_chu || null,
                            isActive: item.isActive !== undefined ? item.isActive : true,
                            updatedAt: new Date()
                        }
                    });
                    results.push(created);
                }
            }
            return NextResponse.json({ success: true, count: results.length });
        }

        const { ma_pham_vi, ten_chuc_danh, ghi_chu, isActive } = body;

        const existing = await prisma.scopeOfPracticeCatalog.findUnique({
            where: { ma_pham_vi }
        });

        if (existing) {
            return NextResponse.json({ error: 'Mã phạm vi đã tồn tại' }, { status: 400 });
        }

        const data = await prisma.scopeOfPracticeCatalog.create({
            data: {
                id: crypto.randomUUID(),
                ma_pham_vi,
                ten_chuc_danh,
                ghi_chu: ghi_chu || null,
                isActive: isActive !== undefined ? isActive : true,
                updatedAt: new Date()
            }
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error creating ScopeOfPracticeCatalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { id, ma_pham_vi, ten_chuc_danh, ghi_chu, isActive } = await request.json();

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const existingCode = await prisma.scopeOfPracticeCatalog.findFirst({
            where: { ma_pham_vi, NOT: { id } }
        });

        if (existingCode) {
            return NextResponse.json({ error: 'Mã phạm vi đã tồn tại' }, { status: 400 });
        }

        const data = await prisma.scopeOfPracticeCatalog.update({
            where: { id },
            data: {
                ma_pham_vi,
                ten_chuc_danh,
                ghi_chu,
                isActive
            }
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error updating ScopeOfPracticeCatalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const deleteAll = searchParams.get('deleteAll') === 'true';
        const confirmDeleteAll = searchParams.get('confirmDeleteAll') === 'true';
        const allowCascadeCchn = searchParams.get('allowCascadeCchn') === 'true';

        if (deleteAll) {
            const auth = await authorizeApiRequest(request, { requireAdmin: true });
            if (auth.errorResponse) return auth.errorResponse;

            if (!confirmDeleteAll) {
                return NextResponse.json(
                    { error: 'Thiếu xác nhận confirmDeleteAll=true khi xóa toàn bộ Danh mục Phạm vi CM.' },
                    { status: 400 }
                );
            }

            const linkedCchnCount = await prisma.cCHNScopeMapping.count();
            if (linkedCchnCount > 0 && !allowCascadeCchn) {
                return NextResponse.json(
                    {
                        error: `ĐÃ CHẶN XÓA: Đang có ${linkedCchnCount} liên kết Phạm vi hành nghề trên các CCHN của nhân viên. Xóa Danh mục Phạm vi sẽ gây mất dữ liệu CCHN hàng loạt (Cascade).`,
                    },
                    { status: 400 }
                );
            }

            const result = await prisma.$transaction(
                async (tx) => {
                    const [scopes, scopeServiceMappings, cchnScopeMappings] = await Promise.all([
                        tx.scopeOfPracticeCatalog.findMany(),
                        tx.scopeServiceMapping.findMany(),
                        tx.cCHNScopeMapping.findMany(),
                    ]);

                    const snap = await createDeleteSnapshot({
                        tx,
                        tableName: 'ScopeOfPracticeCatalog',
                        displayName: 'Danh mục Phạm vi Chuyên môn (kèm liên kết)',
                        actionType: 'DELETE_ALL',
                        filterSummary: 'Toàn bệnh viện',
                        recordsCount: scopes.length + scopeServiceMappings.length + cchnScopeMappings.length,
                        data: { scopes, scopeServiceMappings, cchnScopeMappings },
                        user: auth.user,
                    });

                    const deleted = await tx.scopeOfPracticeCatalog.deleteMany({});
                    return { count: deleted.count, snapshotId: snap.snapshotId };
                },
                { timeout: 30000 }
            );

            return NextResponse.json({ success: true, ...result });
        }

        const auth = await authorizeApiRequest(request, {
            allowedRoles: ['ADMIN', 'PTCCB', 'TCCB', 'CNTT', 'KHOA'],
            menuKeys: ['PHAM_vi_cm', 'MENU_PHAM_VI_CHUYEN_MON'],
            action: 'DELETE',
        });
        if (auth.errorResponse) return auth.errorResponse;

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const scope = await prisma.scopeOfPracticeCatalog.findUnique({ where: { id } });
        if (!scope) return NextResponse.json({ error: 'Không tìm thấy Phạm vi chuyên môn.' }, { status: 404 });

        const cchnUsingCount = await prisma.cCHNScopeMapping.count({
            where: { ma_pham_vi: scope.ma_pham_vi },
        });
        if (cchnUsingCount > 0) {
            return NextResponse.json(
                {
                    error: `Không thể xóa Phạm vi "${scope.ma_pham_vi}" vì đang gắn với ${cchnUsingCount} CCHN của nhân viên. Vui lòng gỡ khỏi CCHN trước khi xóa.`,
                },
                { status: 400 }
            );
        }

        await prisma.scopeOfPracticeCatalog.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting ScopeOfPracticeCatalog:', error);
        if (error instanceof SnapshotLimitError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
