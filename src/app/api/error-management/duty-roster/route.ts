import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendZaloGroupNotification } from '@/lib/zalo';
import { getCurrentHospitalShift, getVietnamTimeParts, HospitalShiftConfig, getActiveDutyDate, isHalfDayWorkingNow } from '@/lib/shiftUtils';

// Lấy danh sách nhân viên CNTT
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const targetDepartment = searchParams.get('targetDepartment') || 'CNTT';
        const userId = searchParams.get('userId');

        let avatarMap = new Map<string, string>();
        try {
            const avatarRows: any = await prisma.$queryRawUnsafe('SELECT id, avatar FROM "User"');
            if (Array.isArray(avatarRows)) {
                avatarRows.forEach((r: any) => {
                    if (r.id && r.avatar) avatarMap.set(r.id, r.avatar);
                });
            }
        } catch (e) {
            console.warn('Lỗi đọc avatar trong duty-roster:', e);
        }

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { role: targetDepartment },
                    ...(userId ? [{ id: userId }] : [])
                ]
            },
            orderBy: {
                dutyOrder: 'asc'
            },
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                ma_khoa: true,
                isAvailable: true,
                dutyOrder: true,
                autoAssignDisabled: true,
                focusReason: true,
                staffId: true,
                staff: {
                    select: {
                        ho_ten: true,
                        so_dien_thoai: true,
                        chuc_vu_ref: true,
                        ma_khoa: true
                    }
                }
            }
        });

        // Tự động đối chiếu và đồng bộ trạng thái nhận việc theo Cấu hình Khung giờ & Chấm công toàn viện
        try {
            let slug = 'it-request-fields-config';
            if (targetDepartment === 'VTYT') slug = 'vtyt-request-fields-config';
            else if (targetDepartment === 'HCQT') slug = 'hcqt-request-fields-config';

            // 1. Đọc cấu hình phòng ban & cấu hình chấm công toàn viện
            const [configRule, hospitalConfigRule] = await Promise.all([
                prisma.specializedRule.findUnique({ where: { slug } }),
                prisma.specializedRule.findUnique({ where: { slug: 'hospital-attendance-config' } })
            ]);

            const itConfig: any = configRule?.logicConfig || {};
            const hospitalConfig: any = hospitalConfigRule?.logicConfig || {};
            const workHours = hospitalConfig.workHours || {};

            const syncAttendanceEnabled = itConfig.syncAttendanceEnabled !== false;
            // Mặc định KHÔNG tự động bật nhận việc cho Lãnh đạo (Trưởng/Phó phòng), chỉ bật khi cấu hình rõ ràng là true
            const applyForLeaders = itConfig.applyForLeaders === true;
            const autoDisableOnLeave = itConfig.autoDisableOnLeave !== false;

            // 2. Lấy khung giờ: ƯU TIÊN LẤY TỪ CẤU HÌNH TOÀN VIỆN (hospital-attendance-config)
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

            // 3. Xác định ca làm việc theo giờ thực tế Việt Nam (GMT+7)
            const shiftInfo = getCurrentHospitalShift(shiftConfig);
            const isOfficeHours = shiftInfo.isOfficeHours;
            const vnTime = getVietnamTimeParts();
            const todayStr = vnTime.dateStr;

            // Ca trực 24h: Từ 07:00 hôm trước đến 07:00 hôm sau
            const activeDutyDate = getActiveDutyDate(new Date(), morningStart);

            if (syncAttendanceEnabled) {
                for (const u of users) {
                    if (u.staffId) {
                        // Trạng thái nhận việc chỉ áp dụng riêng cho CNTT, VTYT, HCQT
                        const isSupportDept = ['KP046', 'KP038', 'KP040'].includes(u.ma_khoa || u.staff?.ma_khoa || '') || ['CNTT', 'VTYT', 'HCQT'].includes(u.role);
                        if (!isSupportDept) continue;

                        const [todayAtt, activeDuty] = await Promise.all([
                            prisma.staffAttendanceRecord.findFirst({
                                where: {
                                    staffId: u.staffId,
                                    workDate: todayStr
                                }
                            }),
                            prisma.staffDutyRecord.findFirst({
                                where: {
                                    staffId: u.staffId,
                                    dutyDate: activeDutyDate
                                }
                            })
                        ]);

                        const cleanCode = (todayAtt?.code || '').trim().toUpperCase();
                        const isFullDayLeave = ['P', 'O', 'CO', 'NB', 'K', 'RO', 'TS', 'H', 'KL'].includes(cleanCode);
                        const isHalfDayLeave = ['NB/2', 'P/2'].includes(cleanCode);
                        const isWorkingFullDay = ['X', '+'].includes(cleanCode);

                        // Có lịch trực trong ca 24h đang chạy (Lưu ý: Không dùng dutyRecordId trên chấm công vì đó là ca quá khứ được nghỉ bù)
                        const hasDutyNow = !isFullDayLeave && Boolean(activeDuty || cleanCode === 'T' || cleanCode.startsWith('T/'));

                        const explicitLevel = (u.staff?.chuc_vu_ref as any)?.level;
                        const cvCode = (u.staff?.chuc_vu_ref?.code || '').toUpperCase();
                        const cvName = (u.staff?.chuc_vu_ref?.name || '').toLowerCase();

                        // 1. Tổ trưởng (Level 2.1): Là lực lượng kỹ thuật tác chiến, nhận việc bình thường
                        const isTeamLeader = Boolean(
                            explicitLevel === 'LEVEL_2_1_TEAM_LEADER' || 
                            explicitLevel === 'LEVEL_2.1' || 
                            cvCode === 'TO_TRUONG' || 
                            cvCode.includes('TO_TRUONG') || 
                            cvName.includes('tổ trưởng')
                        );

                        // 2. Lãnh đạo quản lý Khoa/Phòng: Mặc định không tự động nhận việc
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

                        // Tính toán trạng thái nhận việc tiếp theo
                        let nextIsAvailable = false;

                        if (isFullDayLeave) {
                            // Nghỉ cả ngày (Nb, P, Ố, TS, KL...): Bắt buộc TẮT nhận việc
                            nextIsAvailable = false;
                        } else if (isHalfDayLeave) {
                            // Nghỉ nửa ngày (Nb/2, P/2): Kiểm tra xem thời điểm hiện tại có đang trong buổi đi làm không
                            const isWorkingNow = isHalfDayWorkingNow(todayAtt?.session, shiftInfo.shiftType);
                            if (isOfficeHours && isWorkingNow) {
                                nextIsAvailable = !isLeader || applyForLeaders;
                            } else {
                                // Ngoài giờ hành chính: chỉ bật nếu có ca trực 24h đang chạy
                                nextIsAvailable = hasDutyNow && (!isLeader || applyForLeaders);
                            }
                        } else if (isWorkingFullDay) {
                            // Đi làm cả ngày (+ hoặc x):
                            if (isOfficeHours) {
                                nextIsAvailable = !isLeader || applyForLeaders;
                            } else {
                                // Ngoài giờ hành chính (trưa, tối/đêm, cuối tuần/nghỉ lễ): chỉ bật nếu có ca trực
                                nextIsAvailable = hasDutyNow && (!isLeader || applyForLeaders);
                            }
                        } else {
                            // Các trường hợp khác:
                            if (hasDutyNow) {
                                nextIsAvailable = !isLeader || applyForLeaders;
                            } else if (isOfficeHours && !autoDisableOnLeave) {
                                nextIsAvailable = u.isAvailable;
                            } else {
                                nextIsAvailable = false;
                            }
                        }

                        if (u.isAvailable !== nextIsAvailable) {
                            await prisma.user.update({
                                where: { id: u.id },
                                data: { isAvailable: nextIsAvailable }
                            });
                            u.isAvailable = nextIsAvailable;
                        }
                    }
                }
            }
        } catch (eSync) {
            console.error('Lỗi tự động đồng bộ duty-roster với bảng chấm công & cấu hình toàn viện:', eSync);
        }

        const formatted = users.map(u => {
            const explicitLevel = (u.staff?.chuc_vu_ref as any)?.level;
            const cvCode = (u.staff?.chuc_vu_ref?.code || '').toUpperCase();
            const cvName = (u.staff?.chuc_vu_ref?.name || '').toLowerCase();

            // 1. Tổ trưởng (Level 2.1)
            const isTeamLeader = Boolean(
                explicitLevel === 'LEVEL_2_1_TEAM_LEADER' || 
                explicitLevel === 'LEVEL_2.1' || 
                cvCode === 'TO_TRUONG' || 
                cvCode.includes('TO_TRUONG') || 
                cvName.includes('tổ trưởng')
            );

            // 2. Lãnh đạo Khoa/Phòng (Level 1, Level 2)
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

            return {
                id: u.id,
                username: u.username,
                name: u.name || u.staff?.ho_ten || u.username,
                avatar: avatarMap.get(u.id) || null,
                role: u.role,
                isAvailable: u.isAvailable,
                dutyOrder: u.dutyOrder,
                autoAssignDisabled: u.autoAssignDisabled,
                focusReason: u.focusReason,
                isLeader,
                isTeamLeader,
                phone: u.staff?.so_dien_thoai || null,
                chuc_vu: u.staff?.chuc_vu_ref?.name || (isLeader ? 'Lãnh đạo' : (isTeamLeader ? 'Tổ trưởng' : 'Kỹ thuật viên'))
            };
        });

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('Error fetching duty roster:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Cập nhật trạng thái trực và thứ tự
export async function PUT(request: Request) {
    try {
        const currentUser = await getCurrentUser();
        const body = await request.json();
        const { users, targetDepartment: reqDept } = body; // Mảng user: { id, isAvailable, dutyOrder, autoAssignDisabled, focusReason }

        if (!Array.isArray(users)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        // Thực hiện update hàng loạt bằng transaction
        const updates = users.map(user => 
            prisma.user.update({
                where: { id: user.id },
                data: {
                    ...(user.isAvailable !== undefined && { isAvailable: user.isAvailable }),
                    ...(user.dutyOrder !== undefined && { dutyOrder: user.dutyOrder }),
                    ...(user.autoAssignDisabled !== undefined && { autoAssignDisabled: user.autoAssignDisabled }),
                    ...(user.focusReason !== undefined && { focusReason: user.focusReason })
                }
            })
        );

        await prisma.$transaction(updates);

        // Xác định phòng ban mục tiêu
        let targetDepartment = reqDept;
        if (!targetDepartment) {
            if (currentUser?.role === 'VTYT') targetDepartment = 'VTYT';
            else if (currentUser?.role === 'HCQT') targetDepartment = 'HCQT';
            else targetDepartment = 'CNTT';
        }

        // Kiểm tra xem thao tác vừa rồi có phải tắt nhận việc hoặc bật chế độ tập trung không
        const isDisablingAvailability = users.some(u => u.isAvailable === false || u.autoAssignDisabled === true);

        let allStaffOff = false;
        let warningMessage: string | null = null;

        if (isDisablingAvailability) {
            // Đếm số lượng nhân viên còn lại trong phòng ban đang SẴN SÀNG NHẬN VIỆC
            const activeStaffCount = await prisma.user.count({
                where: {
                    role: targetDepartment,
                    isActive: true,
                    isAvailable: true,
                    autoAssignDisabled: false
                }
            });

            // Nếu không còn ai bật nhận việc (tất cả đều OFF hoặc tập trung việc riêng)
            if (activeStaffCount === 0) {
                allStaffOff = true;
                warningMessage = `⚠️ CẢNH BÁO: Hiện tại phòng ${targetDepartment} KHÔNG CÒN nhân viên nào đang bật nhận việc! Hệ thống đã gửi cảnh báo khẩn cấp lên nhóm Telegram.`;

                // Đọc cấu hình Telegram / Zalo của phòng ban
                let slug = 'it-request-fields-config';
                if (targetDepartment === 'VTYT') slug = 'vtyt-request-fields-config';
                else if (targetDepartment === 'HCQT') slug = 'hcqt-request-fields-config';

                try {
                    const configRule = await prisma.specializedRule.findUnique({ where: { slug } });
                    const config: any = configRule?.logicConfig || {};

                    const targetBotToken = config.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
                    const targetChatId = config.telegramChatId || process.env.TELEGRAM_CHAT_ID;

                    const userAny = currentUser as any;
                    const operatorName = userAny?.name || userAny?.username || 'Nhân viên';
                    const operatorTag = userAny?.telegram_id ? (userAny.telegram_id.startsWith('@') ? ` (${userAny.telegram_id})` : '') : '';

                    const nowStr = new Intl.DateTimeFormat('vi-VN', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    }).format(new Date());

                    const origin = process.env.APP_URL || request.headers.get('origin') || 'http://localhost:3000';
                    const dutyUrl = `${origin}/htqlbenhvien/error-management/it-requests`;

                    // Soạn thông điệp Telegram cảnh báo
                    const telegramMsg = `🚨 <b>[CẢNH BÁO KHẨN: ${targetDepartment} KHÔNG CÒN AI NHẬN VIỆC]</b> 🚨\n\n` +
                        `⚠️ <b>Tình trạng:</b> Tất cả nhân viên phòng <b>${targetDepartment}</b> hiện đều đang <b>TẮT nhận việc</b> hoặc bật Chế độ tập trung!\n` +
                        `👤 <b>Nhân viên vừa tắt:</b> ${operatorName}${operatorTag}\n` +
                        `⏰ <b>Thời gian:</b> ${nowStr}\n\n` +
                        `👉 <b>Lưu ý khẩn:</b> Các sự cố, yêu cầu mới từ các Khoa/Phòng gửi lên sẽ <b>KHÔNG CÓ NGƯỜI TIẾP NHẬN</b>.\n` +
                        `Đề nghị kỹ thuật viên có ca trực kiểm tra và <b>BẬT NHẬN VIỆC</b> ngay!\n\n` +
                        `🔗 <a href="${dutyUrl}">👉 Bấm vào đây để mở hệ thống & bật nhận việc</a>`;

                    const replyMarkup = {
                        inline_keyboard: [
                            [
                                { text: '⚡ Mở xử lý & Bật nhận việc', url: dutyUrl }
                            ]
                        ]
                    };

                    // Gửi Telegram
                    if (targetBotToken && targetChatId) {
                        await sendTelegramMessage(telegramMsg, targetChatId, targetBotToken, replyMarkup);
                    }

                    // Gửi Zalo nếu có cấu hình
                    if (config.zaloEnabled && config.zaloWebhookUrl) {
                        await sendZaloGroupNotification(config.zaloWebhookUrl, {
                            title: `🚨 [CẢNH BÁO: ${targetDepartment} KHÔNG CÒN AI NHẬN VIỆC]`,
                            department: targetDepartment,
                            senderName: operatorName,
                            content: `⚠️ CẢNH BÁO: Tất cả nhân viên ${targetDepartment} hiện đều đang TẮT nhận việc! Đề nghị kỹ thuật viên trực ban BẬT nhận việc ngay để hỗ trợ các Khoa/Phòng.`,
                            ticketUrl: dutyUrl,
                            priority: 'URGENT'
                        });
                    }
                } catch (notifyErr) {
                    console.error('Lỗi gửi thông báo Telegram/Zalo khi tất cả nhân viên OFF:', notifyErr);
                }
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Cập nhật ca trực thành công!',
            allStaffOff,
            warningMessage
        });
    } catch (error) {
        console.error('Error updating duty roster:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

