import prisma from '@/lib/prisma';

export const RP_NAME = 'BVĐK Lạng Sơn - Quản lý Bệnh viện';

export interface WebAuthnConfig {
    rpName: string;
    rpID: string;
    origin: string;
}

/**
 * Trích xuất rpID và origin một cách linh hoạt từ Request,
 * hỗ trợ tự động cả localhost, LAN IP (192.168.x.x) và domain triển khai production.
 */
export function getWebAuthnConfig(request: Request): WebAuthnConfig {
    const hostHeader = request.headers.get('host') || 'localhost:3000';
    // Bỏ port để lấy rpID hợp lệ theo chuẩn WebAuthn
    const rpID = hostHeader.split(':')[0];

    const originHeader = request.headers.get('origin');
    const refererHeader = request.headers.get('referer');
    const proto = request.headers.get('x-forwarded-proto') || (hostHeader.startsWith('localhost') || hostHeader.startsWith('127.0.0.1') ? 'http' : 'https');

    let origin = originHeader;
    if (!origin && refererHeader) {
        try {
            const url = new URL(refererHeader);
            origin = url.origin;
        } catch (e) {
            // fallback
        }
    }
    if (!origin) {
        origin = `${proto}://${hostHeader}`;
    }

    return {
        rpName: RP_NAME,
        rpID,
        origin
    };
}

/**
 * Dọn dẹp các challenge đã hết hạn khỏi CSDL để tối ưu dung lượng
 */
export async function cleanExpiredChallenges() {
    try {
        await prisma.webAuthnChallenge.deleteMany({
            where: {
                expiresAt: { lt: new Date() }
            }
        });
    } catch (e) {
        console.error('Error cleaning expired challenges:', e);
    }
}
