import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';
import { getWebAuthnConfig } from '@/lib/webauthn';

export async function POST(request: Request) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await request.json();
        const { response, deviceName } = body;

        if (!response) {
            return NextResponse.json({ error: 'Thiếu dữ liệu phản hồi xác thực' }, { status: 400 });
        }

        // Tìm challenge hợp lệ của người dùng
        const challengeRecord = await prisma.webAuthnChallenge.findFirst({
            where: {
                userId: currentUser.id,
                type: 'registration',
                expiresAt: { gte: new Date() }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!challengeRecord) {
            return NextResponse.json({ error: 'Thử thách xác thực đã hết hạn. Vui lòng thử lại.' }, { status: 400 });
        }

        const { rpID, origin } = getWebAuthnConfig(request);

        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge: challengeRecord.challenge,
            expectedOrigin: origin,
            expectedRPID: rpID
        });

        if (!verification.verified || !verification.registrationInfo) {
            return NextResponse.json({ error: 'Xác minh sinh trắc học không thành công' }, { status: 400 });
        }

        const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

        // Lưu Passkey vào CSDL
        await prisma.userPasskey.create({
            data: {
                userId: currentUser.id,
                credentialId: credential.id,
                publicKey: Buffer.from(credential.publicKey),
                counter: BigInt(credential.counter),
                deviceType: credentialDeviceType,
                backedUp: credentialBackedUp,
                transports: (response.response?.transports as string[]) || [],
                deviceName: deviceName?.trim() || 'Thiết bị bảo mật',
                lastUsedAt: new Date()
            }
        });

        // Xóa challenge sau khi dùng
        await prisma.webAuthnChallenge.delete({
            where: { id: challengeRecord.id }
        });

        return NextResponse.json({
            success: true,
            message: 'Đăng ký đăng nhập bằng Sinh trắc học (Passkey) thành công!'
        });
    } catch (error: any) {
        console.error('Error verifying registration:', error);
        return NextResponse.json({ error: error.message || 'Lỗi xác minh đăng ký sinh trắc học' }, { status: 500 });
    }
}
