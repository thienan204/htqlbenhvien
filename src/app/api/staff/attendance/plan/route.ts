import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await request.json();
        const {
            staffIds, // string[]
            startDate, // 'YYYY-MM-DD'
            endDate, // 'YYYY-MM-DD'
            code = 'x', // 'x' | 'P' | 'P/2' | 'Nb' | 'Nb/2' | 'H' | 'Ố' | 'TS' | 'KL' | 'L' | 'CLEAR'
            skipWeekends = true,
            overwrite = true,
            ma_khoa = 'KP046'
        } = body;

        if (!Array.isArray(staffIds) || staffIds.length === 0) {
            return NextResponse.json({ error: 'Vui lòng chọn ít nhất một nhân viên' }, { status: 400 });
        }

        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Vui lòng chọn khoảng ngày áp dụng' }, { status: 400 });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
            return NextResponse.json({ error: 'Khoảng ngày áp dụng không hợp lệ' }, { status: 400 });
        }

        // Tạo danh sách các ngày trong khoảng
        const dates: string[] = [];
        const curr = new Date(start);
        while (curr <= end) {
            const dayOfWeek = curr.getDay(); // 0: CN, 6: T7
            const dateStr = curr.toISOString().split('T')[0];

            if (!(skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6))) {
                dates.push(dateStr);
            }
            curr.setDate(curr.getDate() + 1);
        }

        if (dates.length === 0) {
            return NextResponse.json({ error: 'Không có ngày làm việc nào hợp lệ trong khoảng đã chọn (do đã bỏ qua T7/CN)' }, { status: 400 });
        }

        const cleanCode = (code || '').trim().toUpperCase();
        const isClear = cleanCode === '' || cleanCode === 'CLEAR' || cleanCode === 'XOA';

        // Chuẩn hóa mã lưu
        let formattedCode = code;
        let session = 'FULL_DAY';
        let value = 1.0;
        let secondaryCode: string | null = null;

        if (!isClear) {
            if (cleanCode === 'X') formattedCode = 'x';
            else if (cleanCode === 'NB') {
                formattedCode = 'Nb';
                value = 1.0;
            } else if (cleanCode === 'NB/2') {
                formattedCode = 'Nb/2';
                session = 'HALF_DAY';
                value = 0.5;
                secondaryCode = 'x';
            } else if (cleanCode === 'P/2') {
                formattedCode = 'P/2';
                session = 'HALF_DAY';
                value = 0.5;
                secondaryCode = 'x';
            } else if (cleanCode === 'X/2') {
                formattedCode = 'x/2';
                session = 'HALF_DAY';
                value = 0.5;
            } else if (cleanCode === 'P') formattedCode = 'P';
            else if (cleanCode === 'H') formattedCode = 'H';
            else if (cleanCode === 'L') formattedCode = 'L';
            else if (cleanCode === 'TS') formattedCode = 'TS';
            else if (cleanCode === 'KL') formattedCode = 'KL';
            else if (cleanCode === 'Ô' || cleanCode === 'O') formattedCode = 'Ố';
        }

        let appliedCells = 0;
        const skippedStaffNoDuty = new Set<string>();

        for (const staffId of staffIds) {
            for (const dateStr of dates) {
                const existing = await prisma.staffAttendanceRecord.findFirst({
                    where: {
                        staffId,
                        workDate: dateStr,
                        session: 'FULL_DAY'
                    }
                });

                if (isClear) {
                    if (existing) {
                        // Nếu công cũ là nghỉ bù có gắn dutyRecordId -> Hoàn lại quỹ ngày bù
                        if (existing.dutyRecordId) {
                            const targetDuty = await prisma.staffDutyRecord.findUnique({
                                where: { id: existing.dutyRecordId }
                            });
                            if (targetDuty) {
                                const newCompensated = Math.max(0, targetDuty.compensatedDays - (existing.value || 0.5));
                                await prisma.staffDutyRecord.update({
                                    where: { id: targetDuty.id },
                                    data: {
                                        compensatedDays: newCompensated,
                                        isFullyCompensated: newCompensated >= targetDuty.allowanceDays
                                    }
                                });
                            }
                        }

                        await prisma.staffAttendanceRecord.delete({
                            where: { id: existing.id }
                        });
                        appliedCells++;
                    }
                    continue;
                }

                // Nếu không overwrite và đã có dữ liệu -> Bỏ qua
                if (existing && !overwrite) {
                    continue;
                }

                let dutyRecordId: string | null = null;
                const isNb = cleanCode === 'NB' || cleanCode === 'NB/2';

                if (isNb) {
                    // Tự động tìm ca trực gần nhất chưa bù đủ trước ngày này
                    const candidateDuty = await prisma.staffDutyRecord.findFirst({
                        where: {
                            staffId,
                            dutyDate: { lte: dateStr },
                            isFullyCompensated: false
                        },
                        orderBy: { dutyDate: 'desc' }
                    });

                    if (!candidateDuty) {
                        // CHẶN: Cán bộ không có ca trực nào còn hạn mức để bù!
                        skippedStaffNoDuty.add(staffId);
                        continue;
                    }

                    dutyRecordId = candidateDuty.id;
                }

                if (existing) {
                    // Cập nhật lại bản ghi cũ
                    // Hoàn lại ca cũ nếu ca cũ khác
                    if (existing.dutyRecordId && existing.dutyRecordId !== dutyRecordId) {
                        const oldDuty = await prisma.staffDutyRecord.findUnique({
                            where: { id: existing.dutyRecordId }
                        });
                        if (oldDuty) {
                            const restoredComp = Math.max(0, oldDuty.compensatedDays - (existing.value || 0.5));
                            await prisma.staffDutyRecord.update({
                                where: { id: oldDuty.id },
                                data: {
                                    compensatedDays: restoredComp,
                                    isFullyCompensated: restoredComp >= oldDuty.allowanceDays
                                }
                            });
                        }
                    }

                    await prisma.staffAttendanceRecord.update({
                        where: { id: existing.id },
                        data: {
                            code: formattedCode,
                            session,
                            value,
                            secondaryCode,
                            dutyRecordId,
                            ma_khoa,
                            updatedBy: user.username || user.name || 'System'
                        }
                    });
                } else {
                    await prisma.staffAttendanceRecord.create({
                        data: {
                            staffId,
                            workDate: dateStr,
                            session,
                            code: formattedCode,
                            value,
                            secondaryCode,
                            dutyRecordId,
                            ma_khoa,
                            updatedBy: user.username || user.name || 'System'
                        }
                    });
                }

                // Cập nhật tăng ngày đã nghỉ bù cho ca trực liên kết (nếu có)
                if (dutyRecordId) {
                    const dutyToUpdate = await prisma.staffDutyRecord.findUnique({
                        where: { id: dutyRecordId }
                    });
                    if (dutyToUpdate) {
                        const newComp = dutyToUpdate.compensatedDays + value;
                        await prisma.staffDutyRecord.update({
                            where: { id: dutyRecordId },
                            data: {
                                compensatedDays: newComp,
                                isFullyCompensated: newComp >= dutyToUpdate.allowanceDays
                            }
                        });
                    }
                }

                appliedCells++;
            }
        }

        let messageText = `Đã áp dụng kế hoạch thành công cho ${appliedCells} ô!`;
        if (skippedStaffNoDuty.size > 0) {
            messageText += ` (Đã bỏ qua ${skippedStaffNoDuty.size} cán bộ do không có ca trực hợp lệ để chấm nghỉ bù).`;
        }

        return NextResponse.json({
            success: true,
            message: messageText,
            appliedCells,
            totalStaff: staffIds.length,
            totalDays: dates.length,
            skippedStaffCount: skippedStaffNoDuty.size
        });
    } catch (error) {
        console.error('Error applying attendance plan:', error);
        return NextResponse.json({ error: 'Lỗi máy chủ khi áp dụng kế hoạch chấm công' }, { status: 500 });
    }
}
