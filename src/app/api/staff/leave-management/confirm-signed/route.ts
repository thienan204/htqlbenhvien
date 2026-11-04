import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';
import dayjs from 'dayjs';

/**
 * API: Xác nhận Lãnh đạo Bệnh viện đã ký giấy -> Tự động điền công & Trừ quỹ phép
 * PUT /api/staff/leave-management/confirm-signed
 */
export async function PUT(request: Request) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await request.json();
        const {
            requestId,
            directorSignerName = 'Ban Giám Đốc Bệnh Viện',
            directorPaperCode,
            directorSignedAt = new Date().toISOString()
        } = body;

        if (!requestId) {
            return NextResponse.json({ error: 'Thiếu mã đơn nghỉ phép' }, { status: 400 });
        }

        const db = prisma as any;

        const leaveReq = await db.staffLeaveRequest.findUnique({
            where: { id: requestId },
            include: { staff: true }
        });

        if (!leaveReq) {
            return NextResponse.json({ error: 'Không tìm thấy đơn nghỉ phép' }, { status: 404 });
        }

        const finalDays = typeof leaveReq.approvedDays === 'number' ? leaveReq.approvedDays : leaveReq.requestedDays;
        const startDateStr = leaveReq.approvedStartDate || leaveReq.requestedStartDate;
        const endDateStr = leaveReq.approvedEndDate || leaveReq.requestedEndDate;

        // 1. Cập nhật trạng thái đơn thành ĐÃ DUYỆT (APPROVED) & ĐÃ KÝ
        const updatedRequest = await db.staffLeaveRequest.update({
            where: { id: requestId },
            data: {
                status: 'APPROVED',
                directorSignatureStatus: 'DA_KY',
                directorSignedAt: new Date(directorSignedAt),
                directorSignerName,
                directorPaperCode: directorPaperCode || null,
                approvedDays: finalDays,
                approvedStartDate: startDateStr,
                approvedEndDate: endDateStr
            }
        });

        // 2. Tự động trừ quỹ phép năm của Cán bộ (StaffLeaveBalance)
        const startDayjs = dayjs(startDateStr);
        const leaveYear = startDayjs.year();

        try {
            const balance = await db.staffLeaveBalance.findUnique({
                where: {
                    staffId_year: {
                        staffId: leaveReq.staffId,
                        year: leaveYear
                    }
                }
            });

            if (balance) {
                const newUsed = balance.usedDays + finalDays;
                const newRemaining = Math.max(0, balance.totalAvailable - newUsed);
                await db.staffLeaveBalance.update({
                    where: { id: balance.id },
                    data: {
                        usedDays: newUsed,
                        remainingDays: newRemaining
                    }
                });
            }
        } catch (errBalance) {
            console.error('Lỗi cập nhật số dư phép năm:', errBalance);
        }

        // 3. Tự động ghi nhận công P hoặc P/2 vào Bảng Chấm Công (StaffAttendanceRecord)
        try {
            const endDayjs = dayjs(endDateStr);
            let cur = startDayjs;

            const isHalfDay = leaveReq.session === 'MORNING' || leaveReq.session === 'AFTERNOON' || finalDays === 0.5;
            const codeToSet = isHalfDay ? 'P/2' : 'P';
            const valueToSet = isHalfDay ? 0.5 : 1.0;
            const sessionToSet = isHalfDay ? leaveReq.session : 'FULL_DAY';

            while (cur.isBefore(endDayjs) || cur.isSame(endDayjs, 'day')) {
                const workDateStr = cur.format('YYYY-MM-DD');
                const dayOfWeek = cur.day(); // 0: CN, 6: T7

                // Bỏ qua Thứ Bảy & Chủ Nhật đối với ngày nghỉ phép hành chính
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    await prisma.staffAttendanceRecord.upsert({
                        where: {
                            staffId_workDate_session: {
                                staffId: leaveReq.staffId,
                                workDate: workDateStr,
                                session: sessionToSet
                            }
                        },
                        create: {
                            staffId: leaveReq.staffId,
                            ma_khoa: leaveReq.ma_khoa,
                            workDate: workDateStr,
                            code: codeToSet,
                            session: sessionToSet,
                            value: valueToSet,
                            secondaryCode: isHalfDay ? (sessionToSet === 'MORNING' ? 'x' : '+') : null,
                            note: `Nghỉ phép theo đơn ${directorPaperCode || leaveReq.id.slice(-6)}`,
                            updatedBy: currentUser.username || currentUser.id
                        },
                        update: {
                            code: codeToSet,
                            session: sessionToSet,
                            value: valueToSet,
                            secondaryCode: isHalfDay ? (sessionToSet === 'MORNING' ? 'x' : '+') : null,
                            note: `Nghỉ phép theo đơn ${directorPaperCode || leaveReq.id.slice(-6)}`,
                            updatedBy: currentUser.username || currentUser.id
                        }
                    });
                }

                cur = cur.add(1, 'day');
            }
        } catch (errAtt) {
            console.error('Lỗi tự động ghi nhận công vào StaffAttendanceRecord:', errAtt);
        }

        return NextResponse.json({
            success: true,
            message: 'Đã xác nhận ký duyệt thành công và tự động đồng bộ vào Bảng Chấm Công!',
            request: updatedRequest
        });
    } catch (error: any) {
        console.error('Lỗi PUT confirm-signed:', error);
        return NextResponse.json({ error: error.message || 'Lỗi xác nhận chữ ký' }, { status: 500 });
    }
}

