import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const CONFIG_SLUG = 'hospital-attendance-config';

// Helper lấy ngày định dạng YYYY-MM-DD theo múi giờ Việt Nam
function getVietnamDateStr(date: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(date);
}

// Helper lấy giờ phút HH:mm theo múi giờ Việt Nam
function getVietnamTimeStr(date: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    return formatter.format(date);
}

// Helper đổi 'HH:mm' thành số phút từ 00:00
function timeToMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

interface NormalizedLogEntry {
    enrollNumber: string;
    logTime: Date;
    workDate: string;
    timeMinutes: number;
    verifyType?: string;
    deviceId?: string;
}

/**
 * GET Handler: Phục vụ Handshake / Heartbeat Ping từ firmware ZKTeco ADMS
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sn = searchParams.get('SN') || searchParams.get('sn') || 'ZK-DEVICE';
        
        // Firmware ZKTeco gửi request GET kiểm tra server trước khi push log
        // Phản hồi text "OK" chuẩn ZKTeco
        return new NextResponse(`OK\nServerVersion=3.1.1\nServerName=BVDKLS-HRM\nPushVersion=2.4.1\n`, {
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    } catch (e) {
        return new NextResponse('OK', { status: 200 });
    }
}

/**
 * POST Handler: Tiếp nhận dữ liệu chấm công từ ZKTeco (Cả dạng JSON lẫn ADMS Raw Text)
 */
export async function POST(request: Request) {
    try {
        const url = new URL(request.url);
        const querySn = url.searchParams.get('SN') || url.searchParams.get('sn') || '';
        const contentType = request.headers.get('content-type') || '';
        
        let logsToProcess: NormalizedLogEntry[] = [];
        let isAdmsFormat = false;

        // 1. Nhận diện định dạng dữ liệu (JSON hoặc Raw ADMS Text)
        if (contentType.includes('application/json')) {
            const body = await request.json();
            const deviceId = body.deviceId || querySn || 'ZK-TERMINAL';

            if (Array.isArray(body.logs)) {
                for (const item of body.logs) {
                    if (item.enrollNumber && item.time) {
                        const d = new Date(item.time);
                        if (!isNaN(d.getTime())) {
                            const dateStr = getVietnamDateStr(d);
                            const timeStr = getVietnamTimeStr(d);
                            logsToProcess.push({
                                enrollNumber: String(item.enrollNumber).trim(),
                                logTime: d,
                                workDate: dateStr,
                                timeMinutes: timeToMinutes(timeStr),
                                verifyType: item.verifyType ? String(item.verifyType) : 'FINGERPRINT',
                                deviceId
                            });
                        }
                    }
                }
            } else if (body.enrollNumber && body.time) {
                const d = new Date(body.time);
                if (!isNaN(d.getTime())) {
                    const dateStr = getVietnamDateStr(d);
                    const timeStr = getVietnamTimeStr(d);
                    logsToProcess.push({
                        enrollNumber: String(body.enrollNumber).trim(),
                        logTime: d,
                        workDate: dateStr,
                        timeMinutes: timeToMinutes(timeStr),
                        verifyType: body.verifyType ? String(body.verifyType) : 'FINGERPRINT',
                        deviceId
                    });
                }
            }
        } else {
            // Định dạng ADMS Raw Text: Máy ZKTeco gửi nội dung dạng text từng dòng:
            // "PIN\tTime\tStatus\tVerify\n..."
            isAdmsFormat = true;
            const rawText = await request.text();
            const lines = rawText.split('\n');

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('CMD=') || trimmed.startsWith('table=')) continue;

                // Các trường phân cách bằng Tab (\t) hoặc dấu phẩy
                const parts = trimmed.includes('\t') ? trimmed.split('\t') : trimmed.split(',');
                if (parts.length >= 2) {
                    const pin = parts[0]?.trim();
                    const timeStrRaw = parts[1]?.trim();

                    if (pin && timeStrRaw) {
                        const d = new Date(timeStrRaw);
                        if (!isNaN(d.getTime())) {
                            const dateStr = getVietnamDateStr(d);
                            const timeStr = getVietnamTimeStr(d);
                            logsToProcess.push({
                                enrollNumber: pin,
                                logTime: d,
                                workDate: dateStr,
                                timeMinutes: timeToMinutes(timeStr),
                                verifyType: parts[3]?.trim() || 'FINGERPRINT',
                                deviceId: querySn || 'ZK-ADMS'
                            });
                        }
                    }
                }
            }
        }

        if (logsToProcess.length === 0) {
            if (isAdmsFormat) {
                return new NextResponse('OK: 0', { status: 200, headers: { 'Content-Type': 'text/plain' } });
            }
            return NextResponse.json({ success: true, message: 'Không có bản ghi hợp lệ', processedCount: 0 });
        }

        // 2. Đọc cấu hình giờ làm việc & dung sai toàn viện
        const configRule = await prisma.specializedRule.findUnique({
            where: { slug: CONFIG_SLUG }
        });
        const logicConfig: any = configRule?.logicConfig || {};

        const workHours = logicConfig.workHours || {
            morningStart: '07:00',
            morningEnd: '11:30',
            afternoonStart: '13:30',
            afternoonEnd: '17:00'
        };

        const checkInRules = logicConfig.checkInRules || {
            lateToleranceMinutes: 15,
            earlyLeaveToleranceMinutes: 15
        };

        const morningStartMins = timeToMinutes(workHours.morningStart);
        const lateLimitMins = morningStartMins + (checkInRules.lateToleranceMinutes || 15);
        const afternoonEndMins = timeToMinutes(workHours.afternoonEnd);
        const earlyLeaveLimitMins = afternoonEndMins - (checkInRules.earlyLeaveToleranceMinutes || 15);

        let successCount = 0;
        const processedResults = [];

        // 3. Xử lý từng bản ghi quẹt vân tay
        for (const log of logsToProcess) {
            try {
                const pin = log.enrollNumber;
                const pinWithoutBV = pin.toUpperCase().startsWith('BV') ? pin.slice(2) : pin;
                const pinWithBV = pin.toUpperCase().startsWith('BV') ? pin : `BV${pin}`;

                // Tìm nhân viên theo: ma_nv, cccd, hoặc số PIN
                const staff = await prisma.staff.findFirst({
                    where: {
                        OR: [
                            { ma_nv: { equals: pin, mode: 'insensitive' } },
                            { ma_nv: { equals: pinWithBV, mode: 'insensitive' } },
                            { ma_nv: { equals: pinWithoutBV, mode: 'insensitive' } },
                            { cccd: pin },
                            { user: { username: pin } }
                        ]
                    },
                    include: {
                        user: { select: { id: true, username: true } },
                        department: { select: { ma_khoa: true, ten_khoa: true } }
                    }
                });

                if (!staff) {
                    processedResults.push({
                        enrollNumber: pin,
                        status: 'SKIPPED_NOT_FOUND',
                        message: `Không tìm thấy nhân viên ứng với mã ${pin}`
                    });
                    continue;
                }

                // Lấy log chấm công của ngày đó
                const existingLog = await prisma.staffAttendanceCheckLog.findUnique({
                    where: {
                        staffId_workDate: {
                            staffId: staff.id,
                            workDate: log.workDate
                        }
                    }
                });

                if (!existingLog || !existingLog.checkInTime) {
                    // Lần đầu quẹt trong ngày -> Tính là VÀO CA (Check-in)
                    let lateMinutes = 0;
                    let status = 'ON_TIME';
                    if (log.timeMinutes > lateLimitMins) {
                        lateMinutes = log.timeMinutes - morningStartMins;
                        status = 'LATE';
                    }

                    await prisma.staffAttendanceCheckLog.upsert({
                        where: {
                            staffId_workDate: {
                                staffId: staff.id,
                                workDate: log.workDate
                            }
                        },
                        update: {
                            checkInTime: log.logTime,
                            checkInMethod: 'ZK_FINGERPRINT',
                            checkInDevice: log.deviceId,
                            status,
                            lateMinutes,
                            note: `Máy vân tay ZK (${log.deviceId || 'Khoa'})`
                        },
                        create: {
                            staffId: staff.id,
                            ma_khoa: staff.ma_khoa,
                            workDate: log.workDate,
                            checkInTime: log.logTime,
                            checkInMethod: 'ZK_FINGERPRINT',
                            checkInDevice: log.deviceId,
                            status,
                            lateMinutes,
                            note: `Máy vân tay ZK (${log.deviceId || 'Khoa'})`
                        }
                    });

                    // 4. Đồng bộ ngày công vào Bảng Chấm Công:
                    // YÊU CẦU: Ghi dấu '+' (thay vì 'x') theo yêu cầu của user
                    await prisma.staffAttendanceRecord.upsert({
                        where: {
                            staffId_workDate_session: {
                                staffId: staff.id,
                                workDate: log.workDate,
                                session: 'FULL_DAY'
                            }
                        },
                        update: {
                            code: '+', // Đổi dấu x thành + theo yêu cầu của user
                            value: 1.0,
                            updatedBy: 'ZKTeco Vân tay'
                        },
                        create: {
                            staffId: staff.id,
                            ma_khoa: staff.ma_khoa,
                            workDate: log.workDate,
                            session: 'FULL_DAY',
                            code: '+', // Đổi dấu x thành + theo yêu cầu của user
                            value: 1.0,
                            updatedBy: 'ZKTeco Vân tay'
                        }
                    });

                    // Tự động bật isAvailable = true cho tài khoản nhân viên tiếp nhận việc
                    if (staff.user) {
                        try {
                            await prisma.user.updateMany({
                                where: {
                                    OR: [
                                        { id: staff.user.id },
                                        { username: staff.user.username }
                                    ]
                                },
                                data: { isAvailable: true }
                            });
                        } catch (errSync) {
                            console.error('Lỗi sync isAvailable từ ZK:', errSync);
                        }
                    }

                    successCount++;
                    processedResults.push({
                        enrollNumber: pin,
                        staffName: staff.ho_ten,
                        action: 'CHECK_IN',
                        status
                    });
                } else {
                    // Đã có check-in trước đó. Kiểm tra xem có cách check-in > 30 phút không để tính là TAN CA
                    const diffMs = log.logTime.getTime() - new Date(existingLog.checkInTime).getTime();
                    if (diffMs >= 30 * 60 * 1000) {
                        // Tính số phút về sớm
                        let earlyMinutes = 0;
                        let status = existingLog.status;
                        if (log.timeMinutes < earlyLeaveLimitMins) {
                            earlyMinutes = afternoonEndMins - log.timeMinutes;
                            status = 'EARLY_LEAVE';
                        }

                        const workHoursCalc = Math.round((diffMs / 3600000) * 10) / 10;

                        await prisma.staffAttendanceCheckLog.update({
                            where: { id: existingLog.id },
                            data: {
                                checkOutTime: log.logTime,
                                checkOutMethod: 'ZK_FINGERPRINT',
                                earlyMinutes,
                                workHours: workHoursCalc,
                                status: status === 'LATE' ? 'LATE' : (earlyMinutes > 0 ? 'EARLY_LEAVE' : 'VALID'),
                                note: existingLog.note ? `${existingLog.note}; Ra vân tay ${log.deviceId || ''}` : `Ra vân tay ${log.deviceId || ''}`
                            }
                        });

                        successCount++;
                        processedResults.push({
                            enrollNumber: pin,
                            staffName: staff.ho_ten,
                            action: 'CHECK_OUT',
                            workHours: workHoursCalc
                        });
                    } else {
                        // Đã quẹt vào ca, lượt quẹt tiếp theo trong vòng 30 phút được ghi nhận an toàn
                        successCount++;
                        processedResults.push({
                            enrollNumber: pin,
                            staffName: staff.ho_ten,
                            action: 'ALREADY_CHECKED_IN',
                            message: `Cán bộ đã bấm Vào ca lúc ${getVietnamTimeStr(existingLog.checkInTime)}, ghi nhận lượt quẹt an toàn`
                        });
                    }
                }
            } catch (errLog: any) {
                console.error(`Lỗi xử lý bản ghi ZK cho pin ${log.enrollNumber}:`, errLog);
                processedResults.push({
                    enrollNumber: log.enrollNumber,
                    status: 'ERROR',
                    message: errLog?.message || 'Lỗi xử lý bản ghi'
                });
            }
        }

        // 5. Phản hồi cho máy ZKTeco hoặc bên thứ 3
        if (isAdmsFormat) {
            // Máy ZKTeco firmware yêu cầu phản hồi dạng "OK: [số bản ghi]"
            return new NextResponse(`OK: ${successCount}\n`, {
                status: 200,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        return NextResponse.json({
            success: true,
            message: `Đã xử lý thành công ${successCount}/${logsToProcess.length} lượt dập vân tay ZKTeco!`,
            processedCount: successCount,
            results: processedResults
        });
    } catch (error) {
        console.error('Lỗi nhận dữ liệu máy chấm công ZKTeco:', error);
        return new NextResponse('ERROR', { status: 500 });
    }
}
