import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import prisma from '@/lib/prisma';
import { getWebAuthnConfig, cleanExpiredChallenges } from '@/lib/webauthn';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const { identifier } = body;

        await cleanExpiredChallenges();

        const { rpID } = getWebAuthnConfig(request);

        let allowCredentials: any[] | undefined = undefined;
        let targetUserId: string | null = null;

        if (identifier && typeof identifier === 'string' && identifier.trim()) {
            const trimmed = identifier.trim();
            const user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { username: { equals: trimmed, mode: 'insensitive' } },
                        { userHIS: { equals: trimmed, mode: 'insensitive' } },
                        { staff: { cccd: { equals: trimmed, mode: 'insensitive' } } },
                        { staff: { ma_nv: { equals: trimmed, mode: 'insensitive' } } }
                    ]
                },
                include: { passkeys: true }
            });

            if (!user) {
                return NextResponse.json({ error: 'Không tìm thấy tài khoản trong hệ thống' }, { status: 404 });
            }

            if (!user.isActive) {
                return NextResponse.json({ error: 'Tài khoản đã bị vô hiệu hóa' }, { status: 403 });
            }

            if (!user.passkeys || user.passkeys.length === 0) {
                return NextResponse.json({
                    error: 'Tài khoản chưa đăng ký sinh trắc học trên thiết bị nào. Vui lòng đăng nhập bằng mật khẩu trước để kích hoạt.'
                }, { status: 400 });
            }

            targetUserId = user.id;
            allowCredentials = user.passkeys.map(pk => ({
                id: pk.credentialId,
                transports: pk.transports as any
            }));
        }

        const options = await generateAuthenticationOptions({
            rpID,
            allowCredentials,
            userVerification: 'preferred'
        });

        // Lưu challenge vào DB
        await prisma.webAuthnChallenge.create({
            data: {
                challenge: options.challenge,
                userId: targetUserId,
                type: 'authentication',
                expiresAt: new Date(Date.now() + 5 * 60 * 1000)
            }
        });

        return NextResponse.json(options);
    } catch (error: any) {
        console.error('Error generating login challenge:', error);
        return NextResponse.json({ error: error.message || 'Lỗi tạo thử thách xác thực' }, { status: 500 });
    }
}
