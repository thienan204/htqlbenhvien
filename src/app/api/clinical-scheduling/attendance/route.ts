import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const maKhoa = searchParams.get('maKhoa');

        if (!date) {
            return NextResponse.json({ success: false, message: 'Thiếu tham số date (YYYY-MM-DD)' }, { status: 400 });
        }

        // Lấy danh sách Khoa/Phòng để làm dropdown filter
        const departments = await prisma.department.findMany({
            select: { ma_khoa: true, ten_khoa: true },
            orderBy: { ten_khoa: 'asc' }
        });

        // Lấy danh sách trạng thái điểm danh từ SystemCategory (DI_LAM, TRUC, DI_HOC, NGHI_PHEP, NGHI_OM, NGHI_BU)
        const attendanceStatuses = await prisma.systemCategory.findMany({
            where: { type: 'ATTENDANCE_STATUS', isActive: true },
            orderBy: { order: 'asc' }
        });

        const statusMap: Record<string, string> = {};
        attendanceStatuses.forEach(s => {
            statusMap[s.code] = s.id;
        });

        let staffList: any[] = [];
        if (maKhoa) {
            // Lấy danh sách nhân viên thuộc khoa kèm theo điểm danh của ngày cụ thể,
            // ĐỒNG THỜI liên thông lấy cả Bảng Chấm Công (StaffAttendanceRecord) và Bảng Chấm Trực (StaffDutyRecord)
            const rawStaff = await prisma.staff.findMany({
                where: { ma_khoa: maKhoa },
                include: {
                    trinh_do_ref: true,
                    chuc_danh_ref: true,
                    attendances: {
                        where: { workDate: { lte: date } },
                        orderBy: { workDate: 'desc' },
                        take: 1
                    },
                    attendanceRecords: {
                        where: { workDate: date }
                    },
                    dutyRecords: {
                        where: { dutyDate: date }
                    }
                },
                orderBy: { ho_ten: 'asc' }
            });

            // Format lại dữ liệu cho Frontend dễ dùng
            staffList = rawStaff.map(staff => {
                const latestAttendance = staff.attendances[0];
                const isToday = latestAttendance?.workDate === date;
                const attRec = staff.attendanceRecords?.[0];
                const dutyRec = staff.dutyRecords?.[0];

                let finalStatusId = isToday ? (latestAttendance?.statusId || null) : null;
                let finalDvkt = isToday && latestAttendance ? latestAttendance.is_thuc_hien_dvkt : true;

                // Nếu trong StaffAttendance chưa có bản ghi hôm nay, nhưng Bảng Chấm Công / Trực đã có dữ liệu:
                if (!isToday || !finalStatusId) {
                    if (dutyRec?.dutyCode) {
                        finalStatusId = statusMap['TRUC'] || null;
                        finalDvkt = true;
                    } else if (attRec?.code) {
                        const c = attRec.code.trim().toUpperCase();
                        if (c === 'X' || c === '+') {
                            finalStatusId = statusMap['DI_LAM'] || null;
                            finalDvkt = true;
                        } else if (c === 'NB/2') {
                            finalStatusId = statusMap['NGHI_BU_NUA_NGAY'] || null;
                            finalDvkt = true;
                        } else if (c === 'P/2') {
                            finalStatusId = statusMap['NGHI_PHEP_NUA_NGAY'] || null;
                            finalDvkt = true;
                        } else if (c === 'H') {
                            finalStatusId = statusMap['DI_HOC'] || null;
                            finalDvkt = false;
                        } else if (c === 'NB') {
                            finalStatusId = statusMap['NGHI_BU'] || null;
                            finalDvkt = false;
                        } else if (c === 'P') {
                            finalStatusId = statusMap['NGHI_PHEP'] || null;
                            finalDvkt = false;
                        } else if (c === 'L') {
                            finalStatusId = statusMap['NGHI_LE'] || null;
                            finalDvkt = false;
                        } else if (['Ô', 'O'].includes(c)) {
                            finalStatusId = statusMap['NGHI_OM'] || null;
                            finalDvkt = false;
                        } else if (c === 'TS') {
                            finalStatusId = statusMap['NGHI_THAI_SAN'] || null;
                            finalDvkt = false;
                        } else if (c === 'KL') {
                            finalStatusId = statusMap['NGHI_KHONG_LUONG'] || null;
                            finalDvkt = false;
                        }
                    }
                }

                return {
                    id: staff.id,
                    ma_nv: staff.ma_nv,
                    ho_ten: staff.ho_ten,
                    chuc_danh: staff.chuc_danh_ref?.code || staff.chuc_danh_ref?.type || '',
                    trinh_do: staff.trinh_do_ref?.code || staff.trinh_do_ref?.type || '',
                    statusId: finalStatusId,
                    is_thuc_hien_dvkt: finalDvkt,
                    attendanceId: isToday ? (latestAttendance?.id || null) : null
                };
            });
        }

        return NextResponse.json({
            success: true,
            departments,
            attendanceStatuses,
            staffList
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, staffId, statusId, is_thuc_hien_dvkt } = body;

        if (!date || !staffId) {
            return NextResponse.json({ success: false, message: 'Dữ liệu không hợp lệ' }, { status: 400 });
        }

        const attendance = await prisma.staffAttendance.upsert({
            where: {
                staffId_workDate: {
                    staffId: staffId,
                    workDate: date
                }
            },
            update: {
                statusId: statusId !== undefined ? statusId : undefined,
                is_thuc_hien_dvkt: is_thuc_hien_dvkt !== undefined ? is_thuc_hien_dvkt : undefined
            },
            create: {
                staffId: staffId,
                workDate: date,
                statusId: statusId || null,
                is_thuc_hien_dvkt: is_thuc_hien_dvkt !== undefined ? is_thuc_hien_dvkt : true
            }
        });

        // ĐỒNG BỘ 2 CHIỀU: Cập nhật ngược lại vào Bảng Chấm Công (StaffAttendanceRecord) & Bảng Trực (StaffDutyRecord)
        if (statusId) {
            try {
                const targetCat = await prisma.systemCategory.findUnique({
                    where: { id: statusId }
                });

                const staff = await prisma.staff.findUnique({
                    where: { id: staffId }
                });

                if (targetCat && staff) {
                    const statusCode = targetCat.code.toUpperCase();
                    const maKhoa = staff.ma_khoa || 'KP046';
                    const defaultWorkCode = (maKhoa === 'KP046') ? 'x' : '+';

                    if (statusCode === 'DI_LAM') {
                        await prisma.staffAttendanceRecord.upsert({
                            where: {
                                staffId_workDate_session: { staffId, workDate: date, session: 'FULL_DAY' }
                            },
                            update: { code: defaultWorkCode, value: 1.0 },
                            create: { staffId, ma_khoa: maKhoa, workDate: date, code: defaultWorkCode, session: 'FULL_DAY', value: 1.0 }
                        });
                    } else if (statusCode === 'TRUC') {
                        await prisma.staffAttendanceRecord.upsert({
                            where: {
                                staffId_workDate_session: { staffId, workDate: date, session: 'FULL_DAY' }
                            },
                            update: { code: defaultWorkCode, value: 1.0 },
                            create: { staffId, ma_khoa: maKhoa, workDate: date, code: defaultWorkCode, session: 'FULL_DAY', value: 1.0 }
                        });
                        await prisma.staffDutyRecord.upsert({
                            where: { staffId_dutyDate: { staffId, dutyDate: date } },
                            update: { dutyCode: 'T', allowanceDays: 1.0 },
                            create: { staffId, ma_khoa: maKhoa, dutyDate: date, dutyCode: 'T', allowanceDays: 1.0, compensatedDays: 0, isFullyCompensated: false }
                        });
                    } else if (statusCode === 'DI_HOC') {
                        await prisma.staffAttendanceRecord.upsert({
                            where: {
                                staffId_workDate_session: { staffId, workDate: date, session: 'FULL_DAY' }
                            },
                            update: { code: 'H', value: 1.0 },
                            create: { staffId, ma_khoa: maKhoa, workDate: date, code: 'H', session: 'FULL_DAY', value: 1.0 }
                        });
                    } else if (statusCode === 'NGHI_BU') {
                        await prisma.staffAttendanceRecord.upsert({
                            where: {
                                staffId_workDate_session: { staffId, workDate: date, session: 'FULL_DAY' }
                            },
                            update: { code: 'Nb', value: 1.0 },
                            create: { staffId, ma_khoa: maKhoa, workDate: date, code: 'Nb', session: 'FULL_DAY', value: 1.0 }
                        });
                    } else if (statusCode === 'NGHI_BU_NUA_NGAY') {
                        await prisma.staffAttendanceRecord.upsert({
                            where: {
                                staffId_workDate_session: { staffId, workDate: date, session: 'FULL_DAY' }
                            },
                            update: { code: 'Nb/2', session: 'HALF_DAY', secondaryCode: 'x', value: 0.5 },
                            create: { staffId, ma_khoa: maKhoa, workDate: date, code: 'Nb/2', session: 'HALF_DAY', secondaryCode: 'x', value: 0.5 }
                        });
                    } else if (statusCode === 'NGHI_PHEP') {
                        await prisma.staffAttendanceRecord.upsert({
                            where: {
                                staffId_workDate_session: { staffId, workDate: date, session: 'FULL_DAY' }
                            },
                            update: { code: 'P', value: 1.0 },
                            create: { staffId, ma_khoa: maKhoa, workDate: date, code: 'P', session: 'FULL_DAY', value: 1.0 }
                        });
                    } else if (statusCode === 'NGHI_PHEP_NUA_NGAY') {
                        await prisma.staffAttendanceRecord.upsert({
                            where: {
                                staffId_workDate_session: { staffId, workDate: date, session: 'FULL_DAY' }
                            },
                            update: { code: 'P/2', session: 'HALF_DAY', secondaryCode: 'x', value: 0.5 },
                            create: { staffId, ma_khoa: maKhoa, workDate: date, code: 'P/2', session: 'HALF_DAY', secondaryCode: 'x', value: 0.5 }
                        });
                    } else if (statusCode === 'NGHI_LE') {
                        await prisma.staffAttendanceRecord.upsert({
                            where: {
                                staffId_workDate_session: { staffId, workDate: date, session: 'FULL_DAY' }
                            },
                            update: { code: 'L', value: 1.0 },
                            create: { staffId, ma_khoa: maKhoa, workDate: date, code: 'L', session: 'FULL_DAY', value: 1.0 }
                        });
                    } else if (statusCode === 'NGHI_OM') {
                        await prisma.staffAttendanceRecord.upsert({
                            where: {
                                staffId_workDate_session: { staffId, workDate: date, session: 'FULL_DAY' }
                            },
                            update: { code: 'Ô', value: 1.0 },
                            create: { staffId, ma_khoa: maKhoa, workDate: date, code: 'Ô', session: 'FULL_DAY', value: 1.0 }
                        });
                    } else if (statusCode === 'NGHI_THAI_SAN') {
                        await prisma.staffAttendanceRecord.upsert({
                            where: {
                                staffId_workDate_session: { staffId, workDate: date, session: 'FULL_DAY' }
                            },
                            update: { code: 'TS', value: 1.0 },
                            create: { staffId, ma_khoa: maKhoa, workDate: date, code: 'TS', session: 'FULL_DAY', value: 1.0 }
                        });
                    } else if (statusCode === 'NGHI_KHONG_LUONG') {
                        await prisma.staffAttendanceRecord.upsert({
                            where: {
                                staffId_workDate_session: { staffId, workDate: date, session: 'FULL_DAY' }
                            },
                            update: { code: 'KL', value: 1.0 },
                            create: { staffId, ma_khoa: maKhoa, workDate: date, code: 'KL', session: 'FULL_DAY', value: 1.0 }
                        });
                    }
                }
            } catch (errSync) {
                console.error('Lỗi đồng bộ ngược sang Bảng Chấm Công:', errSync);
            }
        }

        return NextResponse.json({ success: true, attendance });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
