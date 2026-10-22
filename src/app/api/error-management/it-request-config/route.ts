import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';
const CONFIG_SLUG = 'it-request-fields-config';
const RULE_TYPE = 'SYSTEM_CONFIG';

function normalizeErrors(rawErrors: any[]): Array<{ id: string; name: string; isVisible: boolean }> {
    if (!Array.isArray(rawErrors)) return [];
    const result: Array<{ id: string; name: string; isVisible: boolean }> = [];
    for (let idx = 0; idx < rawErrors.length; idx++) {
        const item = rawErrors[idx];
        if (typeof item === 'string') {
            const trimmed = item.trim();
            if (trimmed) {
                result.push({
                    id: `err_${idx}_${idx}`,
                    name: trimmed,
                    isVisible: true
                });
            }
        } else if (item && typeof item === 'object') {
            const name = typeof item.name === 'string' ? item.name.trim() : '';
            if (name) {
                result.push({
                    id: String(item.id || `err_${idx}_${idx}`),
                    name,
                    isVisible: item.isVisible !== false
                });
            }
        }
    }
    return result;
}

function parseSubmittedErrors(submitted: any): Array<{ id: string; name: string; isVisible: boolean }> | null {
    if (submitted === undefined || submitted === null) return null;
    if (!Array.isArray(submitted)) return null;
    const result: Array<{ id: string; name: string; isVisible: boolean }> = [];
    for (let idx = 0; idx < submitted.length; idx++) {
        const item = submitted[idx];
        if (typeof item === 'string') {
            const trimmed = item.trim();
            if (trimmed) {
                result.push({ id: `err_${idx}_${Date.now()}`, name: trimmed, isVisible: true });
            }
        } else if (item && typeof item === 'object') {
            const name = typeof item.name === 'string' ? item.name.trim() : '';
            if (name) {
                result.push({
                    id: String(item.id || `err_${idx}_${Date.now()}`),
                    name,
                    isVisible: item.isVisible !== false
                });
            }
        }
    }
    return result;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const targetDepartment = searchParams.get('targetDepartment') || 'CNTT';
        let slug = 'it-request-fields-config';
        if (targetDepartment === 'VTYT') slug = 'vtyt-request-fields-config';
        else if (targetDepartment === 'HCQT') slug = 'hcqt-request-fields-config';

        const configRule = await prisma.specializedRule.findUnique({
            where: { slug }
        });

        let defaultHardwareErrors = ['Khác'];
        if (targetDepartment === 'CNTT') {
            defaultHardwareErrors = ['Máy tính không lên', 'Hết mực in / Kẹt giấy', 'Mất mạng Internet', 'Lỗi bàn phím / Chuột', 'Khác'];
        } else if (targetDepartment === 'VTYT') {
            defaultHardwareErrors = ['Không lên nguồn', 'Lỗi cảm biến/Đầu dò', 'Báo lỗi hệ thống', 'Hư hỏng vật lý', 'Khác'];
        } else if (targetDepartment === 'HCQT') {
            defaultHardwareErrors = ['Hỏng bóng đèn', 'Chảy nước/Tắc nghẽn', 'Hỏng điều hòa', 'Sự cố điện', 'Khác'];
        }

        // Nếu chưa có, trả về mặc định
        if (!configRule || !configRule.logicConfig) {
            const normDefaultHardware = normalizeErrors(defaultHardwareErrors);
            return NextResponse.json({ 
                fields: [], 
                softwareErrors: [],
                softwareErrorsConfig: [],
                hardwareErrors: defaultHardwareErrors,
                hardwareErrorsConfig: normDefaultHardware,
                assignmentMode: 'A', 
                maBaLength: 11 
            });
        }

        // Handle legacy array format
        if (Array.isArray(configRule.logicConfig)) {
            const normLegacy = normalizeErrors(configRule.logicConfig);
            return NextResponse.json({ 
                fields: configRule.logicConfig, 
                softwareErrors: normLegacy.filter(e => e.isVisible).map(e => e.name),
                softwareErrorsConfig: normLegacy,
                hardwareErrors: defaultHardwareErrors,
                hardwareErrorsConfig: normalizeErrors(defaultHardwareErrors),
                assignmentMode: 'A', 
                maxImageSizeMB: 10, 
                maBaLength: 11 
            });
        }

        // Handle object format
        const config: any = configRule.logicConfig;

        // Software errors
        const rawSoftware = config.softwareErrorsConfig || config.softwareErrors || config.fields || [];
        const normSoftware = normalizeErrors(rawSoftware);
        const visibleSoftware = normSoftware.filter(e => e.isVisible).map(e => e.name);

        // Hardware errors
        const rawHardware = config.hardwareErrorsConfig || config.hardwareErrors;
        const normHardware = normalizeErrors(
            rawHardware && rawHardware.length > 0 ? rawHardware : defaultHardwareErrors
        );
        const visibleHardware = normHardware.filter(e => e.isVisible).map(e => e.name);

        return NextResponse.json({ 
            softwareErrors: visibleSoftware, 
            softwareErrorsConfig: normSoftware,
            hardwareErrors: visibleHardware,
            hardwareErrorsConfig: normHardware,
            assignmentMode: config.assignmentMode || 'A',
            maxConcurrentTasks: config.maxConcurrentTasks !== undefined ? Number(config.maxConcurrentTasks) : 2,
            morningStartTime: config.morningStartTime || '07:00',
            morningEndTime: config.morningEndTime || '11:30',
            afternoonStartTime: config.afternoonStartTime || '13:30',
            afternoonEndTime: config.afternoonEndTime || config.officeEndTime || '16:50',
            officeEndTime: config.afternoonEndTime || config.officeEndTime || '16:50',
            holidays: Array.isArray(config.holidays) ? config.holidays : [],
            makeupWorkdays: Array.isArray(config.makeupWorkdays) ? config.makeupWorkdays : [],
            noStaffWarningEnabled: config.noStaffWarningEnabled !== undefined ? Boolean(config.noStaffWarningEnabled) : true,
            noStaffWarningMessage: config.noStaffWarningMessage || 'Hiện tại ngoài khung giờ hành chính / kỹ thuật viên đang bận ca trực ngoài viện nên chưa thể tiếp nhận ngay. Yêu cầu của Khoa/Phòng đã được lưu trên hệ thống và chuyển đến nhóm trực. Nếu là sự cố khẩn cấp ảnh hưởng khám chữa bệnh, vui lòng gọi điện thoại trực ban để được hỗ trợ!',
            maxImageSizeMB: config.maxImageSizeMB || 10,
            maxFileSizeMB: config.maxFileSizeMB || config.maxImageSizeMB || 15,
            allowedFileExtensions: config.allowedFileExtensions || '.jpg,.jpeg,.png,.gif,.pdf,.docx,.xlsx,.doc,.xls,.zip,.rar',
            maBaLength: config.maBaLength || 11,
            telegramBotToken: config.telegramBotToken || '',
            telegramChatId: config.telegramChatId || '',
            zaloEnabled: Boolean(config.zaloEnabled),
            zaloWebhookUrl: config.zaloWebhookUrl || '',
            notificationSound: config.notificationSound || { type: 'DEFAULT', url: '', duration: 7 }
        });
    } catch (error: any) {
        console.error('GET it-request-config error:', error);
        return NextResponse.json({ error: 'Lỗi khi lấy cấu hình' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const targetDepartment = searchParams.get('targetDepartment') || 'CNTT';
        let slug = 'it-request-fields-config';
        if (targetDepartment === 'VTYT') slug = 'vtyt-request-fields-config';
        else if (targetDepartment === 'HCQT') slug = 'hcqt-request-fields-config';

        const user = await getCurrentUser();
        // Cho phép Quản trị viên (ADMIN) hoặc nhân viên thuộc phòng ban đích (CNTT, VTYT, HCQT)
        if (!user || (user.role !== 'ADMIN' && user.role !== targetDepartment)) {
            return NextResponse.json({ error: 'Bạn không có quyền thay đổi cấu hình cho phòng ban này!' }, { status: 403 });
        }
        const isAdmin = user.role === 'ADMIN';

        const body = await request.json();
        const { 
            softwareErrors, 
            softwareErrorsConfig,
            hardwareErrors, 
            hardwareErrorsConfig,
            assignmentMode, 
            maxConcurrentTasks,
            morningStartTime,
            morningEndTime,
            afternoonStartTime,
            afternoonEndTime,
            officeEndTime,
            holidays,
            makeupWorkdays,
            noStaffWarningEnabled,
            noStaffWarningMessage,
            maxImageSizeMB, 
            maxFileSizeMB,
            allowedFileExtensions,
            maBaLength, 
            telegramBotToken, 
            telegramChatId,
            zaloEnabled,
            zaloWebhookUrl, 
            notificationSound 
        } = body;

        const parsedSoftware = parseSubmittedErrors(softwareErrorsConfig !== undefined ? softwareErrorsConfig : softwareErrors);
        const parsedHardware = parseSubmittedErrors(hardwareErrorsConfig !== undefined ? hardwareErrorsConfig : hardwareErrors);

        // Keep existing config to avoid overwriting missing fields
        const existingRule = await prisma.specializedRule.findUnique({ where: { slug } });
        const existingConfig: any = existingRule?.logicConfig || {};

        const finalSoftwareConfig = parsedSoftware !== null 
            ? parsedSoftware 
            : normalizeErrors(existingConfig.softwareErrorsConfig || existingConfig.softwareErrors || []);
        const finalSoftwareVisible = finalSoftwareConfig.filter(e => e.isVisible).map(e => e.name);

        const finalHardwareConfig = parsedHardware !== null 
            ? parsedHardware 
            : normalizeErrors(existingConfig.hardwareErrorsConfig || existingConfig.hardwareErrors || []);
        const finalHardwareVisible = finalHardwareConfig.filter(e => e.isVisible).map(e => e.name);

        const resolvedMaxFileSizeMB = maxFileSizeMB !== undefined 
            ? Number(maxFileSizeMB) 
            : (maxImageSizeMB !== undefined ? Number(maxImageSizeMB) : (existingConfig.maxFileSizeMB || 15));

        const finalAfternoonEnd = afternoonEndTime !== undefined 
            ? afternoonEndTime.trim() 
            : (officeEndTime !== undefined ? officeEndTime.trim() : (existingConfig.afternoonEndTime || existingConfig.officeEndTime || '16:50'));

        const newConfig = {
            ...existingConfig,
            softwareErrorsConfig: finalSoftwareConfig,
            softwareErrors: finalSoftwareVisible,
            hardwareErrorsConfig: finalHardwareConfig,
            hardwareErrors: finalHardwareVisible,
            assignmentMode: isAdmin && assignmentMode !== undefined ? assignmentMode : (existingConfig.assignmentMode || 'A'),
            maxConcurrentTasks: isAdmin && maxConcurrentTasks !== undefined ? Number(maxConcurrentTasks) : (existingConfig.maxConcurrentTasks !== undefined ? Number(existingConfig.maxConcurrentTasks) : 2),
            morningStartTime: isAdmin && morningStartTime !== undefined ? morningStartTime.trim() : (existingConfig.morningStartTime || '07:00'),
            morningEndTime: isAdmin && morningEndTime !== undefined ? morningEndTime.trim() : (existingConfig.morningEndTime || '11:30'),
            afternoonStartTime: isAdmin && afternoonStartTime !== undefined ? afternoonStartTime.trim() : (existingConfig.afternoonStartTime || '13:30'),
            afternoonEndTime: isAdmin ? finalAfternoonEnd : (existingConfig.afternoonEndTime || existingConfig.officeEndTime || '16:50'),
            officeEndTime: isAdmin ? finalAfternoonEnd : (existingConfig.afternoonEndTime || existingConfig.officeEndTime || '16:50'),
            holidays: isAdmin && holidays !== undefined && Array.isArray(holidays) ? holidays : (existingConfig.holidays || []),
            makeupWorkdays: isAdmin && makeupWorkdays !== undefined && Array.isArray(makeupWorkdays) ? makeupWorkdays : (existingConfig.makeupWorkdays || []),
            noStaffWarningEnabled: isAdmin && noStaffWarningEnabled !== undefined ? Boolean(noStaffWarningEnabled) : (existingConfig.noStaffWarningEnabled !== undefined ? Boolean(existingConfig.noStaffWarningEnabled) : true),
            noStaffWarningMessage: isAdmin && noStaffWarningMessage !== undefined ? noStaffWarningMessage.trim() : (existingConfig.noStaffWarningMessage || 'Hiện tại ngoài khung giờ hành chính / kỹ thuật viên đang bận ca trực ngoài viện nên chưa thể tiếp nhận ngay. Yêu cầu của Khoa/Phòng đã được lưu trên hệ thống và chuyển đến nhóm trực. Nếu là sự cố khẩn cấp ảnh hưởng khám chữa bệnh, vui lòng gọi điện thoại trực ban để được hỗ trợ!'),
            maxImageSizeMB: isAdmin ? resolvedMaxFileSizeMB : (existingConfig.maxFileSizeMB || existingConfig.maxImageSizeMB || 15),
            maxFileSizeMB: isAdmin ? resolvedMaxFileSizeMB : (existingConfig.maxFileSizeMB || 15),
            allowedFileExtensions: isAdmin && allowedFileExtensions !== undefined ? allowedFileExtensions : (existingConfig.allowedFileExtensions || '.jpg,.jpeg,.png,.gif,.pdf,.docx,.xlsx,.doc,.xls,.zip,.rar'),
            maBaLength: isAdmin && maBaLength !== undefined ? Number(maBaLength) : (existingConfig.maBaLength || 11),
            telegramBotToken: isAdmin && telegramBotToken !== undefined ? telegramBotToken : existingConfig.telegramBotToken,
            telegramChatId: isAdmin && telegramChatId !== undefined ? telegramChatId : existingConfig.telegramChatId,
            zaloEnabled: isAdmin && zaloEnabled !== undefined ? Boolean(zaloEnabled) : Boolean(existingConfig.zaloEnabled),
            zaloWebhookUrl: isAdmin && zaloWebhookUrl !== undefined ? zaloWebhookUrl.trim() : (existingConfig.zaloWebhookUrl || ''),
            notificationSound: notificationSound !== undefined ? notificationSound : (existingConfig.notificationSound || { type: 'DEFAULT', url: '', duration: 7 })
        };

        const configRule = await prisma.specializedRule.upsert({
            where: { slug },
            update: {
                logicConfig: newConfig,
                updatedAt: new Date(),
            },
            create: {
                name: `Cấu hình trường động cho ${targetDepartment}`,
                slug,
                ruleType: RULE_TYPE,
                description: `Lưu trữ các trường nhập liệu động cho ${targetDepartment}.`,
                logicConfig: newConfig,
            }
        });

        return NextResponse.json({ 
            success: true, 
            ...newConfig,
            softwareErrors: finalSoftwareVisible,
            softwareErrorsConfig: finalSoftwareConfig,
            hardwareErrors: finalHardwareVisible,
            hardwareErrorsConfig: finalHardwareConfig
        });
    } catch (error: any) {
        console.error('POST it-request-config error:', error);
        return NextResponse.json({ error: 'Lỗi khi lưu cấu hình' }, { status: 500 });
    }
}
