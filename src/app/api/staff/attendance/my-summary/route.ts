import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

export async function GET(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        const defaultMonthYear = `${currentYear}-${currentMonth}`;

        const monthYear = searchParams.get('monthYear') || defaultMonthYear;
        // Cho phép quản trị viên xem hộ nhân viên khác nếu truyền staffId
        const targetStaffId = searchParams.get('staffId') || user.staffId;

        if (!targetStaffId) {
            return NextResponse.json({
                error: 'Tài khoản của bạn chưa được liên kết với hồ sơ nhân sự (staffId). Vui lòng liên hệ quản trị viên!'
            }, { status: 400 });
        }

        const staff = await prisma.staff.findUnique({
            where: { id: targetStaffId },
            include: {
                department: true,
                chuc_vu_ref: true,
                chuc_danh_ref: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        isAvailable: true,
                        autoAssignDisabled: true
                    }
                }
            }
        });

        if (!staff) {
            return NextResponse.json({ error: 'Không tìm thấy thông tin cán bộ' }, { status: 404 });
        }

        const [yearStr, monthStr] = monthYear.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const daysInMonth = new Date(year, month, 0).getDate();

        const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        // Lấy lịch sử công trong tháng
        const attendanceRecords = await prisma.staffAttendanceRecord.findMany({
            where: {
                staffId: targetStaffId,
                workDate: {
                    gte: startDateStr,
                    lte: endDateStr
                }
            },
            include: {
                dutyRecord: {
                    select: {
                        dutyDate: true,
                        dutyCode: true,
                        allowanceDays: true
                    }
                }
            },
            orderBy: { workDate: 'asc' }
        });

        // Lấy lịch sử trực trong tháng
        const dutyRecords = await prisma.staffDutyRecord.findMany({
            where: {
                staffId: targetStaffId,
                dutyDate: {
                    gte: startDateStr,
                    lte: endDateStr
                }
            },
            include: {
                compensations: {
                    select: {
                        workDate: true,
                        session: true,
                        value: true,
                        code: true
                    }
                }
            },
            orderBy: { dutyDate: 'asc' }
        });

        // Lấy TẤT CẢ các ca trực còn dư quỹ ngày nghỉ bù (kể cả các tháng trước chưa nghỉ bù hết)
        const pendingDuties = await prisma.staffDutyRecord.findMany({
            where: {
                staffId: targetStaffId,
                isFullyCompensated: false
            },
            include: {
                compensations: {
                    select: {
                        workDate: true,
                        session: true,
                        value: true
                    }
                }
            },
            orderBy: { dutyDate: 'desc' }
        });

        const activeDutiesQuota = pendingDuties.map(d => {
            const allowance = d.allowanceDays || 1.0;
            const comp = d.compensatedDays || 0.0;
            return {
                id: d.id,
                dutyDate: d.dutyDate,
                dutyCode: d.dutyCode,
                dutyType: d.dutyType,
                allowanceDays: allowance,
                compensatedDays: comp,
                remainingDays: Math.max(0, allowance - comp),
                compensations: d.compensations
            };
        }).filter(d => d.remainingDays > 0);

        // Tổng kết KPI cá nhân trong tháng
        let luongThoiGian = 0;
        let nghiKhongLuong = 0;
        let huongBHXH = 0;
        let soNgayNghiBu = 0;

        attendanceRecords.forEach(att => {
            const c = (att.code || '').trim().toUpperCase();
            const sec = (att.secondaryCode || '').trim().toUpperCase();

            if (['X', '+', 'P', 'L', 'H'].includes(c)) {
                luongThoiGian += (att.value ?? 1.0);
            } else if (c === 'X/2' || c === '+/2') {
                luongThoiGian += (att.value ?? 0.5);
            } else if (c === 'P/2') {
                luongThoiGian += 1.0;
            } else if (c === 'NB') {
                luongThoiGian += (att.value ?? 1.0);
                soNgayNghiBu += (att.session === 'FULL_DAY' ? 1.0 : 0.5);
                if (sec === 'X' || sec === '+') {
                    luongThoiGian += 0.5;
                }
            } else if (c === 'NB/2') {
                luongThoiGian += 1.0;
                soNgayNghiBu += 0.5;
            } else if (c === 'KL') {
                nghiKhongLuong += (att.value ?? 1.0);
            } else if (['Ô', 'O', 'TS'].includes(c)) {
                huongBHXH += (att.value ?? 1.0);
            }
        });

        let dutyNgayThuong = 0;
        let dutyT7CN = 0;
        let dutyLeTet = 0;

        dutyRecords.forEach(d => {
            const c = (d.dutyCode || '').trim().toUpperCase();
            if (c === 'T') dutyNgayThuong += 1;
            else if (c === 'C') dutyT7CN += 1;
            else if (c === 'L' || c === 'TE') dutyLeTet += 1;
        });

        // Map theo ngày trong tháng
        const dailyMap: Record<number, any> = {};
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month - 1, d);
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const att = attendanceRecords.find(a => a.workDate === dateStr);
            const duty = dutyRecords.find(dt => dt.dutyDate === dateStr);

            dailyMap[d] = {
                day: d,
                dateStr,
                dayOfWeek: dateObj.getDay(),
                attendance: att || null,
                duty: duty || null
            };
        }

        return NextResponse.json({
            staff: {
                id: staff.id,
                ma_nv: staff.ma_nv,
                ho_ten: staff.ho_ten,
                so_dien_thoai: staff.so_dien_thoai,
                ten_khoa: staff.department?.ten_khoa || 'Phòng Công nghệ thông tin',
                chuc_vu: staff.chuc_vu_ref?.name || '',
                chuc_danh: staff.chuc_danh_ref?.name || '',
                isAvailable: staff.user?.isAvailable ?? false
            },
            monthYear,
            daysInMonth,
            dailyMap,
            activeDutiesQuota, // Quỹ các ca trực chưa nghỉ bù
            kpiSummary: {
                luongThoiGian,
                nghiKhongLuong,
                huongBHXH,
                soNgayNghiBu,
                tongCaTruc: dutyNgayThuong + dutyT7CN + dutyLeTet,
                dutyNgayThuong,
                dutyT7CN,
                dutyLeTet,
                tongQuayNghiBuConLai: activeDutiesQuota.reduce((acc, cur) => acc + cur.remainingDays, 0)
            }
        });
    } catch (error: any) {
        console.error('Error fetching personal attendance summary:', error);
        return NextResponse.json({ error: error.message || 'Lỗi khi tải dữ liệu cá nhân' }, { status: 500 });
    }
}
