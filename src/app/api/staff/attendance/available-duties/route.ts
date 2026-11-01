import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

export async function GET(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const staffId = searchParams.get('staffId');
        const beforeDate = searchParams.get('beforeDate'); // Ngày chấm công (chỉ lấy ca trực trước hoặc cùng ngày này)

        if (!staffId) {
            return NextResponse.json({ error: 'Thiếu staffId' }, { status: 400 });
        }

        const whereClause: any = {
            staffId,
            isFullyCompensated: false
        };

        if (beforeDate) {
            whereClause.dutyDate = { lte: beforeDate };
        }

        const duties = await prisma.staffDutyRecord.findMany({
            where: whereClause,
            orderBy: {
                dutyDate: 'desc'
            },
            include: {
                compensations: {
                    select: {
                        id: true,
                        workDate: true,
                        session: true,
                        value: true,
                        code: true
                    }
                }
            }
        });

        // Tính số ngày còn lại của từng ca trực
        const formatted = duties.map(d => {
            const allowance = d.allowanceDays || 1.0;
            const compensated = d.compensatedDays || 0.0;
            const remaining = Math.max(0, allowance - compensated);

            let label = `Trực ngày ${d.dutyDate} (Ca ${d.dutyCode})`;
            if (d.dutyCode === 'L' || d.dutyCode === 'TE') {
                label += ` [Trực Lễ/Tết - Định mức: ${allowance} ngày]`;
            } else {
                label += ` [Định mức: ${allowance} ngày]`;
            }
            label += ` - Còn lại: ${remaining} ngày bù`;

            return {
                id: d.id,
                dutyDate: d.dutyDate,
                dutyCode: d.dutyCode,
                dutyType: d.dutyType,
                allowanceDays: allowance,
                compensatedDays: compensated,
                remainingDays: remaining,
                label,
                compensations: d.compensations
            };
        }).filter(d => d.remainingDays > 0);

        return NextResponse.json(formatted);
    } catch (error: any) {
        console.error('Error fetching available duties for compensatory leave:', error);
        return NextResponse.json({ error: error.message || 'Lỗi khi tải danh sách ca trực' }, { status: 500 });
    }
}
