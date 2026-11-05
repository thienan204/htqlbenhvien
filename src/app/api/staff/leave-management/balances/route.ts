import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

const toxicDepts = ['KP004', 'KP005', 'KP008', 'KP012', 'KP015', 'KP018', 'KP022', 'KP025'];

/**
 * API: Quản lý Quỹ phép năm của toàn bộ Cán bộ
 * GET /api/staff/leave-management/balances?year=2026&ma_khoa=...&search=...
 * PUT /api/staff/leave-management/balances (Cập nhật số ngày phép)
 */
export async function GET(request: Request) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const queryYear = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
        const queryMaKhoa = searchParams.get('ma_khoa');
        const querySearch = searchParams.get('search')?.trim().toLowerCase();

        const db = prisma as any;

        // Xây dựng điều kiện lọc cán bộ
        const whereStaff: any = {};

        // Phân quyền: Nếu không phải ADMIN, CNTT, PTCCB, TCCB thì chỉ xem được khoa của mình
        const isManagement = ['ADMIN', 'CNTT', 'PTCCB', 'TCCB'].includes(currentUser.role);
        if (!isManagement) {
            if (currentUser.ma_khoa) {
                whereStaff.ma_khoa = currentUser.ma_khoa;
            } else if (currentUser.staffId) {
                whereStaff.id = currentUser.staffId;
            }
        } else if (queryMaKhoa && queryMaKhoa !== 'ALL') {
            whereStaff.ma_khoa = queryMaKhoa;
        }

        if (querySearch) {
            whereStaff.OR = [
                { ho_ten: { contains: querySearch, mode: 'insensitive' } },
                { ma_nv: { contains: querySearch, mode: 'insensitive' } }
            ];
        }

        // Lấy danh sách cán bộ
        const staffs = await prisma.staff.findMany({
            where: whereStaff,
            select: {
                id: true,
                ma_nv: true,
                ho_ten: true,
                ma_khoa: true,
                ngay_tuyen_dung: true,
                department: { select: { ten_khoa: true } },
                chuc_vu_ref: { select: { name: true } },
                trang_thai_ref: { select: { code: true, name: true } }
            },
            orderBy: [{ ma_khoa: 'asc' }, { ma_nv: 'asc' }]
        });

        // Lấy tất cả bản ghi StaffLeaveBalance của năm được chọn
        const staffIds = staffs.map(s => s.id);
        const existingBalances = await db.staffLeaveBalance.findMany({
            where: {
                staffId: { in: staffIds },
                year: queryYear
            }
        });

        const balanceMap = new Map();
        for (const b of existingBalances) {
            balanceMap.set(b.staffId, b);
        }

        // Khởi tạo các bản ghi còn thiếu cho nhân sự
        const results = [];
        const missingBalancesToCreate: any[] = [];

        for (const staff of staffs) {
            let balance = balanceMap.get(staff.id);

            if (!balance) {
                let standardDays = 12.0;
                if (toxicDepts.includes(staff.ma_khoa)) {
                    standardDays = 14.0;
                }

                let seniorityDays = 0.0;
                if (staff.ngay_tuyen_dung) {
                    const recruitYear = new Date(staff.ngay_tuyen_dung).getFullYear();
                    const yearsWorked = Math.max(0, queryYear - recruitYear);
                    seniorityDays = Math.floor(yearsWorked / 5);
                }

                const totalAvailable = standardDays + seniorityDays;
                const usedDays = 0.0;
                const remainingDays = totalAvailable;

                const newBalanceData = {
                    staffId: staff.id,
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
                };

                missingBalancesToCreate.push(newBalanceData);
                balance = newBalanceData;
            }

            results.push({
                ...balance,
                staff: {
                    id: staff.id,
                    ma_nv: staff.ma_nv,
                    ho_ten: staff.ho_ten,
                    ma_khoa: staff.ma_khoa,
                    ten_khoa: staff.department?.ten_khoa || '',
                    chuc_vu: staff.chuc_vu_ref?.name || 'Nhân viên',
                    trang_thai: staff.trang_thai_ref?.name || 'Đang làm việc'
                }
            });
        }

        // Tạo ngầm các bản ghi mới thiếu nếu có
        if (missingBalancesToCreate.length > 0) {
            try {
                for (const item of missingBalancesToCreate) {
                    const created = await db.staffLeaveBalance.create({ data: item }).catch(() => null);
                    if (created) {
                        const targetItem = results.find(r => r.staffId === item.staffId && r.year === item.year);
                        if (targetItem) targetItem.id = created.id;
                    }
                }
            } catch (err) {
                console.error('Lỗi khởi tạo ngầm quỹ phép:', err);
            }
        }

        return NextResponse.json({
            success: true,
            year: queryYear,
            count: results.length,
            balances: results
        });
    } catch (error: any) {
        console.error('Lỗi GET balances:', error);
        return NextResponse.json({ error: error.message || 'Lỗi hệ thống' }, { status: 500 });
    }
}

/**
 * PUT: Cập nhật số ngày phép của 1 cán bộ
 */
export async function PUT(request: Request) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const isManagement = ['ADMIN', 'CNTT', 'PTCCB', 'TCCB'].includes(currentUser.role);
        if (!isManagement) {
            return NextResponse.json({ error: 'Chỉ phòng TCCB hoặc Quản trị viên mới được phép chỉnh sửa Quỹ phép' }, { status: 403 });
        }

        const body = await request.json();
        const {
            id,
            staffId,
            year,
            standardDays = 12.0,
            seniorityDays = 0.0,
            transferredDays = 0.0,
            usedDays = 0.0,
            remainingDays: inputRemainingDays,
            note
        } = body;

        if (!staffId || !year) {
            return NextResponse.json({ error: 'Thiếu thông tin staffId hoặc year' }, { status: 400 });
        }

        const sDays = Number(standardDays) || 0;
        const senDays = Number(seniorityDays) || 0;
        const transDays = Number(transferredDays) || 0;
        const uDays = Number(usedDays) || 0;

        const totalAvailable = sDays + senDays + transDays;
        const remainingDays = inputRemainingDays !== undefined && inputRemainingDays !== null
            ? Number(inputRemainingDays)
            : Math.max(0, totalAvailable - uDays);

        const db = prisma as any;

        const updated = await db.staffLeaveBalance.upsert({
            where: {
                staffId_year: {
                    staffId,
                    year: Number(year)
                }
            },
            update: {
                standardDays: sDays,
                seniorityDays: senDays,
                transferredDays: transDays,
                totalAvailable,
                usedDays: uDays,
                remainingDays,
                note: note || null
            },
            create: {
                staffId,
                year: Number(year),
                standardDays: sDays,
                seniorityDays: senDays,
                transferredDays: transDays,
                totalAvailable,
                usedDays: uDays,
                remainingDays,
                note: note || null
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Cập nhật Quỹ phép thành công!',
            balance: updated
        });
    } catch (error: any) {
        console.error('Lỗi PUT balances:', error);
        return NextResponse.json({ error: error.message || 'Lỗi hệ thống' }, { status: 500 });
    }
}

