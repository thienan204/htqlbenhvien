import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    authorizeApiRequest,
    createDeleteSnapshot,
    parseDeleteIdsFromRequest,
    SnapshotLimitError,
} from '@/lib/deleteProtection';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const search = searchParams.get('search') || '';
        
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { cchn: { contains: search } },
                { ma_dich_vu: { contains: search } },
                { ten_dich_vu: { contains: search } }
            ];
        }

        const [total, data] = await Promise.all([
            prisma.doctorServiceMapping.count({ where }),
            prisma.doctorServiceMapping.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            })
        ]);

        return NextResponse.json({
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error fetching mappings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // Support bulk insert
        if (Array.isArray(body)) {
            // Need to handle duplicates carefully. Prisma createMany with skipDuplicates is available.
            const created = await prisma.doctorServiceMapping.createMany({
                data: body.map((item: any) => ({
                    id: crypto.randomUUID(),
                    cchn: item.cchn,
                    ma_dich_vu: item.ma_dich_vu,
                    ten_dich_vu: item.ten_dich_vu,
                    source: item.source || 'XML_AUTO',
                    status: item.status || 'APPROVED',
                    updatedAt: new Date()
                })),
                skipDuplicates: true
            });
            return NextResponse.json({ success: true, count: created.count });
        } else {
            // Single insert
            const { cchn, ma_dich_vu, ten_dich_vu, source, status } = body;
            
            // Check if exists
            const exists = await prisma.doctorServiceMapping.findUnique({
                where: {
                    cchn_ma_dich_vu: {
                        cchn,
                        ma_dich_vu
                    }
                }
            });

            if (exists) {
                return NextResponse.json({ error: 'Mapping already exists' }, { status: 400 });
            }

            const mapping = await prisma.doctorServiceMapping.create({
                data: { 
                    id: crypto.randomUUID(),
                    cchn, 
                    ma_dich_vu, 
                    ten_dich_vu, 
                    source: source || 'MANUAL_ADD', 
                    status: status || 'APPROVED',
                    updatedAt: new Date()
                }
            });
            return NextResponse.json(mapping);
        }
    } catch (error) {
        console.error('Error creating mapping:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { ids, status } = body; // Support bulk update status

        if (!ids || !Array.isArray(ids) || !status) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const updated = await prisma.doctorServiceMapping.updateMany({
            where: { id: { in: ids } },
            data: { status }
        });

        return NextResponse.json({ success: true, count: updated.count });
    } catch (error) {
        console.error('Error updating mappings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const auth = await authorizeApiRequest(request, {
            allowedRoles: ['ADMIN', 'CNTT', 'PTCCB', 'TCCB'],
            menuKeys: ['MENU_STAFF', 'MENU_CHUYEN_DE'],
            action: 'DELETE',
        });
        if (auth.errorResponse) return auth.errorResponse;

        const { searchParams } = new URL(request.url);
        const idsParam = searchParams.get('ids');
        const confirmDeleteAll = searchParams.get('confirmDeleteAll') === 'true';

        if (idsParam === 'all') {
            if (!confirmDeleteAll) {
                return NextResponse.json(
                    { error: 'Thiếu xác nhận confirmDeleteAll=true khi xóa toàn bộ Lịch sử Dịch vụ.' },
                    { status: 400 }
                );
            }

            const result = await prisma.$transaction(
                async (tx) => {
                    const allRows = await tx.doctorServiceMapping.findMany();
                    const snap = await createDeleteSnapshot({
                        tx,
                        tableName: 'DoctorServiceMapping',
                        displayName: 'Toàn bộ Lịch sử Dịch vụ Bác sĩ',
                        actionType: 'DELETE_ALL',
                        filterSummary: 'Toàn bộ dữ liệu',
                        recordsCount: allRows.length,
                        data: allRows,
                        user: auth.user,
                    });
                    const deleted = await tx.doctorServiceMapping.deleteMany({});
                    return { count: deleted.count, snapshotId: snap.snapshotId };
                },
                { timeout: 30000 }
            );

            return NextResponse.json({
                success: true,
                count: result.count,
                snapshotId: result.snapshotId,
                message: `Đã xóa toàn bộ ${result.count} bản ghi (đã lưu Snapshot dự phòng)`,
            });
        }

        const idArray = await parseDeleteIdsFromRequest(request);
        if (idArray.length === 0) {
            return NextResponse.json({ error: 'Vui lòng chọn ít nhất 1 dòng cần xóa.' }, { status: 400 });
        }

        const result = await prisma.$transaction(
            async (tx) => {
                const targetRows = await tx.doctorServiceMapping.findMany({
                    where: { id: { in: idArray } },
                });
                const snap = await createDeleteSnapshot({
                    tx,
                    tableName: 'DoctorServiceMapping',
                    displayName: `Lịch sử Dịch vụ đã chọn (${targetRows.length} dòng)`,
                    actionType: 'BULK_DELETE',
                    filterSummary: `${idArray.length} dòng đã chọn`,
                    recordsCount: targetRows.length,
                    data: targetRows,
                    user: auth.user,
                });
                const deleted = await tx.doctorServiceMapping.deleteMany({
                    where: { id: { in: idArray } },
                });
                return { count: deleted.count, snapshotId: snap.snapshotId };
            },
            { timeout: 30000 }
        );

        return NextResponse.json({ success: true, count: result.count, snapshotId: result.snapshotId });
    } catch (error) {
        console.error('Error deleting mappings:', error);
        if (error instanceof SnapshotLimitError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
