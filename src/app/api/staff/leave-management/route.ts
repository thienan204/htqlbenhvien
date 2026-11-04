import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

/**
 * API: Danh Sách & Tạo Mới Đơn Xin Nghỉ Phép
 * GET /api/staff/leave-management
 * POST /api/staff/leave-management
 */
export async function GET(request: Request) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const view = searchParams.get('view') || 'MY_REQUESTS'; // MY_REQUESTS | DEPT_REQUESTS | ALL_TCCB
        const status = searchParams.get('status');
        const year = searchParams.get('year');
        const maKhoa = searchParams.get('ma_khoa');

        const where: any = {};

        if (status) {
            where.status = status;
        }

        if (year) {
            where.requestedStartDate = {
                startsWith: year
            };
        }

        if (view === 'MY_REQUESTS') {
            if (!currentUser.staffId) {
                return NextResponse.json({ success: true, requests: [] });
            }
            where.staffId = currentUser.staffId;
        } else if (view === 'DEPT_REQUESTS') {
            const targetDept = maKhoa || currentUser.ma_khoa;
            if (targetDept) {
                where.ma_khoa = targetDept;
            }
        } else if (view === 'ALL_TCCB') {
            if (maKhoa) {
                where.ma_khoa = maKhoa;
            }
        }

        const requests = await prisma.staffLeaveRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                staff: {
                    select: {
                        id: true,
                        ma_nv: true,
                        ho_ten: true,
                        so_dien_thoai: true,
                        chuc_vu_ref: { select: { id: true, code: true, name: true } },
                        department: { select: { ma_khoa: true, ten_khoa: true } }
                    }
                }
            }
        });

        // Lấy thông tin người nhận bàn giao và người điều hành thay thế nếu có
        const relatedStaffIds = Array.from(new Set(
            requests.flatMap(r => [r.handoverStaffId, r.actingHeadStaffId]).filter(Boolean) as string[]
        ));

        let relatedStaffMap = new Map<string, any>();
        if (relatedStaffIds.length > 0) {
            const relatedStaffs = await prisma.staff.findMany({
                where: { id: { in: relatedStaffIds } },
                select: {
                    id: true,
                    ho_ten: true,
                    chuc_vu_ref: { select: { name: true } }
                }
            });
            relatedStaffs.forEach(s => relatedStaffMap.set(s.id, s));
        }

        const formatted = requests.map(r => ({
            ...r,
            handoverStaff: r.handoverStaffId ? relatedStaffMap.get(r.handoverStaffId) : null,
            actingHeadStaff: r.actingHeadStaffId ? relatedStaffMap.get(r.actingHeadStaffId) : null
        }));

        return NextResponse.json({
            success: true,
            requests: formatted
        });
    } catch (error: any) {
        console.error('Lỗi GET leave-management:', error);
        return NextResponse.json({ error: error.message || 'Lỗi máy chủ' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await request.json();
        const {
            staffId,
            requestedStartDate,
            requestedEndDate,
            requestedDays,
            session = 'FULL_DAY',
            reason,
            destination,
            contactPhone,
            handoverStaffId,
            actingHeadStaffId,
            formType: manualFormType
        } = body;

        const targetStaffId = staffId || currentUser.staffId;
        if (!targetStaffId) {
            return NextResponse.json({ error: 'Không xác định được cán bộ làm đơn' }, { status: 400 });
        }

        if (!requestedStartDate || !requestedEndDate || !requestedDays || !reason) {
            return NextResponse.json({ error: 'Vui lòng điền đầy đủ các thông tin bắt buộc' }, { status: 400 });
        }

        const staff = await prisma.staff.findUnique({
            where: { id: targetStaffId },
            include: { chuc_vu_ref: true, department: true }
        });

        if (!staff) {
            return NextResponse.json({ error: 'Cán bộ không tồn tại' }, { status: 404 });
        }

        // Tự động nhận diện loại đơn theo chức vụ
        const cvCode = (staff.chuc_vu_ref?.code || '').toUpperCase();
        const cvName = (staff.chuc_vu_ref?.name || '').toLowerCase();
        const isDepartmentHead = cvCode.includes('TRUONG_KHOA') || 
                                 cvCode.includes('TRUONG_PHONG') || 
                                 cvCode.includes('PHU_TRACH') || 
                                 cvName.includes('trưởng khoa') || 
                                 cvName.includes('trưởng phòng') || 
                                 cvName.includes('phụ trách');

        // Nếu là Trưởng phòng -> Mẫu 2 (DEPARTMENT_HEAD), chuyển thẳng TCCB trình Giám đốc
        // Nếu là Phó phòng/Nhân viên -> Mẫu 1 (STAFF_DEPUTY), chuyển Trưởng khoa duyệt trước
        const formType = manualFormType || (isDepartmentHead ? 'DEPARTMENT_HEAD' : 'STAFF_DEPUTY');
        const initialStatus = formType === 'DEPARTMENT_HEAD' ? 'PENDING_TCCB' : 'PENDING_DEPT';

        const newRequest = await prisma.staffLeaveRequest.create({
            data: {
                formType,
                staffId: targetStaffId,
                ma_khoa: staff.ma_khoa,
                requestedStartDate,
                requestedEndDate,
                requestedDays: Number(requestedDays),
                session,
                reason,
                destination: destination || null,
                contactPhone: contactPhone || staff.so_dien_thoai || null,
                handoverStaffId: handoverStaffId || null,
                actingHeadStaffId: actingHeadStaffId || null,
                status: initialStatus
            }
        });

        return NextResponse.json({
            success: true,
            request: newRequest
        });
    } catch (error: any) {
        console.error('Lỗi POST leave-management:', error);
        return NextResponse.json({ error: error.message || 'Lỗi tạo đơn nghỉ phép' }, { status: 500 });
    }
}
