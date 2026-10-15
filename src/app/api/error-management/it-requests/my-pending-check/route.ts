import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_ROLES = ['ADMIN', 'CNTT', 'VTYT', 'HCQT'];

// API siêu nhẹ chuyên dụng để kiểm tra nhanh công việc chưa tiếp nhận của người đang đăng nhập
// Phản hồi siêu tốc (1-2ms), chỉ trả về vài trường cần thiết để hiển thị cảnh báo Windows
export async function GET() {
    try {
        const user = await getCurrentUser();
        
        // 1. Nếu chưa đăng nhập: Trả về 401 ngay, không cảnh báo
        if (!user || !user.id) {
            return NextResponse.json({ error: 'Unauthorized', allowed: false }, { status: 401 });
        }

        // 2. Nếu vai trò không thuộc nhóm tiếp nhận xử lý sự cố (bác sĩ, điều dưỡng khoa phòng):
        // Trả về allowed: false để client dừng hoàn toàn mọi cảnh báo
        if (!ALLOWED_ROLES.includes(user.role)) {
            return NextResponse.json({
                allowed: false,
                role: user.role,
                unacceptedTickets: [],
                unassignedCount: 0
            });
        }

        // 3. Truy vấn các yêu cầu phân công cho chính user nhưng chưa bấm nhận
        const rawTickets = await prisma.iTRequest.findMany({
            where: {
                OR: [
                    { assigneeId: user.id, status: 'PENDING' },
                    { transferToId: user.id, status: 'TRANSFERRING' }
                ],
                status: {
                    notIn: ['IN_PROGRESS', 'RESOLVED']
                }
            },
            select: {
                id: true,
                ten_loi: true,
                ma_khoa: true,
                dynamicFields: true,
                ma_ba: true,
                status: true,
                targetDepartment: true,
                createdAt: true
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 5
        });

        const unacceptedTickets = rawTickets.map(t => {
            const dyn = (t.dynamicFields as any) || {};
            return {
                id: t.id,
                ten_loi: t.ten_loi,
                ma_khoa: t.ma_khoa,
                nguoi_bao: dyn['Người báo'] || dyn['nguoi_bao'] || null,
                ma_ba: t.ma_ba,
                status: t.status,
                targetDepartment: t.targetDepartment,
                createdAt: t.createdAt
            };
        });

        // 4. Nếu là ADMIN, đếm thêm số lượng việc chưa có ai tiếp nhận
        let unassignedCount = 0;
        if (user.role === 'ADMIN') {
            unassignedCount = await prisma.iTRequest.count({
                where: {
                    assigneeId: null,
                    status: 'PENDING'
                }
            });
        }

        return NextResponse.json({
            allowed: true,
            userId: user.id,
            role: user.role,
            unacceptedCount: unacceptedTickets.length,
            unacceptedTickets,
            unassignedCount
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
            }
        });
    } catch (error: any) {
        console.error('Lỗi API my-pending-check:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
