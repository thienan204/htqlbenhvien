import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import prisma from '@/lib/prisma';
import * as jose from 'jose';
import { getWebAuthnConfig } from '@/lib/webauthn';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-change-me-in-prod';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { response } = body;

        if (!response || !response.id) {
            return NextResponse.json({ error: 'Thiếu dữ liệu phản hồi xác thực' }, { status: 400 });
        }

        // 1. Tìm thông tin Passkey đã đăng ký trong CSDL
        const passkey = await prisma.userPasskey.findUnique({
            where: { credentialId: response.id },
            include: { user: true }
        });

        if (!passkey || !passkey.user) {
            return NextResponse.json({
                error: 'Thiết bị này chưa được liên kết với bất kỳ tài khoản nào trong hệ thống.'
            }, { status: 401 });
        }

        if (!passkey.user.isActive) {
            return NextResponse.json({
                error: 'Tài khoản người dùng đã bị vô hiệu hóa.'
            }, { status: 403 });
        }

        // 2. Lấy challenge từ clientDataJSON
        let expectedChallenge = '';
        let challengeRecordId: string | null = null;

        try {
            const clientDataJsonStr = Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8');
            const clientData = JSON.parse(clientDataJsonStr);
            expectedChallenge = clientData.challenge;

            const record = await prisma.webAuthnChallenge.findFirst({
                where: {
                    challenge: expectedChallenge,
                    type: 'authentication',
                    expiresAt: { gte: new Date() }
                }
            });

            if (!record) {
                return NextResponse.json({ error: 'Thử thách xác thực không hợp lệ hoặc đã hết hạn.' }, { status: 400 });
            }
            challengeRecordId = record.id;
        } catch (e) {
            return NextResponse.json({ error: 'Dữ liệu phản hồi xác thực bị lỗi' }, { status: 400 });
        }

        const { rpID, origin } = getWebAuthnConfig(request);

        // 3. Xác thực chữ ký điện tử với PublicKey đã lưu
        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            credential: {
                id: passkey.credentialId,
                publicKey: new Uint8Array(passkey.publicKey),
                counter: Number(passkey.counter),
                transports: passkey.transports as any
            }
        });

        if (!verification.verified) {
            return NextResponse.json({ error: 'Xác thực sinh trắc học thất bại.' }, { status: 401 });
        }

        // 4. Cập nhật counter và thời gian sử dụng
        await prisma.userPasskey.update({
            where: { id: passkey.id },
            data: {
                counter: BigInt(verification.authenticationInfo.newCounter),
                lastUsedAt: new Date()
            }
        });

        // Xóa challenge đã dùng
        if (challengeRecordId) {
            await prisma.webAuthnChallenge.delete({
                where: { id: challengeRecordId }
            }).catch(() => {});
        }

        // Xóa các lần nhập sai mật khẩu (nếu có)
        await prisma.loginAttempt.deleteMany({
            where: {
                username: { equals: passkey.user.username, mode: 'insensitive' },
                success: false
            }
        }).catch(() => {});

        // 5. Cấp JWT Token và Cookie đăng nhập
        const userAgent = request.headers.get('user-agent') || '';
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        const expirationTime = isMobile ? '90d' : '24h';
        const cookieMaxAge = isMobile ? 60 * 60 * 24 * 90 : 60 * 60 * 24;

        const alg = 'HS256';
        const secret = new TextEncoder().encode(JWT_SECRET);

        const token = await new jose.SignJWT({
            id: passkey.user.id,
            username: passkey.user.username,
            role: passkey.user.role,
            ma_khoa: passkey.user.ma_khoa,
            staffId: passkey.user.staffId
        })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setExpirationTime(expirationTime)
            .sign(secret);

        const res = NextResponse.json({
            success: true,
            user: {
                id: passkey.user.id,
                username: passkey.user.username,
                name: passkey.user.name || passkey.user.username,
                role: passkey.user.role
            }
        });

        const isHttps = process.env.NEXTAUTH_URL?.startsWith('https') || false;

        res.cookies.set({
            name: 'auth_token',
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' && isHttps,
            sameSite: 'lax',
            path: '/',
            maxAge: cookieMaxAge
        });

        return res;
    } catch (error: any) {
        console.error('Error verifying login passkey:', error);
        return NextResponse.json({ error: error.message || 'Lỗi hệ thống khi xác thực sinh trắc học' }, { status: 500 });
    }
}
