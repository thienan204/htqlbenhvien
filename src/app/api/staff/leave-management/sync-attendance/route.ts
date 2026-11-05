import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

/**
 * API: Đồng bộ số ngày phép đã nghỉ thực tế từ Bảng Chấm Công (StaffAttendanceRecord)
 * POST /api/staff/leave-management/sync-attendance
 * Body: { year: 2026, ma_khoa?: string }
 */
export async function POST(request: Request) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const isManagement = ['ADMIN', 'CNTT', 'PTCCB', 'TCCB'].includes(currentUser.role);
        if (!isManagement) {
            return NextResponse.json({ error: 'Chỉ phòng TCCB hoặc Quản trị viên mới có quyền đồng bộ' }, { status: 403 });
        }

        const body = await request.json();
        const year = Number(body.year) || new Date().getFullYear();
        const ma_khoa = body.ma_khoa;

        const startDateStr = `${year}-01-01`;
        const endDateStr = `${year}-12-31`;

        const whereAttendance: any = {
            workDate: {
                gte: startDateStr,
                lte: endDateStr
            },
            OR: [
                { code: { in: ['P', 'p', 'P/2', 'p/2'] } },
                { secondaryCode: { in: ['P', 'p'] } }
            ]
        };

        if (ma_khoa && ma_khoa !== 'ALL') {
            whereAttendance.ma_khoa = ma_khoa;
        }

        // Lấy tất cả các ca chấm phép trong năm
        const attendanceRecords = await prisma.staffAttendanceRecord.findMany({
            where: whereAttendance,
            select: {
                staffId: true,
                workDate: true,
                code: true,
                session: true,
                secondaryCode: true,
                value: true
            }
        });

        // Gom nhóm tính tổng số ngày đã nghỉ theo từng cán bộ
        const staffDaysMap = new Map<string, number>();

        for (const record of attendanceRecords) {
            let days = 0.0;
            const cleanCode = (record.code || '').trim().toUpperCase();
            const cleanSecondary = (record.secondaryCode || '').trim().toUpperCase();

            if (cleanCode === 'P') {
                if (record.session === 'MORNING' || record.session === 'AFTERNOON' || record.session === 'HALF_DAY') {
                    days += 0.5;
                } else {
                    days += 1.0;
                }
            } else if (cleanCode === 'P/2') {
                days += 0.5;
            }

            if (cleanSecondary === 'P') {
                days += 0.5;
            }

            const currentTotal = staffDaysMap.get(record.staffId) || 0.0;
            staffDaysMap.set(record.staffId, currentTotal + days);
        }

        const db = prisma as any;

        // Cập nhật vào StaffLeaveBalance
        let updatedCount = 0;
        let totalDaysSynced = 0.0;

        for (const [staffId, attendanceDays] of Array.from(staffDaysMap.entries())) {
            const currentBalance = await db.staffLeaveBalance.findUnique({
                where: {
                    staffId_year: { staffId, year }
                }
            });

            if (currentBalance) {
                const totalAvail = Number(currentBalance.totalAvailable) || 12.0;
                const newRemaining = Math.max(0, totalAvail - attendanceDays);

                await db.staffLeaveBalance.update({
                    where: { id: currentBalance.id },
                    data: {
                        usedDays: attendanceDays,
                        remainingDays: newRemaining,
                        note: currentBalance.note 
                            ? `${currentBalance.note} (Đồng bộ chấm công: ${attendanceDays} ngày)`
                            : `Đồng bộ tự động từ Bảng chấm công ${year}`
                    }
                });
                updatedCount++;
                totalDaysSynced += attendanceDays;
            }
        }

        return NextResponse.json({
            success: true,
            year,
            recordsFound: attendanceRecords.length,
            updatedStaffCount: updatedCount,
            totalDaysSynced,
            message: `Đã đối soát thành công từ Bảng Chấm Công năm ${year}! Quét được ${attendanceRecords.length} lượt chấm phép (Tổng ${totalDaysSynced} ngày), đồng bộ cập nhật quỹ phép cho ${updatedCount} cán bộ.`
        });
    } catch (error: any) {
        console.error('Lỗi POST sync-attendance:', error);
        return NextResponse.json({ error: error.message || 'Lỗi hệ thống' }, { status: 500 });
    }
}

