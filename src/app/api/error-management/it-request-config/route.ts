import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/actions/auth';

const prisma = new PrismaClient();
const CONFIG_SLUG = 'it-request-fields-config';
const RULE_TYPE = 'SYSTEM_CONFIG';

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
            return NextResponse.json({ fields: [], assignmentMode: 'A', hardwareErrors: defaultHardwareErrors });
        }

        // Handle legacy array format
        if (Array.isArray(configRule.logicConfig)) {
            return NextResponse.json({ fields: configRule.logicConfig, assignmentMode: 'A', maxImageSizeMB: 10 });
        }

        // Handle object format
        const config: any = configRule.logicConfig;
        return NextResponse.json({ 
            softwareErrors: config.softwareErrors || config.fields || [], 
            hardwareErrors: config.hardwareErrors && config.hardwareErrors.length > 0 ? config.hardwareErrors : defaultHardwareErrors,
            assignmentMode: config.assignmentMode || 'A',
            maxImageSizeMB: config.maxImageSizeMB || 10
        });
    } catch (error: any) {
        console.error('GET it-request-config error:', error);
        return NextResponse.json({ error: 'Lỗi khi lấy cấu hình' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        // Chỉ ADMIN hoặc quyền quản lý phòng ban mới được phép cấu hình
        if (!user || (!['ADMIN', 'CNTT', 'VTYT', 'HCQT'].includes(user.role))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const targetDepartment = searchParams.get('targetDepartment') || 'CNTT';
        let slug = 'it-request-fields-config';
        if (targetDepartment === 'VTYT') slug = 'vtyt-request-fields-config';
        else if (targetDepartment === 'HCQT') slug = 'hcqt-request-fields-config';

        const body = await request.json();
        const { softwareErrors, hardwareErrors, assignmentMode, maxImageSizeMB, telegramBotToken, telegramChatId } = body;

        if (softwareErrors && !Array.isArray(softwareErrors)) {
            return NextResponse.json({ error: 'Dữ liệu softwareErrors không hợp lệ, phải là mảng string' }, { status: 400 });
        }
        if (hardwareErrors && !Array.isArray(hardwareErrors)) {
            return NextResponse.json({ error: 'Dữ liệu hardwareErrors không hợp lệ, phải là mảng string' }, { status: 400 });
        }

        // Keep existing config to avoid overwriting missing fields
        const existingRule = await prisma.specializedRule.findUnique({ where: { slug } });
        const existingConfig: any = existingRule?.logicConfig || {};

        const newConfig = {
            ...existingConfig,
            softwareErrors: softwareErrors || existingConfig.softwareErrors || [],
            hardwareErrors: hardwareErrors || existingConfig.hardwareErrors || [],
            assignmentMode: assignmentMode || existingConfig.assignmentMode || 'A',
            maxImageSizeMB: maxImageSizeMB !== undefined ? maxImageSizeMB : (existingConfig.maxImageSizeMB || 10),
            telegramBotToken: telegramBotToken !== undefined ? telegramBotToken : existingConfig.telegramBotToken,
            telegramChatId: telegramChatId !== undefined ? telegramChatId : existingConfig.telegramChatId
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

        return NextResponse.json({ success: true, ...newConfig });
    } catch (error: any) {
        console.error('POST it-request-config error:', error);
        return NextResponse.json({ error: 'Lỗi khi lưu cấu hình' }, { status: 500 });
    }
}
