import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const allowedRoles = ['ADMIN', 'CNTT', 'BHYT'];
        const hasRoleAccess = allowedRoles.includes(user.role) || (user.permissions && (user.permissions as any)['MENU_XML_SUA_BA']);
        if (!hasRoleAccess) {
            return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const maKhoa = searchParams.get('maKhoa') || '';
        const fromDate = searchParams.get('fromDate') || '';
        const toDate = searchParams.get('toDate') || '';

        const skip = (page - 1) * limit;

        const andConditions: any[] = [{ isPreEdit: true }];

        if (search) {
            andConditions.push({
                OR: [
                    { MA_LK: { contains: search, mode: 'insensitive' } },
                    { MA_BN: { contains: search, mode: 'insensitive' } },
                    { HO_TEN: { contains: search, mode: 'insensitive' } }
                ]
            });
        }

        if (maKhoa && maKhoa !== 'ALL') {
            andConditions.push({
                OR: [
                    { editDept: maKhoa },
                    { MA_KHOA: maKhoa }
                ]
            });
        }

        if (fromDate && toDate) {
            const start = new Date(fromDate);
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            andConditions.push({
                createdAt: {
                    gte: start,
                    lte: end
                }
            });
        }

        const whereClause = { AND: andConditions };

        const [records, total] = await Promise.all([
            (prisma as any).xml1.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            (prisma as any).xml1.count({ where: whereClause })
        ]);

        // Check if there are later records for each MA_LK (bản sau sửa)
        const maLkList = records.map((r: any) => r.MA_LK).filter(Boolean);
        let postEditMap: Record<string, boolean> = {};

        if (maLkList.length > 0) {
            const postEdits = await (prisma as any).xml1.findMany({
                where: {
                    MA_LK: { in: maLkList },
                    isPreEdit: false
                },
                select: { MA_LK: true },
                distinct: ['MA_LK']
            });
            postEdits.forEach((pe: any) => {
                postEditMap[pe.MA_LK] = true;
            });
        }

        const enriched = records.map((r: any) => ({
            ...r,
            hasPostEditVersion: Boolean(postEditMap[r.MA_LK])
        }));

        return NextResponse.json({
            data: enriched,
            total,
            page,
            limit
        });

    } catch (error: any) {
        console.error('Lỗi API pre-edit-list:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
