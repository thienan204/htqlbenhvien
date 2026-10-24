import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

interface QuickReplyTemplate {
    id: string;
    text: string;
    isActive: boolean;
    isDefault?: boolean;
}

const DEFAULT_QUICK_REPLIES: QuickReplyTemplate[] = [
    { id: 'qr-1', text: 'Đã xong, Khoa kiểm tra lại giúp nhé!', isActive: true, isDefault: true },
    { id: 'qr-2', text: 'Đã xử lý xong lỗi.', isActive: true, isDefault: true },
    { id: 'qr-3', text: 'Đang kiểm tra và xử lý...', isActive: true, isDefault: true },
    { id: 'qr-4', text: 'Khoa khởi động lại máy tính/phần mềm giúp CNTT.', isActive: true, isDefault: true },
    { id: 'qr-5', text: 'Đã liên hệ đối tác phần mềm để phối hợp xử lý.', isActive: true, isDefault: true },
    { id: 'qr-6', text: 'Khoa vui lòng gửi thêm ảnh chụp màn hình hoặc mã bệnh án.', isActive: true, isDefault: true },
];

const QUICK_REPLIES_SLUG = 'it-request-quick-replies';

export async function GET() {
    try {
        const rule = await prisma.specializedRule.findUnique({
            where: { slug: QUICK_REPLIES_SLUG }
        });

        if (rule && rule.logicConfig && typeof rule.logicConfig === 'object') {
            const templates = (rule.logicConfig as any).templates;
            if (Array.isArray(templates) && templates.length > 0) {
                return NextResponse.json({ templates, isSystemConfigured: true });
            }
        }

        return NextResponse.json({ templates: DEFAULT_QUICK_REPLIES, isSystemConfigured: false });
    } catch (error) {
        console.error('Error GET quick-replies config:', error);
        return NextResponse.json({ templates: DEFAULT_QUICK_REPLIES, isSystemConfigured: false });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAllowed = ['ADMIN', 'CNTT', 'VTYT', 'HCQT'].includes(user.role);
        if (!isAllowed) {
            return NextResponse.json({ error: 'Chỉ Admin hoặc bộ phận kỹ thuật mới có quyền lưu mẫu câu dùng chung toàn viện.' }, { status: 403 });
        }

        const body = await request.json();
        const { templates } = body;

        if (!Array.isArray(templates)) {
            return NextResponse.json({ error: 'Dữ liệu templates không hợp lệ' }, { status: 400 });
        }

        const updatedRule = await prisma.specializedRule.upsert({
            where: { slug: QUICK_REPLIES_SLUG },
            create: {
                slug: QUICK_REPLIES_SLUG,
                name: 'Mẫu câu trả lời nhanh dùng chung toàn viện',
                ruleType: 'SYSTEM_CONFIG',
                description: 'Danh sách mẫu câu trả lời nhanh dùng chung cho toàn bộ nhân viên/khoa phòng',
                logicConfig: { templates }
            },
            update: {
                name: 'Mẫu câu trả lời nhanh dùng chung toàn viện',
                logicConfig: { templates }
            }
        });

        return NextResponse.json({ 
            success: true, 
            templates: (updatedRule.logicConfig as any)?.templates || templates 
        });
    } catch (error) {
        console.error('Error POST quick-replies config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
