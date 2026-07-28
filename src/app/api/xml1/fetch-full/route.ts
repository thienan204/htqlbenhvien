import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = new URL(req.url).searchParams;
        const fromDate = searchParams.get('fromDate') || '';
        const toDate = searchParams.get('toDate') || '';
        const filterMaKhoa = searchParams.get('ma_khoa') || '';

        let whereClause: any = {};
        
        if (user.role === 'ADMIN' || user.role === 'CNTT') {
            if (filterMaKhoa && filterMaKhoa !== 'ALL') {
                whereClause.MA_KHOA = filterMaKhoa;
            }
        } else {
            if (!user.ma_khoa) {
                return NextResponse.json({ error: 'Tài khoản của bạn chưa được gán Mã Khoa' }, { status: 403 });
            }
            whereClause.MA_KHOA = user.ma_khoa;
        }

        if (fromDate && toDate) {
            whereClause.NGAY_RA = {
                gte: fromDate,
                lte: toDate
            };
        } else {
             return NextResponse.json({ error: 'Vui lòng chọn Từ ngày - Đến ngày để giới hạn dữ liệu tải về, tránh quá tải máy chủ.' }, { status: 400 });
        }

        const records = await prisma.xml1.findMany({
            where: whereClause,
            distinct: ['MA_LK'],
            orderBy: [
                { MA_LK: 'asc' },
                { version: 'desc' },
            ],
            include: {
                xml2Records: true,
                xml3Records: true,
                xml4Records: true,
                xml5Records: true,
                xml7Records: true,
            },
            take: 2000, 
        });

        const formattedRecords = records.map(r => {
            return {
                id: r.id,
                summary: r, 
                groups: [
                    { type: 'XML1', data: [r] },
                    { type: 'XML2', data: r.xml2Records },
                    { type: 'XML3', data: r.xml3Records },
                    { type: 'XML4', data: r.xml4Records },
                    { type: 'XML5', data: r.xml5Records },
                    { type: 'XML7', data: r.xml7Records }
                ]
            };
        });

        return NextResponse.json(formattedRecords);
    } catch (error: any) {
        console.error('Error fetching full xml records:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
