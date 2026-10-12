import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

const RULE_TYPE = 'USER_SOUND_CONFIG';

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const slug = `user-sound-${user.id}`;
        const configRule = await prisma.specializedRule.findUnique({
            where: { slug }
        });

        if (!configRule || !configRule.logicConfig) {
            return NextResponse.json({
                mode: 'DEPARTMENT', // Mặc định dùng chuông chung của phòng
                type: 'DEFAULT',
                url: '',
                duration: 7,
                name: ''
            });
        }

        return NextResponse.json(configRule.logicConfig);
    } catch (error: any) {
        console.error('GET user notification-settings error:', error);
        return NextResponse.json({ error: 'Lỗi khi tải cài đặt âm thanh cá nhân' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { soundConfig } = body;

        if (!soundConfig) {
            return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
        }

        const slug = `user-sound-${user.id}`;
        await prisma.specializedRule.upsert({
            where: { slug },
            update: {
                logicConfig: soundConfig,
                updatedAt: new Date(),
            },
            create: {
                name: `Cấu hình âm thanh của ${user.name || user.username}`,
                slug,
                ruleType: RULE_TYPE,
                description: `Cài đặt nhạc chuông cá nhân của người dùng ID: ${user.id}`,
                logicConfig: soundConfig,
            }
        });

        return NextResponse.json({ success: true, soundConfig });
    } catch (error: any) {
        console.error('POST user notification-settings error:', error);
        return NextResponse.json({ error: 'Lỗi khi lưu cài đặt âm thanh cá nhân' }, { status: 500 });
    }
}
