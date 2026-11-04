import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';
import { getVietnamTimeParts, getCurrentHospitalShift, getActiveDutyDate, isHalfDayWorkingNow, HospitalShiftConfig } from '@/lib/shiftUtils';

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await request.json();
        const {
            type, // 'ATTENDANCE' | 'DUTY'
            staffId,
            ma_khoa,
            date, // 'YYYY-MM-DD'
            // For ATTENDANCE:
            code, // 'x' | 'Nb' | 'P' | 'L' | 'H' | 'Ô' | 'TS' | 'KL' | '' (delete)
            session = 'FULL_DAY', // 'FULL_DAY' | 'MORNING' | 'AFTERNOON'
            secondaryCode = null, // e.g. 'x' nếu buổi còn lại đi làm (thành 'Nb/x' hoặc 'x/Nb')
            value = 1.0,
            dutyRecordId = null,
            note = null,
            // For DUTY:
            dutyCode, // 'T' | 'C' | 'L' | 'Te' | '' (delete)
            dutyType = 'TRUC_CHINH'
        } = body;

        if (!staffId || !date || !type) {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc (staffId, date, type)' }, { status: 400 });
        }

        const vnTime = getVietnamTimeParts();
        const todayStr = vnTime.dateStr;

        // 1. XỬ LÝ CHẤM TRỰC (DUTY)
        if (type === 'DUTY') {
            if (!dutyCode || dutyCode === '') {
                // Xóa ca trực
                const existingDuty = await prisma.staffDutyRecord.findUnique({
                    where: {
                        staffId_dutyDate: { staffId, dutyDate: date }
                    },
                    include: { compensations: true }
                });

                if (existingDuty) {
                    if (existingDuty.compensations && existingDuty.compensations.length > 0) {
                        return NextResponse.json({
                            error: `Không thể xóa ca trực ngày ${date} vì đã có ngày chấm nghỉ bù liên kết đến ca trực này! Vui lòng hủy các ngày nghỉ bù trước.`
                        }, { status: 400 });
                    }

                    await prisma.staffDutyRecord.delete({
                        where: { id: existingDuty.id }
                    });
                }

                return NextResponse.json({ success: true, message: `Đã xóa ca trực ngày ${date}` });
            }

            // Theo luật & QĐ 73/2011/QĐ-TTg:
            // - Trực Lễ (L), Trực Tết (Te): nghỉ bù 2 ngày
            // - Trực Thường (T), T7/CN (C), Trực kèm (TK): nghỉ bù 1 ngày
            // - Trực thường trú (TT - on-call tại nhà): 0 ngày nghỉ bù (chỉ hưởng phụ cấp thường trú)
            const cleanDutyCode = dutyCode.trim().toUpperCase();
            let resolvedDutyType = dutyType || 'TRUC_CHINH';
            if (cleanDutyCode === 'TK') resolvedDutyType = 'TRUC_KEM';
            else if (cleanDutyCode === 'TT') resolvedDutyType = 'TRUC_THUONG_TRU';
            else if (['T', 'C', 'L', 'TE'].includes(cleanDutyCode)) resolvedDutyType = 'TRUC_CHINH';

            const allowanceDays = (cleanDutyCode === 'L' || cleanDutyCode === 'TE') ? 2.0 : (cleanDutyCode === 'TT' ? 0.0 : 1.0);

            const updatedDuty = await prisma.staffDutyRecord.upsert({
                where: {
                    staffId_dutyDate: { staffId, dutyDate: date }
                },
                update: {
                    dutyCode: cleanDutyCode,
                    dutyType: resolvedDutyType,
                    allowanceDays,
                    note: note || null,
                    updatedBy: user.id
                },
                create: {
                    staffId,
                    ma_khoa: ma_khoa || 'KP046',
                    dutyDate: date,
                    dutyCode: cleanDutyCode,
                    dutyType: resolvedDutyType,
                    allowanceDays,
                    compensatedDays: 0.0,
                    isFullyCompensated: false,
                    note: note || null,
                    updatedBy: user.id
                }
            });

            // TỰ ĐỘNG ĐỒNG BỘ: Đi trực thì vẫn tính công đi làm!
            // Nếu ngày hôm đó chưa có bản ghi chấm công (StaffAttendanceRecord), tự động điền công đi làm
            try {
                const existingAtt = await prisma.staffAttendanceRecord.findFirst({
                    where: { staffId, workDate: date }
                });

                if (!existingAtt) {
                    const defaultWorkCode = '+';
                    await prisma.staffAttendanceRecord.create({
                        data: {
                            staffId,
                            ma_khoa: ma_khoa || 'KP046',
                            workDate: date,
                            code: defaultWorkCode,
                            session: 'FULL_DAY',
                            value: 1.0,
                            updatedBy: user.id
                        }
                    });
                }
            } catch (errAtt) {
                console.error('Lỗi tự động tạo công đi làm khi chấm trực:', errAtt);
            }

            // Đồng bộ sang phân hệ Lâm sàng (StaffAttendance: Bật quyền thực hiện DVKT)
            try {
                await prisma.staffAttendance.upsert({
                    where: {
                        staffId_workDate: { staffId, workDate: date }
                    },
                    update: {
                        is_thuc_hien_dvkt: true
                    },
                    create: {
                        staffId,
                        workDate: date,
                        is_thuc_hien_dvkt: true
                    }
                });
            } catch (errClinical) {
                console.error('Lỗi đồng bộ sang StaffAttendance (Lâm sàng):', errClinical);
            }

            return NextResponse.json({ success: true, dutyRecord: updatedDuty });
        }

        // 2. XỬ LÝ CHẤM CÔNG (ATTENDANCE)
        if (type === 'ATTENDANCE') {
            const cleanCode = (code || '').trim().toUpperCase();

            // Lấy bản ghi chấm công hiện tại (nếu có)
            const existingAttendance = await prisma.staffAttendanceRecord.findFirst({
                where: {
                    staffId,
                    workDate: date,
                    session
                }
            });

            // Nếu người dùng chọn xóa công (cleanCode rỗng)
            if (!cleanCode) {
                if (existingAttendance) {
                    // Nếu công cũ là nghỉ bù có gắn dutyRecordId -> Hoàn lại quỹ ngày bù cho ca trực đó!
                    if (existingAttendance.dutyRecordId) {
                        const targetDuty = await prisma.staffDutyRecord.findUnique({
                            where: { id: existingAttendance.dutyRecordId }
                        });
                        if (targetDuty) {
                            const newCompensated = Math.max(0, targetDuty.compensatedDays - (existingAttendance.value || 0.5));
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
                        where: { id: existingAttendance.id }
                    });
                }

                return NextResponse.json({ success: true, message: `Đã xóa chấm công ngày ${date}` });
            }

            // Nếu chọn chấm Nghỉ Bù (Nb hoặc Nb/2) -> Bắt buộc phải có ca trực liên kết!
            let finalDutyRecordId = dutyRecordId;
            const isNb = cleanCode === 'NB' || cleanCode === 'NB/2';
            const isNbHalf = cleanCode === 'NB/2';
            const isPhalf = cleanCode === 'P/2';

            if (isNb) {
                if (!finalDutyRecordId) {
                    // Tự động tìm ca trực gần nhất chưa bù đủ trước ngày này
                    const candidateDuty = await prisma.staffDutyRecord.findFirst({
                        where: {
                            staffId,
                            dutyDate: { lte: date },
                            isFullyCompensated: false
                        },
                        orderBy: { dutyDate: 'desc' }
                    });

                    if (!candidateDuty) {
                        return NextResponse.json({
                            error: 'Cán bộ này không có ca trực nào để chấm nghỉ bù!'
                        }, { status: 400 });
                    }
                    finalDutyRecordId = candidateDuty.id;
                }
            }

            // Chuẩn hóa mã lưu
            let formattedCode = cleanCode;
            let finalSession = session;
            let finalValue = typeof value === 'number' ? value : 1.0;
            let finalSecondaryCode = secondaryCode ? secondaryCode.trim() : null;

            const isSpecifiedSession = session === 'MORNING' || session === 'AFTERNOON';

            if (cleanCode === 'X') {
                formattedCode = 'x';
                finalValue = 1.0;
                finalSession = 'FULL_DAY';
            } else if (cleanCode === '+') {
                formattedCode = '+';
                finalValue = 1.0;
                finalSession = 'FULL_DAY';
            } else if (cleanCode === 'X/2') {
                formattedCode = 'x/2';
                finalSession = isSpecifiedSession ? session : 'HALF_DAY';
                finalValue = 0.5;
                if (!finalSecondaryCode) finalSecondaryCode = 'x';
            } else if (cleanCode === '+/2') {
                formattedCode = '+/2';
                finalSession = isSpecifiedSession ? session : 'HALF_DAY';
                finalValue = 0.5;
                if (!finalSecondaryCode) finalSecondaryCode = '+';
            } else if (cleanCode === 'NB') {
                formattedCode = 'Nb';
                finalValue = 1.0;
                finalSession = 'FULL_DAY';
            } else if (cleanCode === 'NB/2') {
                formattedCode = 'Nb/2';
                finalSession = isSpecifiedSession ? session : 'HALF_DAY';
                finalValue = 0.5;
                if (!finalSecondaryCode) finalSecondaryCode = '+';
            } else if (cleanCode === 'P/2') {
                formattedCode = 'P/2';
                finalSession = isSpecifiedSession ? session : 'HALF_DAY';
                finalValue = 0.5;
                if (!finalSecondaryCode) finalSecondaryCode = '+';
            }

            // Cập nhật hoặc tạo mới bản ghi chấm công
            let updatedAttendance;
            if (existingAttendance) {
                // Nếu đổi ca trực liên kết hoặc đổi hình thức nghỉ bù -> hoàn lại ca cũ và trừ ca mới
                if (existingAttendance.dutyRecordId && existingAttendance.dutyRecordId !== finalDutyRecordId) {
                    const oldDuty = await prisma.staffDutyRecord.findUnique({
                        where: { id: existingAttendance.dutyRecordId }
                    });
                    if (oldDuty) {
                        const restoredComp = Math.max(0, oldDuty.compensatedDays - (existingAttendance.value || 0.5));
                        await prisma.staffDutyRecord.update({
                            where: { id: oldDuty.id },
                            data: {
                                compensatedDays: restoredComp,
                                isFullyCompensated: restoredComp >= oldDuty.allowanceDays
                            }
                        });
                    }
                }

                updatedAttendance = await prisma.staffAttendanceRecord.update({
                    where: { id: existingAttendance.id },
                    data: {
                        code: formattedCode,
                        session: finalSession,
                        secondaryCode: finalSecondaryCode,
                        value: finalValue,
                        dutyRecordId: isNb ? finalDutyRecordId : null,
                        note: note || null,
                        updatedBy: user.id
                    }
                });
            } else {
                updatedAttendance = await prisma.staffAttendanceRecord.create({
                    data: {
                        staffId,
                        ma_khoa: ma_khoa || 'KP046',
                        workDate: date,
                        code: formattedCode,
                        session: finalSession,
                        secondaryCode: finalSecondaryCode,
                        value: finalValue,
                        dutyRecordId: isNb ? finalDutyRecordId : null,
                        note: note || null,
                        updatedBy: user.id
                    }
                });
            }

            // Nếu chấm Nghỉ bù -> Tính lại chính xác tổng compensatedDays từ các bản ghi bù
            if (isNb && finalDutyRecordId) {
                const targetDuty = await prisma.staffDutyRecord.findUnique({
                    where: { id: finalDutyRecordId },
                    include: { compensations: true }
                });

                if (targetDuty) {
                    const allComps = await prisma.staffAttendanceRecord.findMany({
                        where: { dutyRecordId: finalDutyRecordId }
                    });
                    const totalComp = allComps.reduce((acc, c) => acc + (c.code === 'Nb/2' || c.session === 'HALF_DAY' ? 0.5 : 1.0), 0);
                    await prisma.staffDutyRecord.update({
                        where: { id: finalDutyRecordId },
                        data: {
                            compensatedDays: totalComp,
                            isFullyCompensated: totalComp >= targetDuty.allowanceDays
                        }
                    });
                }
            }

            // 3. ĐỒNG BỘ TRẠNG THÁI NHẬN VIỆC CNTT (isAvailable) NẾU LÀ NGÀY HÔM NAY
            if (date === todayStr) {
                try {
                    const staffRecord = await prisma.staff.findUnique({
                        where: { id: staffId },
                        include: {
                            chuc_vu_ref: true,
                            user: true
                        }
                    });

                    if (staffRecord && staffRecord.user) {
                        const isSupportDept = ['KP046', 'KP038', 'KP040'].includes(staffRecord.ma_khoa || '') || ['CNTT', 'VTYT', 'HCQT'].includes(staffRecord.user.role);
                        
                        if (isSupportDept) {
                            // Đọc cấu hình liên kết chấm công & cấu hình toàn viện
                            const [itConfigRule, hospitalConfigRule] = await Promise.all([
                                prisma.specializedRule.findUnique({ where: { slug: 'it-request-fields-config' } }),
                                prisma.specializedRule.findUnique({ where: { slug: 'hospital-attendance-config' } })
                            ]);
                            const itConfig: any = itConfigRule?.logicConfig || {};
                            const hospitalConfig: any = hospitalConfigRule?.logicConfig || {};
                            const workHours = hospitalConfig.workHours || {};

                            const syncAttendanceEnabled = itConfig.syncAttendanceEnabled !== false;
                            const applyForLeaders = itConfig.applyForLeaders === true;
                            const autoDisableOnLeave = itConfig.autoDisableOnLeave !== false;

                            const morningStart = workHours.morningStart || itConfig.morningStartTime || '07:00';
                            const morningEnd = workHours.morningEnd || itConfig.morningEndTime || '11:30';
                            const afternoonStart = workHours.afternoonStart || itConfig.afternoonStartTime || '13:30';
                            const afternoonEnd = workHours.afternoonEnd || itConfig.afternoonEndTime || itConfig.officeEndTime || '17:00';

                            const holidays = Array.isArray(hospitalConfig.holidays)
                                ? hospitalConfig.holidays.map((h: any) => h.date).filter(Boolean)
                                : (Array.isArray(itConfig.holidays) ? itConfig.holidays : []);
                            const makeupWorkdays = Array.isArray(hospitalConfig.makeupWorkdays)
                                ? hospitalConfig.makeupWorkdays.map((m: any) => m.date).filter(Boolean)
                                : (Array.isArray(itConfig.makeupWorkdays) ? itConfig.makeupWorkdays : []);

                            const shiftConfig: HospitalShiftConfig = {
                                morningStart,
                                morningEnd,
                                afternoonStart,
                                afternoonEnd,
                                holidays,
                                makeupWorkdays
                            };

                            const shiftInfo = getCurrentHospitalShift(shiftConfig);
                            const isOfficeHours = shiftInfo.isOfficeHours;
                            const activeDutyDate = getActiveDutyDate(new Date(), morningStart);

                            const explicitLevel = (staffRecord.chuc_vu_ref as any)?.level;
                            const cvCode = (staffRecord.chuc_vu_ref?.code || '').toUpperCase();
                            const cvName = (staffRecord.chuc_vu_ref?.name || '').toLowerCase();
                            const isTeamLeader = Boolean(
                                explicitLevel === 'LEVEL_2_1_TEAM_LEADER' || 
                                explicitLevel === 'LEVEL_2.1' || 
                                cvCode === 'TO_TRUONG' || 
                                cvCode.includes('TO_TRUONG') || 
                                cvName.includes('tổ trưởng')
                            );
                            const isLeader = !isTeamLeader && Boolean(
                                explicitLevel === 'LEVEL_1_BGD' ||
                                explicitLevel === 'LEVEL_2_LEADER' ||
                                cvCode.includes('TRUONG_PHONG') ||
                                cvCode.includes('PHO_TRUONG_PHONG') ||
                                cvCode.includes('TRUONG_KHOA') ||
                                cvCode.includes('PHO_TRUONG_KHOA') ||
                                cvName.includes('trưởng phòng') ||
                                cvName.includes('phó trưởng phòng') ||
                                cvName.includes('trưởng khoa') ||
                                cvName.includes('phó trưởng khoa')
                            );

                            if (syncAttendanceEnabled) {
                                const activeDuty = await prisma.staffDutyRecord.findFirst({
                                    where: {
                                        staffId: staffRecord.id,
                                        dutyDate: activeDutyDate
                                    }
                                });

                                const isFullDayLeave = ['P', 'O', 'CO', 'NB', 'K', 'RO', 'TS', 'H', 'KL'].includes(cleanCode);
                                const isHalfDayLeave = ['NB/2', 'P/2'].includes(cleanCode);
                                const isWorkingFullDay = ['X', '+'].includes(cleanCode);
                                const hasDutyNow = !isFullDayLeave && Boolean(activeDuty || cleanCode === 'T' || cleanCode.startsWith('T/'));

                                let nextIsAvailable = false;

                                if (isFullDayLeave) {
                                    // Nghỉ cả ngày: Luôn TẮT
                                    nextIsAvailable = false;
                                } else if (isHalfDayLeave) {
                                    // Nghỉ nửa ngày: Xét theo buổi làm việc hiện tại
                                    const isWorkingNow = isHalfDayWorkingNow(session, shiftInfo.shiftType);
                                    if (isOfficeHours && isWorkingNow) {
                                        nextIsAvailable = !isLeader || applyForLeaders;
                                    } else {
                                        nextIsAvailable = hasDutyNow && (!isLeader || applyForLeaders);
                                    }
                                } else if (isWorkingFullDay) {
                                    if (isOfficeHours) {
                                        nextIsAvailable = !isLeader || applyForLeaders;
                                    } else {
                                        nextIsAvailable = hasDutyNow && (!isLeader || applyForLeaders);
                                    }
                                } else {
                                    if (hasDutyNow) {
                                        nextIsAvailable = !isLeader || applyForLeaders;
                                    } else if (isOfficeHours && !autoDisableOnLeave) {
                                        nextIsAvailable = staffRecord.user.isAvailable;
                                    } else {
                                        nextIsAvailable = false;
                                    }
                                }

                                if (staffRecord.user.isAvailable !== nextIsAvailable) {
                                    await prisma.user.update({
                                        where: { id: staffRecord.user.id },
                                        data: { isAvailable: nextIsAvailable }
                                    });
                                }
                            }
                        }
                    }
                } catch (errSync) {
                    console.error('Lỗi tự động đồng bộ trạng thái nhận việc CNTT:', errSync);
                }
            }

            // 4. ĐỒNG BỘ SANG PHÂN HỆ LÂM SÀNG (StaffAttendance: TRẠNG THÁI & QUYỀN THỰC HIỆN DVKT)
            try {
                let targetStatusCode: string | undefined = undefined;
                let dvktValue: boolean = true;

                if (['X', '+', 'X/2', '+/2'].includes(cleanCode)) {
                    targetStatusCode = 'DI_LAM';
                    dvktValue = true;
                } else if (cleanCode === 'NB/2') {
                    targetStatusCode = 'NGHI_BU_NUA_NGAY';
                    dvktValue = true; // Vẫn làm nửa ngày -> bật DVKT
                } else if (cleanCode === 'P/2') {
                    targetStatusCode = 'NGHI_PHEP_NUA_NGAY';
                    dvktValue = true; // Vẫn làm nửa ngày -> bật DVKT
                } else if (cleanCode === 'NB') {
                    targetStatusCode = 'NGHI_BU';
                    dvktValue = false;
                } else if (cleanCode === 'P') {
                    targetStatusCode = 'NGHI_PHEP';
                    dvktValue = false;
                } else if (cleanCode === 'H') {
                    targetStatusCode = 'DI_HOC';
                    dvktValue = false;
                } else if (cleanCode === 'L') {
                    targetStatusCode = 'NGHI_LE';
                    dvktValue = false;
                } else if (['Ô', 'O'].includes(cleanCode)) {
                    targetStatusCode = 'NGHI_OM';
                    dvktValue = false;
                } else if (cleanCode === 'TS') {
                    targetStatusCode = 'NGHI_THAI_SAN';
                    dvktValue = false;
                } else if (cleanCode === 'KL') {
                    targetStatusCode = 'NGHI_KHONG_LUONG';
                    dvktValue = false;
                }

                let targetStatusId: string | undefined = undefined;
                if (targetStatusCode) {
                    const statusCat = await prisma.systemCategory.findFirst({
                        where: { type: 'ATTENDANCE_STATUS', code: targetStatusCode }
                    });
                    if (statusCat) targetStatusId = statusCat.id;
                }

                await prisma.staffAttendance.upsert({
                    where: {
                        staffId_workDate: { staffId, workDate: date }
                    },
                    update: {
                        statusId: targetStatusId !== undefined ? targetStatusId : undefined,
                        is_thuc_hien_dvkt: dvktValue
                    },
                    create: {
                        staffId,
                        workDate: date,
                        statusId: targetStatusId || null,
                        is_thuc_hien_dvkt: dvktValue
                    }
                });
            } catch (errClinical) {
                console.error('Lỗi đồng bộ chấm công sang StaffAttendance (Lâm sàng):', errClinical);
            }

            return NextResponse.json({ success: true, attendanceRecord: updatedAttendance });
        }

        return NextResponse.json({ error: 'Loại thao tác không hợp lệ' }, { status: 400 });
    } catch (error: any) {
        console.error('Error updating attendance cell:', error);
        return NextResponse.json({ error: error.message || 'Lỗi khi cập nhật' }, { status: 500 });
    }
}
