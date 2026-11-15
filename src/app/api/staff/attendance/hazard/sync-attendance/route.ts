import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const isSuperAdmin = user.role === 'ADMIN';
        const isTCCB = user.role === 'TCCB' || (user.ma_khoa && ['TCCB', 'TC_CB', 'P02'].includes(user.ma_khoa.toUpperCase()));
        const isDirector = user.userLevel === 'LEVEL_1_BGD' || user.isDirector;
        const isDeptLeader = Boolean(
            user.userLevel === 'LEVEL_2_LEADER' || 
            user.isDeptLeader || 
            user.isManager
        );
        const isLeader = isSuperAdmin || isTCCB || isDirector || isDeptLeader;

        if (!isLeader) {
            return NextResponse.json({ 
                error: 'Chỉ lãnh đạo khoa/phòng mới có quyền đồng bộ chấm độc hại!' 
            }, { status: 403 });
        }

        const body = await request.json();
        const {
            monthYear, // 'YYYY-MM'
            ma_khoa,
            hazardLevel = 2,
            allowanceRate = 20000,
            overwrite = false
        } = body;

        if (!monthYear || !ma_khoa) {
            return NextResponse.json({ error: 'Thiếu monthYear hoặc ma_khoa' }, { status: 400 });
        }

        const [yearStr, monthStr] = monthYear.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        // Lấy danh sách nhân viên khoa
        const staffList = await prisma.staff.findMany({
            where: { ma_khoa },
            select: { id: true, ho_ten: true }
        });
        const staffIds = staffList.map(s => s.id);

        // Lấy toàn bộ ngày công hành chính trong tháng của khoa
        const attendanceRecords = await prisma.staffAttendanceRecord.findMany({
            where: {
                staffId: { in: staffIds },
                workDate: {
                    gte: startDateStr,
                    lte: endDateStr
                }
            }
        });

        // Lấy các bản ghi độc hại hiện có
        const existingHazardRecords = await prisma.staffHazardRecord.findMany({
            where: {
                staffId: { in: staffIds },
                workDate: {
                    gte: startDateStr,
                    lte: endDateStr
                }
            }
        });

        const existingMap = new Set(existingHazardRecords.map(h => `${h.staffId}_${h.workDate}`));

        let syncedCount = 0;
        const rateMap: Record<number, number> = { 1: 13000, 2: 20000, 3: 26000, 4: 32000 };
        const resolvedRate = allowanceRate || rateMap[hazardLevel] || 20000;

        for (const att of attendanceRecords) {
            const key = `${att.staffId}_${att.workDate}`;
            if (!overwrite && existingMap.has(key)) {
                continue;
            }

            const c = (att.code || '').trim().toUpperCase();
            let hazardCode: string | null = null;
            let val = 1.0;

            // Nếu đi làm đủ ngày: X (>= 4h: 1.0)
            if (['X', '+', 'L', 'H'].includes(c) || c === 'NB') {
                hazardCode = 'X';
                val = 1.0;
            } else if (['X/2', '+/2', 'P/2', 'NB/2'].includes(c) || att.session === 'MORNING' || att.session === 'AFTERNOON') {
                // Đi làm nửa ngày: I (< 4h: 0.5)
                hazardCode = 'I';
                val = 0.5;
            }

            if (hazardCode) {
                await prisma.staffHazardRecord.upsert({
                    where: {
                        staffId_workDate: { staffId: att.staffId, workDate: att.workDate }
                    },
                    update: {
                        code: hazardCode,
                        value: val,
                        hazardLevel: Number(hazardLevel) || 2,
                        allowanceRate: resolvedRate,
                        updatedBy: user.id
                    },
                    create: {
                        staffId: att.staffId,
                        ma_khoa,
                        workDate: att.workDate,
                        code: hazardCode,
                        value: val,
                        hazardLevel: Number(hazardLevel) || 2,
                        allowanceRate: resolvedRate,
                        updatedBy: user.id,
                        createdBy: user.id
                    }
                });
                syncedCount++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Đã đồng bộ thành công ${syncedCount} ngày hưởng bồi dưỡng độc hại từ bảng chấm công!`,
            syncedCount
        });

    } catch (error: any) {
        console.error('Lỗi đồng bộ chấm độc hại:', error);
        return NextResponse.json({ error: error.message || 'Lỗi server nội bộ' }, { status: 500 });
    }
}

