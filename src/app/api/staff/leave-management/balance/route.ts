import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

/**
 * API: Tra cứu & Khởi tạo Quỹ ngày phép năm của Cán bộ
 * GET /api/staff/leave-management/balance?staffId=...&year=...
 */
export async function GET(request: Request) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const queryStaffId = searchParams.get('staffId');
        const queryYear = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);

        // Mặc định lấy theo staffId của người dùng nếu không truyền
        const targetStaffId = queryStaffId || currentUser.staffId;
        if (!targetStaffId) {
            return NextResponse.json({ error: 'Không tìm thấy hồ sơ cán bộ' }, { status: 400 });
        }

        // Lấy thông tin cán bộ
        const staff = await prisma.staff.findUnique({
            where: { id: targetStaffId },
            include: {
                department: true,
                chuc_vu_ref: true,
                chuc_danh_ref: true
            }
        });

        if (!staff) {
            return NextResponse.json({ error: 'Cán bộ không tồn tại' }, { status: 404 });
        }

        const db = prisma as any;

        // Tìm số dư phép của năm được chỉ định
        let balance = await db.staffLeaveBalance.findUnique({
            where: {
                staffId_year: {
                    staffId: targetStaffId,
                    year: queryYear
                }
            }
        });

        // Nếu chưa có, tự động tính toán và khởi tạo theo quy định
        if (!balance) {
            // Tiêu chuẩn cơ bản: 12 ngày (hoặc 14 ngày nếu độc hại/khoa đặc thù)
            let standardDays = 12.0;
            const deptCode = staff.ma_khoa || '';
            const toxicDepts = ['KP004', 'KP005', 'KP008', 'KP012', 'KP015', 'KP018', 'KP022', 'KP025']; // Các khoa truyền nhiễm, hồi sức, giải phẫu...
            if (toxicDepts.includes(deptCode)) {
                standardDays = 14.0;
            }

            // Tính thâm niên (Cứ mỗi 5 năm làm việc được cộng thêm 1 ngày phép)
            let seniorityDays = 0.0;
            if (staff.ngay_tuyen_dung) {
                const recruitYear = new Date(staff.ngay_tuyen_dung).getFullYear();
                const yearsWorked = Math.max(0, queryYear - recruitYear);
                seniorityDays = Math.floor(yearsWorked / 5);
            }

            const totalAvailable = standardDays + seniorityDays;
            const usedDays = 0.0;
            const remainingDays = totalAvailable;

            balance = await db.staffLeaveBalance.create({
                data: {
                    staffId: targetStaffId,
                    year: queryYear,
                    standardDays,
                    seniorityDays,
                    transferredDays: 0.0,
                    totalAvailable,
                    usedDays,
                    remainingDays,
                    expiredDays: 0.0,
                    compensatedCashDays: 0.0,
                    compensatedCashAmount: 0.0
                }
            });
        }

        return NextResponse.json({
            success: true,
            staff: {
                id: staff.id,
                ma_nv: staff.ma_nv,
                ho_ten: staff.ho_ten,
                ma_khoa: staff.ma_khoa,
                ten_khoa: staff.department?.ten_khoa || '',
                chuc_vu: staff.chuc_vu_ref?.name || ''
            },
            balance
        });
    } catch (error: any) {
        console.error('Lỗi API balance leave-management:', error);
        return NextResponse.json({ error: error.message || 'Lỗi máy chủ' }, { status: 500 });
    }
}

