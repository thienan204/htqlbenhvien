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
            selectedDaysOfWeek = [], // number[]: 0 (CN), 1 (T2), ..., 6 (T7). Nếu rỗng: tất cả các ngày
            dutyCode = 'T', // 'T' | 'C' | 'L' | 'TE' | 'TK' | 'TT' | 'CLEAR'
            dutyType, // optional: 'TRUC_CHINH' | 'TRUC_KEM' | 'TRUC_THUONG_TRU'
            overwrite = true,
            autoCreateAttendance = true,
            ma_khoa = 'KP046',
            note
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

        // Tạo danh sách các ngày hợp lệ theo bộ lọc thứ trong tuần
        const dates: string[] = [];
        const curr = new Date(start);
        const hasDayOfWeekFilter = Array.isArray(selectedDaysOfWeek) && selectedDaysOfWeek.length > 0;

        while (curr <= end) {
            const dayOfWeek = curr.getDay(); // 0: CN, 1: T2, ..., 6: T7
            const dateStr = curr.toISOString().split('T')[0];

            if (!hasDayOfWeekFilter || selectedDaysOfWeek.includes(dayOfWeek)) {
                dates.push(dateStr);
            }
            curr.setDate(curr.getDate() + 1);
        }

        if (dates.length === 0) {
            return NextResponse.json({
                error: 'Không tìm thấy ngày nào phù hợp với bộ lọc thứ trong tuần đã chọn!'
            }, { status: 400 });
        }

        const cleanDutyCode = (dutyCode || '').trim().toUpperCase();
        const isClear = cleanDutyCode === '' || cleanDutyCode === 'CLEAR' || cleanDutyCode === 'XOA';

        // Phân loại hình thức và hạn mức ngày nghỉ bù theo luật & QĐ 73/2011/QĐ-TTg:
        // - Trực Lễ (L), Trực Tết (Te): nghỉ bù 2 ngày
        // - Trực Thường (T), T7/CN (C), Trực kèm (TK): nghỉ bù 1 ngày
        // - Trực thường trú (TT - on-call tại nhà): 0 ngày nghỉ bù (chỉ hưởng phụ cấp thường trú)
        let resolvedDutyType = dutyType || 'TRUC_CHINH';
        if (cleanDutyCode === 'TK') resolvedDutyType = 'TRUC_KEM';
        else if (cleanDutyCode === 'TT') resolvedDutyType = 'TRUC_THUONG_TRU';
        else if (['T', 'C', 'L', 'TE'].includes(cleanDutyCode)) resolvedDutyType = 'TRUC_CHINH';

        const allowanceDays = (cleanDutyCode === 'L' || cleanDutyCode === 'TE')
            ? 2.0
            : (cleanDutyCode === 'TT' ? 0.0 : 1.0);

        let appliedCount = 0;
        let skippedCount = 0;
        let skippedCompensatedDuties = 0;

        for (const staffId of staffIds) {
            for (const dateStr of dates) {
                const existingDuty = await prisma.staffDutyRecord.findUnique({
                    where: {
                        staffId_dutyDate: { staffId, dutyDate: dateStr }
                    },
                    include: { compensations: true }
                });

                if (isClear) {
                    if (existingDuty) {
                        // Bảo vệ: Nếu ca trực đã có người chấm nghỉ bù liên kết thì không được xóa đè
                        if (existingDuty.compensations && existingDuty.compensations.length > 0) {
                            skippedCompensatedDuties++;
                            continue;
                        }
                        await prisma.staffDutyRecord.delete({
                            where: { id: existingDuty.id }
                        });
                        appliedCount++;
                    }
                    continue;
                }

                // Nếu đã có ca trực mà không cho phép ghi đè thì bỏ qua
                if (existingDuty && !overwrite) {
                    skippedCount++;
                    continue;
                }

                // Nếu ghi đè mà ca trực cũ đã có ngày bù liên kết -> tránh làm mất liên kết nếu đổi loại ca trực
                if (existingDuty && existingDuty.compensations && existingDuty.compensations.length > 0) {
                    skippedCompensatedDuties++;
                    continue;
                }

                if (existingDuty) {
                    await prisma.staffDutyRecord.update({
                        where: { id: existingDuty.id },
                        data: {
                            dutyCode: cleanDutyCode,
                            dutyType: resolvedDutyType,
                            allowanceDays,
                            note: note || null,
                            updatedBy: user.id
                        }
                    });
                } else {
                    await prisma.staffDutyRecord.create({
                        data: {
                            staffId,
                            ma_khoa: ma_khoa || 'KP046',
                            dutyDate: dateStr,
                            dutyCode: cleanDutyCode,
                            dutyType: resolvedDutyType,
                            allowanceDays,
                            compensatedDays: 0.0,
                            isFullyCompensated: false,
                            note: note || null,
                            updatedBy: user.id
                        }
                    });
                }

                appliedCount++;

                // TỰ ĐỘNG ĐỒNG BỘ: Đi trực thì vẫn tính công đi làm!
                if (autoCreateAttendance) {
                    try {
                        const existingAtt = await prisma.staffAttendanceRecord.findFirst({
                            where: { staffId, workDate: dateStr }
                        });

                        if (!existingAtt) {
                            const defaultWorkCode = (ma_khoa === 'KP046') ? 'x' : '+';
                            await prisma.staffAttendanceRecord.create({
                                data: {
                                    staffId,
                                    ma_khoa: ma_khoa || 'KP046',
                                    workDate: dateStr,
                                    code: defaultWorkCode,
                                    session: 'FULL_DAY',
                                    value: 1.0,
                                    updatedBy: user.id
                                }
                            });
                        }
                    } catch (errAtt) {
                        console.error('Lỗi tự động tạo công khi phân trực:', errAtt);
                    }
                }

                // Đồng bộ sang phân hệ Lâm sàng (StaffAttendance: Bật quyền thực hiện DVKT)
                try {
                    await prisma.staffAttendance.upsert({
                        where: {
                            staffId_workDate: { staffId, workDate: dateStr }
                        },
                        update: {
                            is_thuc_hien_dvkt: true
                        },
                        create: {
                            staffId,
                            workDate: dateStr,
                            is_thuc_hien_dvkt: true
                        }
                    });
                } catch (errClinical) {
                    console.error('Lỗi đồng bộ sang StaffAttendance (Lâm sàng):', errClinical);
                }
            }
        }

        let messageText = isClear
            ? `Đã xóa lịch trực thành công cho ${appliedCount} lượt phân trực!`
            : `Đã phân trực thành công cho ${appliedCount} lượt phân trực!`;

        if (skippedCompensatedDuties > 0) {
            messageText += ` (Đã bỏ qua ${skippedCompensatedDuties} ca trực do đã có ngày nghỉ bù liên kết).`;
        }

        return NextResponse.json({
            success: true,
            message: messageText,
            appliedCount,
            skippedCount,
            skippedCompensatedDuties,
            totalStaff: staffIds.length,
            totalDays: dates.length
        });
    } catch (error) {
        console.error('Error applying duty plan:', error);
        return NextResponse.json({
            error: 'Đã xảy ra lỗi máy chủ khi áp dụng kế hoạch phân trực'
        }, { status: 500 });
    }
}
