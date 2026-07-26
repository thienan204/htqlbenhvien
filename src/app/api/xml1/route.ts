import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const searchParams = new URL(req.url).searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const search = searchParams.get('search') || '';
        const fromDate = searchParams.get('fromDate') || '';
        const toDate = searchParams.get('toDate') || '';
        const errorStatus = searchParams.get('errorStatus') || 'ALL'; // ALL, ERROR, VALID

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

        if (andConditions.length > 0) {
            whereClause = { AND: andConditions };
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
        const body = await req.json();
        const { ids } = body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        const result = await (prisma as any).xml1.deleteMany({
            where: {
                id: { in: ids }
            }
        });

        return NextResponse.json({ success: true, count: result.count });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
