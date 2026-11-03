import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

const CONFIG_SLUG = 'hospital-attendance-config';

// Helper lấy ngày hiện tại định dạng YYYY-MM-DD theo múi giờ Việt Nam
function getVietnamDateStr(date: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(date); // 'YYYY-MM-DD'
}

// Helper lấy giờ phút hiện tại dạng HH:mm theo múi giờ Việt Nam
function getVietnamTimeStr(date: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    return formatter.format(date); // 'HH:mm'
}

// Helper đổi 'HH:mm' thành số phút tính từ 00:00
function timeToMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

export async function GET(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        // Tìm Staff record
        let targetStaffId = user.staffId;
        if (!targetStaffId) {
            const foundStaff = await prisma.staff.findFirst({
                where: {
                    OR: [
                        { ma_nv: user.username },
                        { cccd: user.username },
                        { user: { id: user.id } }
                    ]
                }
            });
            if (foundStaff) targetStaffId = foundStaff.id;
        }

        if (!targetStaffId) {
            return NextResponse.json({
                error: 'Tài khoản chưa liên kết với hồ sơ nhân viên (staffId)'
            }, { status: 400 });
        }

        const staff = await prisma.staff.findUnique({
            where: { id: targetStaffId },
            include: { department: true }
        });

        if (!staff) {
            return NextResponse.json({ error: 'Không tìm thấy hồ sơ nhân viên' }, { status: 404 });
        }

        const todayStr = getVietnamDateStr();
        const currentTimeStr = getVietnamTimeStr();
        const currentMinutes = timeToMinutes(currentTimeStr);

        // Đọc cấu hình viện
        const configRule = await prisma.specializedRule.findUnique({
            where: { slug: CONFIG_SLUG }
        });
        const logicConfig: any = configRule?.logicConfig || {};

        const workHours = logicConfig.workHours || {
            morningStart: '07:00',
            morningEnd: '11:30',
            afternoonStart: '13:30',
            afternoonEnd: '17:00',
            standardDailyHours: 8.0
        };

        const checkInRules = logicConfig.checkInRules || {
            checkInWindowMinutes: 60,
            lateToleranceMinutes: 15,
            cutOffMinutes: 90,
            earlyLeaveToleranceMinutes: 15,
            checkOutWindowEndHour: '20:00',
            requireInternalNetwork: false,
            allowedSubnets: '',
            defaultMode: 'HYBRID'
        };

        // Cấu hình riêng cho khoa
        const deptConfigs = logicConfig.departmentConfigs || {};
        const myDeptConfig = deptConfigs[staff.ma_khoa] || {};
        const mode = myDeptConfig.mode || checkInRules.defaultMode || 'HYBRID';

        // Lấy log check-in hôm nay
        const todayLog = await prisma.staffAttendanceCheckLog.findUnique({
            where: {
                staffId_workDate: {
                    staffId: staff.id,
                    workDate: todayStr
                }
            }
        });

        // Lấy danh sách log tháng này (để hiển thị lịch sử gần nhất)
        const monthPrefix = todayStr.slice(0, 7);
        const monthlyLogs = await prisma.staffAttendanceCheckLog.findMany({
            where: {
                staffId: staff.id,
                workDate: { startsWith: monthPrefix }
            },
            orderBy: { workDate: 'desc' }
        });

        // Tính toán trạng thái cho phép bấm
        const morningStartMins = timeToMinutes(workHours.morningStart);
        const morningOpenMins = morningStartMins - (checkInRules.checkInWindowMinutes || 60);
        const morningCutOffMins = morningStartMins + (checkInRules.cutOffMinutes || 90);

        const afternoonEndMins = timeToMinutes(workHours.afternoonEnd);
        const checkOutStartMins = afternoonEndMins - (checkInRules.earlyLeaveToleranceMinutes || 15);
        const checkOutEndMins = timeToMinutes(checkInRules.checkOutWindowEndHour || '20:00');

        const isWebAllowed = mode === 'WEB_ONLY' || mode === 'HYBRID';
        const hasCheckedIn = Boolean(todayLog?.checkInTime);
        const hasCheckedOut = Boolean(todayLog?.checkOutTime);

        return NextResponse.json({
            success: true,
            today: todayStr,
            currentTime: currentTimeStr,
            staff: {
                id: staff.id,
                ho_ten: staff.ho_ten,
                ma_nv: staff.ma_nv,
                ma_khoa: staff.ma_khoa,
                ten_khoa: staff.department?.ten_khoa || ''
            },
            departmentMode: mode,
            zkDeviceId: myDeptConfig.zkDeviceId || null,
            isWebAllowed,
            workHours,
            checkInRules,
            todayLog,
            status: {
                hasCheckedIn,
                hasCheckedOut,
                canCheckIn: isWebAllowed && !hasCheckedIn && currentMinutes >= morningOpenMins,
                canCheckOut: isWebAllowed && hasCheckedIn && !hasCheckedOut && currentMinutes >= checkOutStartMins,
                isTooEarlyForCheckIn: currentMinutes < morningOpenMins,
                isPastCutOffForCheckIn: !hasCheckedIn && currentMinutes > morningCutOffMins,
                isEarlyForCheckOut: hasCheckedIn && !hasCheckedOut && currentMinutes < checkOutStartMins
            },
            monthlyLogs
        });
    } catch (error) {
        console.error('Lỗi lấy trạng thái tự chấm công:', error);
        return NextResponse.json({
            error: 'Đã xảy ra lỗi khi tải trạng thái chấm công'
        }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        // Tìm Staff record
        let targetStaffId = user.staffId;
        if (!targetStaffId) {
            const foundStaff = await prisma.staff.findFirst({
                where: {
                    OR: [
                        { ma_nv: user.username },
                        { cccd: user.username },
                        { user: { id: user.id } }
                    ]
                }
            });
            if (foundStaff) targetStaffId = foundStaff.id;
        }

        if (!targetStaffId) {
            return NextResponse.json({
                error: 'Tài khoản chưa liên kết với hồ sơ nhân viên (staffId). Vui lòng liên hệ quản trị viên!'
            }, { status: 400 });
        }

        const staff = await prisma.staff.findUnique({
            where: { id: targetStaffId },
            include: { department: true }
        });

        if (!staff) {
            return NextResponse.json({ error: 'Không tìm thấy hồ sơ cán bộ y tế' }, { status: 404 });
        }

        const body = await request.json();
        const { action, note } = body; // action: 'CHECK_IN' | 'CHECK_OUT'

        if (!action || !['CHECK_IN', 'CHECK_OUT'].includes(action)) {
            return NextResponse.json({ error: 'Thao tác không hợp lệ (cần CHECK_IN hoặc CHECK_OUT)' }, { status: 400 });
        }

        const todayStr = getVietnamDateStr();
        const currentTimeStr = getVietnamTimeStr();
        const currentMinutes = timeToMinutes(currentTimeStr);
        const now = new Date();

        // Đọc cấu hình
        const configRule = await prisma.specializedRule.findUnique({
            where: { slug: CONFIG_SLUG }
        });
        const logicConfig: any = configRule?.logicConfig || {};

        const workHours = logicConfig.workHours || {
            morningStart: '07:00',
            morningEnd: '11:30',
            afternoonStart: '13:30',
            afternoonEnd: '17:00',
            standardDailyHours: 8.0
        };

        const checkInRules = logicConfig.checkInRules || {
            checkInWindowMinutes: 60,
            lateToleranceMinutes: 15,
            cutOffMinutes: 90,
            earlyLeaveToleranceMinutes: 15,
            checkOutWindowEndHour: '20:00',
            requireInternalNetwork: false,
            allowedSubnets: '',
            defaultMode: 'HYBRID'
        };

        const deptConfigs = logicConfig.departmentConfigs || {};
        const myDeptConfig = deptConfigs[staff.ma_khoa] || {};
        const mode = myDeptConfig.mode || checkInRules.defaultMode || 'HYBRID';

        // 1. Kiểm tra hình thức cho phép của khoa
        if (mode === 'BIOMETRIC_ONLY') {
            return NextResponse.json({
                error: `Khoa/Phòng "${staff.department?.ten_khoa || staff.ma_khoa}" quy định chỉ chấm công qua Máy vân tay ZKTeco. Vui lòng chấm công trực tiếp tại máy!`
            }, { status: 403 });
        }

        if (mode === 'MANUAL') {
            return NextResponse.json({
                error: `Khoa/Phòng "${staff.department?.ten_khoa || staff.ma_khoa}" áp dụng chấm công thủ công do Quản lý khoa thực hiện. Không hỗ trợ tự chấm công!`
            }, { status: 403 });
        }

        // 2. Lấy IP client & kiểm tra mạng nếu có cấu hình
        const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                         request.headers.get('x-real-ip') || 
                         '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'Browser Web Client';

        if (checkInRules.requireInternalNetwork && checkInRules.allowedSubnets) {
            const allowed = checkInRules.allowedSubnets.split(',').map((s: string) => s.trim()).filter(Boolean);
            const isMatch = allowed.some((prefix: string) => clientIp.startsWith(prefix) || clientIp === '127.0.0.1');
            if (!isMatch) {
                return NextResponse.json({
                    error: `Địa chỉ IP (${clientIp}) không thuộc mạng nội bộ bệnh viện được phép chấm công!`
                }, { status: 403 });
            }
        }

        // Lấy log hôm nay
        let existingLog = await prisma.staffAttendanceCheckLog.findUnique({
            where: {
                staffId_workDate: {
                    staffId: staff.id,
                    workDate: todayStr
                }
            }
        });

        const morningStartMins = timeToMinutes(workHours.morningStart);
        const lateToleranceMins = morningStartMins + (checkInRules.lateToleranceMinutes || 15);
        const morningOpenMins = morningStartMins - (checkInRules.checkInWindowMinutes || 60);
        const afternoonEndMins = timeToMinutes(workHours.afternoonEnd);
        const earlyLeaveLimitMins = afternoonEndMins - (checkInRules.earlyLeaveToleranceMinutes || 15);

        if (action === 'CHECK_IN') {
            if (existingLog?.checkInTime) {
                return NextResponse.json({
                    error: `Bạn đã bấm Vào ca hôm nay lúc ${getVietnamTimeStr(existingLog.checkInTime)}. Không thể bấm lại!`
                }, { status: 400 });
            }

            if (currentMinutes < morningOpenMins) {
                return NextResponse.json({
                    error: `Chưa đến khung giờ mở ca làm việc (Khung giờ bắt đầu mở từ ${Math.floor(morningOpenMins / 60).toString().padStart(2, '0')}:${(morningOpenMins % 60).toString().padStart(2, '0')}).`
                }, { status: 400 });
            }

            // Tính số phút đi muộn (nếu vượt quá dung sai)
            let lateMinutes = 0;
            let status = 'ON_TIME';
            if (currentMinutes > lateToleranceMins) {
                lateMinutes = currentMinutes - morningStartMins;
                status = 'LATE';
            }

            // Lưu log check-in
            const savedLog = await prisma.staffAttendanceCheckLog.upsert({
                where: {
                    staffId_workDate: {
                        staffId: staff.id,
                        workDate: todayStr
                    }
                },
                update: {
                    checkInTime: now,
                    checkInMethod: 'WEB_BUTTON',
                    checkInIp: clientIp,
                    checkInDevice: userAgent.slice(0, 190),
                    status,
                    lateMinutes,
                    note: note ? note.trim() : existingLog?.note
                },
                create: {
                    staffId: staff.id,
                    ma_khoa: staff.ma_khoa,
                    workDate: todayStr,
                    checkInTime: now,
                    checkInMethod: 'WEB_BUTTON',
                    checkInIp: clientIp,
                    checkInDevice: userAgent.slice(0, 190),
                    status,
                    lateMinutes,
                    note: note ? note.trim() : null
                }
            });

            // Đồng bộ sang bảng chấm công toàn khoa: Đánh dấu ngày công '+' theo quy định
            const attendanceCode = '+';
            await prisma.staffAttendanceRecord.upsert({
                where: {
                    staffId_workDate_session: {
                        staffId: staff.id,
                        workDate: todayStr,
                        session: 'FULL_DAY'
                    }
                },
                update: {
                    code: attendanceCode,
                    value: 1.0,
                    updatedBy: 'Tự chấm công'
                },
                create: {
                    staffId: staff.id,
                    ma_khoa: staff.ma_khoa,
                    workDate: todayStr,
                    session: 'FULL_DAY',
                    code: attendanceCode,
                    value: 1.0,
                    updatedBy: 'Tự chấm công'
                }
            });

            // Nếu người dùng có User liên kết và thuộc nhóm hỗ trợ nhận việc, tự động bật isAvailable = true
            try {
                const itRule = await prisma.specializedRule.findUnique({
                    where: { slug: 'it-request-fields-config' }
                });
                const itLogic: any = itRule?.logicConfig || {};
                if (itLogic.syncAttendanceEnabled !== false) {
                    await prisma.user.updateMany({
                        where: {
                            OR: [
                                { id: user.id },
                                { username: user.username },
                                { username: staff.ma_nv }
                            ]
                        },
                        data: { isAvailable: true }
                    });
                }
            } catch (errSync) {
                console.error('Lỗi đồng bộ isAvailable khi check-in:', errSync);
            }

            return NextResponse.json({
                success: true,
                message: lateMinutes > 0 
                    ? `🟢 Vào ca thành công lúc ${currentTimeStr} (Đi muộn ${lateMinutes} phút)` 
                    : `🟢 Chúc mừng bạn đã Vào ca đúng giờ lúc ${currentTimeStr}!`,
                log: savedLog,
                status
            });
        }

        if (action === 'CHECK_OUT') {
            if (!existingLog?.checkInTime) {
                return NextResponse.json({
                    error: 'Bạn chưa bấm Vào ca sáng nay nên không thể bấm Tan ca. Vui lòng bấm Vào ca trước hoặc báo Trưởng khoa!'
                }, { status: 400 });
            }

            if (existingLog.checkOutTime) {
                return NextResponse.json({
                    error: `Bạn đã bấm Tan ca hôm nay lúc ${getVietnamTimeStr(existingLog.checkOutTime)}. Không thể bấm lại!`
                }, { status: 400 });
            }

            // Tính số phút về sớm
            let earlyMinutes = 0;
            let status = existingLog.status;
            if (currentMinutes < earlyLeaveLimitMins) {
                earlyMinutes = afternoonEndMins - currentMinutes;
                status = 'EARLY_LEAVE';
            }

            // Tính tổng số giờ làm việc
            const diffMs = now.getTime() - new Date(existingLog.checkInTime).getTime();
            const workHoursCalculated = Math.round((diffMs / 3600000) * 10) / 10;

            const savedLog = await prisma.staffAttendanceCheckLog.update({
                where: { id: existingLog.id },
                data: {
                    checkOutTime: now,
                    checkOutMethod: 'WEB_BUTTON',
                    checkOutIp: clientIp,
                    earlyMinutes,
                    workHours: workHoursCalculated,
                    status: status === 'LATE' ? 'LATE' : (earlyMinutes > 0 ? 'EARLY_LEAVE' : 'VALID'),
                    note: note ? (existingLog.note ? `${existingLog.note}; ${note.trim()}` : note.trim()) : existingLog.note
                }
            });

            return NextResponse.json({
                success: true,
                message: earlyMinutes > 0 
                    ? `🔴 Đã ghi nhận Tan ca lúc ${currentTimeStr} (Về sớm ${earlyMinutes} phút. Tổng: ${workHoursCalculated} giờ)` 
                    : `🔴 Tan ca thành công lúc ${currentTimeStr}! Chúc bạn có thời gian nghỉ ngơi vui vẻ. (Tổng làm: ${workHoursCalculated} giờ)`,
                log: savedLog
            });
        }

        return NextResponse.json({ error: 'Hành động không xác định' }, { status: 400 });
    } catch (error) {
        console.error('Lỗi thực hiện tự chấm công:', error);
        return NextResponse.json({
            error: 'Đã xảy ra lỗi khi ghi nhận chấm công'
        }, { status: 500 });
    }
}
