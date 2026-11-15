import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { isSystemConfigEnabled } from '@/lib/systemConfig';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const maKhoa = searchParams.get('maKhoa');
        const reloadFromTimesheet = searchParams.get('reloadFromTimesheet') === 'true';

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
        let hasConfirmedAttendance = false;
        let workingStaffCount = 0;
        let offStaffCount = 0;
        let timesheetCount = 0;

        // Đọc cấu hình Bắt buộc chấm công từ SystemConfig
        const requireAttendance = await isSystemConfigEnabled('CLINICAL_SCHEDULING_REQUIRE_ATTENDANCE', false);

        if (maKhoa) {
            // Nếu người dùng yêu cầu Nạp lại từ Bảng Chấm Công: Xóa dữ liệu điểm danh tạm đã lưu để nạp mới 100%
            if (reloadFromTimesheet) {
                await prisma.staffAttendance.deleteMany({
                    where: {
                        workDate: date,
                        staff: { ma_khoa: maKhoa }
                    }
                });
            }

            // Kiểm tra xem khoa đã có bản ghi điểm danh chính thức nào trong StaffAttendance cho ngày này chưa
            const todayAttendanceCount = await prisma.staffAttendance.count({
                where: {
                    workDate: date,
                    staff: { ma_khoa: maKhoa }
                }
            });

            // Lấy danh sách nhân viên thuộc khoa kèm theo điểm danh của ngày cụ thể,
            // ĐỒNG THỜI liên thông lấy cả Bảng Chấm Công (StaffAttendanceRecord), Bảng Trực (StaffDutyRecord) và CCHN (PracticingCertificate)
            const rawStaff = await prisma.staff.findMany({
                where: { ma_khoa: maKhoa },
                include: {
                    trinh_do_ref: true,
                    chuc_danh_ref: true,
                    certificates: {
                        where: { isActive: true },
                        select: { id: true, so_cchn: true }
                    },
                    attendances: {
                        where: { workDate: date },
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

            // Đếm số lượng nhân sự đã thực sự có công bên Bảng Chấm Công hoặc Bảng Trực
            rawStaff.forEach(staff => {
                const attRec = staff.attendanceRecords?.[0];
                const dutyRec = staff.dutyRecords?.[0];
                if ((attRec?.code && attRec.code.trim() !== '') || (dutyRec?.dutyCode && dutyRec.dutyCode.trim() !== '')) {
                    timesheetCount++;
                }
            });

            // Nếu reloadFromTimesheet hoặc chưa có bản ghi, chưa xác nhận
            // Nếu requireAttendance bật, chỉ coi là đã chốt nếu bên chấm công ĐÃ CÓ DỮ LIỆU
            if (requireAttendance) {
                hasConfirmedAttendance = !reloadFromTimesheet && todayAttendanceCount > 0 && timesheetCount > 0;
            } else {
                hasConfirmedAttendance = !reloadFromTimesheet && todayAttendanceCount > 0;
            }

            // Format lại dữ liệu cho Frontend dễ dùng
            staffList = rawStaff.map(staff => {
                const latestAttendance = staff.attendances[0];
                const isToday = latestAttendance?.workDate === date;
                const attRec = staff.attendanceRecords?.[0];
                const dutyRec = staff.dutyRecords?.[0];

                const hasCCHN = !!(staff.certificates && staff.certificates.length > 0);
                const soCCHN = hasCCHN ? (staff.certificates[0]?.so_cchn || '') : '';

                let finalStatusId: string | null = null;
                let finalDvkt: boolean = false;

                // Nếu đã có điểm danh trước đó và KHÔNG phải là reload từ chấm công:
                if (!reloadFromTimesheet && isToday && latestAttendance?.statusId) {
                    finalStatusId = latestAttendance.statusId;
                    finalDvkt = hasCCHN ? latestAttendance.is_thuc_hien_dvkt : false;
                } else {
                    // Nạp trực tiếp từ Bảng Trực hoặc Bảng Chấm Công (Source of Truth)
                    if (dutyRec?.dutyCode && dutyRec.dutyCode.trim() !== '') {
                        finalStatusId = statusMap['TRUC'] || null;
                        finalDvkt = hasCCHN;
                    } else if (attRec?.code && attRec.code.trim() !== '') {
                        const c = attRec.code.trim().toUpperCase();
                        if (c === 'X' || c === '+') {
                            finalStatusId = statusMap['DI_LAM'] || null;
                            finalDvkt = hasCCHN;
                        } else if (c === 'NB/2') {
                            finalStatusId = statusMap['NGHI_BU_NUA_NGAY'] || null;
                            finalDvkt = hasCCHN;
                        } else if (c === 'P/2') {
                            finalStatusId = statusMap['NGHI_PHEP_NUA_NGAY'] || null;
                            finalDvkt = hasCCHN;
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
                        } else {
                            finalStatusId = null;
                            finalDvkt = false;
                        }
                    } else {
                        // CHƯA ĐƯỢC CHẤM CÔNG BÊN BẢNG CHẤM CÔNG: ĐỂ TRỐNG HOÀN TOÀN!
                        finalStatusId = null;
                        finalDvkt = false;
                    }
                }

                // NGUYÊN TẮC BẮT BUỘC: Nếu không có CCHN thì TUYỆT ĐỐI không được làm DVKT
                if (!hasCCHN) {
                    finalDvkt = false;
                }

                if (finalDvkt) {
                    workingStaffCount++;
                } else {
                    offStaffCount++;
                }

                return {
                    id: staff.id,
                    ma_nv: staff.ma_nv,
                    ho_ten: staff.ho_ten,
                    chuc_danh: staff.chuc_danh_ref?.name || staff.chuc_danh_ref?.code || '',
                    trinh_do: staff.trinh_do_ref?.name || staff.trinh_do_ref?.code || '',
                    statusId: finalStatusId,
                    is_thuc_hien_dvkt: finalDvkt,
                    hasCCHN: hasCCHN,
                    so_cchn: soCCHN,
                    attendanceId: isToday ? (latestAttendance?.id || null) : null
                };
            });
        }

        return NextResponse.json({
            success: true,
            departments,
            attendanceStatuses,
            staffList,
            requireAttendance,
            hasConfirmedAttendance,
            hasTimesheetData: timesheetCount > 0,
            timesheetCount,
            totalStaff: staffList.length,
            workingStaffCount,
            offStaffCount
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Lấy danh sách ID các nhân sự có CCHN còn hoạt động để kiểm soát quyền DVKT
        const allCerts = await prisma.practicingCertificate.findMany({
            where: { isActive: true },
            select: { staffId: true }
        });
        const staffWithCertSet = new Set(allCerts.map(c => c.staffId));

        // 1. XỬ LÝ XÁC NHẬN ĐIỂM DANH HÀNG LOẠT (BULK CONFIRM CHO CẢ KHOA)
        if (body.bulkConfirm && Array.isArray(body.staffList)) {
            const { date, staffList } = body;
            if (!date || staffList.length === 0) {
                return NextResponse.json({ success: false, message: 'Dữ liệu không hợp lệ' }, { status: 400 });
            }

            // Nếu đang bật cấu hình bắt buộc chấm công: BẮT BUỘC phải có dữ liệu chấm công, không cho phép xác nhận khi toàn bộ statusId là null
            const requireAttendance = await isSystemConfigEnabled('CLINICAL_SCHEDULING_REQUIRE_ATTENDANCE', false);
            if (requireAttendance) {
                const hasAnyValidStatus = staffList.some((item: any) => !!item.statusId);
                if (!hasAnyValidStatus) {
                    return NextResponse.json({
                        success: false,
                        message: 'Bảng Chấm Công ngày này chưa có dữ liệu. Vui lòng thực hiện chấm công tại Bảng Chấm Công trước khi xác nhận điểm danh!'
                    }, { status: 400 });
                }
            }

            for (const item of staffList) {
                if (!item.staffId) continue;
                // Nếu không có CCHN thì TUYỆT ĐỐI không được bật DVKT
                const hasCert = staffWithCertSet.has(item.staffId);
                const safeDvkt = hasCert ? (item.is_thuc_hien_dvkt !== false) : false;

                await prisma.staffAttendance.upsert({
                    where: {
                        staffId_workDate: {
                            staffId: item.staffId,
                            workDate: date
                        }
                    },
                    update: {
                        statusId: item.statusId !== undefined ? item.statusId : undefined,
                        is_thuc_hien_dvkt: safeDvkt
                    },
                    create: {
                        staffId: item.staffId,
                        workDate: date,
                        statusId: item.statusId || null,
                        is_thuc_hien_dvkt: safeDvkt
                    }
                });
            }

            return NextResponse.json({
                success: true,
                message: `Đã xác nhận điểm danh thành công cho ${staffList.length} nhân sự ngày ${date}`
            });
        }

        // 2. XỬ LÝ CẬP NHẬT TỪNG NHÂN VIÊN
        const { date, staffId, statusId, is_thuc_hien_dvkt } = body;

        if (!date || !staffId) {
            return NextResponse.json({ success: false, message: 'Dữ liệu không hợp lệ' }, { status: 400 });
        }

        const hasCert = staffWithCertSet.has(staffId);
        const safeDvkt = hasCert ? (is_thuc_hien_dvkt !== undefined ? is_thuc_hien_dvkt : true) : false;

        const attendance = await prisma.staffAttendance.upsert({
            where: {
                staffId_workDate: {
                    staffId: staffId,
                    workDate: date
                }
            },
            update: {
                statusId: statusId !== undefined ? statusId : undefined,
                is_thuc_hien_dvkt: safeDvkt
            },
            create: {
                staffId: staffId,
                workDate: date,
                statusId: statusId || null,
                is_thuc_hien_dvkt: safeDvkt
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
