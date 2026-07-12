import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUserFromRequest } from '@/actions/auth';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { token, platform } = body;

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 });
        }

        // Upsert the token for this user
        const deviceToken = await prisma.userDeviceToken.upsert({
            where: { token },
            update: {
                userId: user.id,
                platform: platform || 'unknown',
            },
            create: {
                userId: user.id,
                token,
                platform: platform || 'unknown',
            }
        });

        return NextResponse.json({ success: true, data: deviceToken });
    } catch (error: any) {
        console.error('Error POST device-token:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
