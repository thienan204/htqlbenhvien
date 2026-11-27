import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    authorizeApiRequest,
    createDeleteSnapshot,
    MAX_SNAPSHOT_RECORDS,
    SnapshotLimitError,
} from '@/lib/deleteProtection';

export async function GET(req: NextRequest) {
    try {
        const searchParams = new URL(req.url).searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const idsOnly = searchParams.get('idsOnly') === 'true';
        const search = searchParams.get('search') || '';
        const fromDate = searchParams.get('fromDate') || '';
        const toDate = searchParams.get('toDate') || '';
        const errorStatus = searchParams.get('errorStatus') || 'ALL'; // ALL, ERROR, VALID
        const maKhoa = searchParams.get('maKhoa') || '';
        const hasHistory = searchParams.get('hasHistory') === 'true';

        const skip = (page - 1) * limit;

        let whereClause: any = {};
        const andConditions: any[] = [];

        if (search) {
            if (!search.includes(' ')) {
                const fuzzyPattern = '%' + search.split('').join('%') + '%';
                const exactPattern = '%' + search + '%';
                const matchedRecords = await (prisma as any).$queryRaw`
                    SELECT id FROM "Xml1" 
                    WHERE "MA_LK" ILIKE ${exactPattern} 
                       OR "HO_TEN" ILIKE ${fuzzyPattern}
                    LIMIT 500
                `;
                const ids = matchedRecords.map((r: any) => r.id);
                andConditions.push({ id: { in: ids } });
            } else {
                andConditions.push({
                    OR: [
                        { MA_LK: { contains: search, mode: 'insensitive' } },
                        { HO_TEN: { contains: search, mode: 'insensitive' } }
                    ]
                });
            }
        }

        if (fromDate && toDate) {
            andConditions.push({
                NGAY_RA: {
                    gte: fromDate,
                    lte: toDate
                }
            });
        }

        if (errorStatus === 'ERROR') {
            andConditions.push({ hasError: true });
        } else if (errorStatus === 'VALID') {
            andConditions.push({ hasError: false });
        }

        if (maKhoa && maKhoa !== 'ALL') {
             andConditions.push({
                 OR: [
                     { xml7Records: { some: { MA_KHOA_RV: maKhoa } } },
                     { MA_KHOA: maKhoa, xml7Records: { none: {} } }
                 ]
             });
        }

        if (hasHistory) {
             const historyGroup = await (prisma as any).xml1.groupBy({
                 by: ['MA_LK'],
                 having: { MA_LK: { _count: { gt: 1 } } }
             });
             const historyMaLks = historyGroup.map((g: any) => g.MA_LK);
             andConditions.push({ MA_LK: { in: historyMaLks } });
        }

        if (andConditions.length > 0) {
            whereClause = { AND: andConditions };
        }

        if (idsOnly) {
            const [idRows, total] = await Promise.all([
                (prisma as any).xml1.findMany({
                    where: whereClause,
                    take: MAX_SNAPSHOT_RECORDS,
                    orderBy: { createdAt: 'desc' },
                    select: { id: true },
                }),
                (prisma as any).xml1.count({ where: whereClause }),
            ]);
            return NextResponse.json({
                ids: idRows.map((r: { id: string }) => r.id),
                total,
                limitExceeded: total > MAX_SNAPSHOT_RECORDS,
            });
        }

        const [records, total] = await Promise.all([
            (prisma as any).xml1.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            (prisma as any).xml1.count({ where: whereClause })
        ]);

        return NextResponse.json({ data: records, total, page, limit });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const auth = await authorizeApiRequest(req, { requireAdmin: true });
        if (auth.errorResponse) return auth.errorResponse;

        const body = await req.json();
        const { ids, filters, confirmDeleteAll } = body;

        let whereClause: any = {};
        const isFilterBulkDelete = !(ids && Array.isArray(ids) && ids.length > 0);

        if (!isFilterBulkDelete) {
            whereClause = { id: { in: ids } };
        } else if (filters) {
            if (confirmDeleteAll !== true) {
                return NextResponse.json(
                    { error: 'Thiếu xác nhận confirmDeleteAll=true khi xóa hồ sơ XML theo bộ lọc.' },
                    { status: 400 }
                );
            }
            const { search, fromDate, toDate, errorStatus } = filters;
            const andConditions: any[] = [];

            if (search) {
                if (!search.includes(' ')) {
                    const fuzzyPattern = '%' + search.split('').join('%') + '%';
                    const exactPattern = '%' + search + '%';
                    const matchedRecords = await (prisma as any).$queryRaw`
                        SELECT id FROM "Xml1" 
                        WHERE "MA_LK" ILIKE ${exactPattern} 
                           OR "HO_TEN" ILIKE ${fuzzyPattern}
                        LIMIT 500
                    `;
                    const searchIds = matchedRecords.map((r: any) => r.id);
                    andConditions.push({ id: { in: searchIds } });
                } else {
                    andConditions.push({
                        OR: [
                            { MA_LK: { contains: search, mode: 'insensitive' } },
                            { HO_TEN: { contains: search, mode: 'insensitive' } }
                        ]
                    });
                }
            }

            if (fromDate && toDate) {
                andConditions.push({
                    NGAY_RA: {
                        gte: fromDate,
                        lte: toDate
                    }
                });
            }

            if (errorStatus === 'ERROR') {
                andConditions.push({ hasError: true });
            } else if (errorStatus === 'VALID') {
                andConditions.push({ hasError: false });
            }

            if (andConditions.length > 0) {
                whereClause = { AND: andConditions };
            } else {
                 return NextResponse.json({ error: 'Please provide either IDs or valid filters to delete' }, { status: 400 });
            }
        } else {
            return NextResponse.json({ error: 'No IDs or filters provided' }, { status: 400 });
        }

        const result = await prisma.$transaction(
            async (tx) => {
                const headerRows = await tx.xml1.findMany({
                    where: whereClause,
                    select: {
                        id: true,
                        MA_LK: true,
                        MA_BN: true,
                        HO_TEN: true,
                        MA_THE_BHYT: true,
                        NGAY_VAO: true,
                        NGAY_RA: true,
                        MA_BENH_CHINH: true,
                        MA_KHOA: true,
                        hasError: true,
                    },
                });
                const snap = await createDeleteSnapshot({
                    tx,
                    tableName: 'Xml1',
                    displayName: isFilterBulkDelete
                        ? `Hồ sơ XML1 theo bộ lọc (${headerRows.length} hồ sơ)`
                        : `Hồ sơ XML1 đã chọn (${headerRows.length} hồ sơ)`,
                    actionType: isFilterBulkDelete ? 'DELETE_ALL' : 'BULK_DELETE',
                    filterSummary: isFilterBulkDelete
                        ? JSON.stringify(filters)
                        : `${ids.length} ID đã chọn`,
                    recordsCount: headerRows.length,
                    data: headerRows,
                    user: auth.user,
                    restorable: false, // Xml2..15 cascade không khôi phục ngược lại được từ header
                });
                const deleted = await tx.xml1.deleteMany({ where: whereClause });
                return { count: deleted.count, snapshotId: snap.snapshotId };
            },
            { timeout: 30000 }
        );

        return NextResponse.json({ success: true, ...result });
    } catch (error: any) {
        if (error instanceof SnapshotLimitError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
