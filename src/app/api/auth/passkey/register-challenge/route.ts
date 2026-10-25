import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';
import { getWebAuthnConfig, cleanExpiredChallenges } from '@/lib/webauthn';

export async function POST(request: Request) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return NextResponse.json({ error: 'Vui lòng đăng nhập để đăng ký sinh trắc học' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: currentUser.id },
            include: { passkeys: true }
        });

        if (!user) {
            return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 });
        }

        await cleanExpiredChallenges();

        const { rpName, rpID } = getWebAuthnConfig(request);

        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userID: new Uint8Array(Buffer.from(user.id)),
            userName: user.username,
            userDisplayName: user.name || user.username,
            attestationType: 'none',
            excludeCredentials: user.passkeys.map(pk => ({
                id: pk.credentialId,
                transports: pk.transports as any
            })),
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred'
            }
        });

        // Xóa challenge cũ của user (nếu có) và tạo mới
        await prisma.webAuthnChallenge.deleteMany({
            where: {
                userId: user.id,
                type: 'registration'
            }
        });

        await prisma.webAuthnChallenge.create({
            data: {
                challenge: options.challenge,
                userId: user.id,
                type: 'registration',
                expiresAt: new Date(Date.now() + 5 * 60 * 1000) // Hết hạn sau 5 phút
            }
        });

        return NextResponse.json(options);
    } catch (error: any) {
        console.error('Error generating register challenge:', error);
        return NextResponse.json({ error: error.message || 'Lỗi tạo thử thách xác thực' }, { status: 500 });
    }
}
