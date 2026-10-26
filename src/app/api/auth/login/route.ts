import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import * as jose from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-change-me-in-prod';
// Trigger nextjs hot reload

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json({ error: 'Vui lòng nhập đầy đủ thông tin' }, { status: 400 });
        }

        let finalUserId = '';
        let finalUserName = '';
        let finalRole = 'USER';
        let finalMaKhoa = null;
        let finalStaffId: string | null = null;
        let finalPermissions: string[] = [];

        const trimmedUser = username.trim();
        const windowStart = new Date(Date.now() - 15 * 60 * 1000);

        // 1. Kiểm tra giới hạn số lần thử sai (Brute-force protection)
        const recentFails = await prisma.loginAttempt.count({
            where: {
                username: { equals: trimmedUser, mode: 'insensitive' },
                success: false,
                createdAt: { gte: windowStart }
            }
        });

        if (recentFails >= 5) {
            return NextResponse.json({ 
                error: 'Tài khoản tạm thời bị khóa 15 phút do nhập sai mật khẩu quá 5 lần liên tiếp.' 
            }, { status: 429 });
        }

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: { equals: trimmedUser, mode: 'insensitive' } },
                    { userHIS: { equals: trimmedUser, mode: 'insensitive' } },
                    { staff: { cccd: { equals: trimmedUser, mode: 'insensitive' } } },
                    { staff: { ma_nv: { equals: trimmedUser, mode: 'insensitive' } } }
                ]
            },
        });

        if (!user) {
            await prisma.loginAttempt.create({
                data: { username: trimmedUser, success: false }
            });
            const remaining = 5 - (recentFails + 1);
            return NextResponse.json({ 
                error: remaining > 0 ? `Tài khoản hoặc mật khẩu không đúng. Còn ${remaining} lần thử.` : 'Tài khoản đã bị tạm khóa 15 phút.' 
            }, { status: 401 });
        }

        if (!user.isActive) {
            return NextResponse.json({ error: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.' }, { status: 403 });
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            await prisma.loginAttempt.create({
                data: { username: trimmedUser, success: false }
            });
            const remaining = 5 - (recentFails + 1);
            return NextResponse.json({ 
                error: remaining > 0 ? `Tài khoản hoặc mật khẩu không đúng. Còn ${remaining} lần thử.` : 'Tài khoản đã bị tạm khóa 15 phút.' 
            }, { status: 401 });
        }

        // Đăng nhập thành công -> Xóa các lần thử sai trước đó
        await prisma.loginAttempt.deleteMany({
            where: {
                username: { equals: trimmedUser, mode: 'insensitive' },
                success: false
            }
        });

        // Quy định bệnh viện: Lãnh đạo phòng CNTT mặc định không nhận việc tự động khi đăng nhập
        if (user.role === 'CNTT' && user.staffId) {
            try {
                const staff = await prisma.staff.findUnique({
                    where: { id: user.staffId },
                    include: { chuc_vu_ref: true }
                });
                const explicitLevel = (staff?.chuc_vu_ref as any)?.level;
                const cvCode = (staff?.chuc_vu_ref?.code || '').toUpperCase();
                const isLeader = explicitLevel === 'LEVEL_1_BGD' || explicitLevel === 'LEVEL_2_LEADER' || cvCode.includes('TRUONG_PHONG') || cvCode.includes('PHO_TRUONG_PHONG') || cvCode.includes('TRUONG_KHOA');
                if (isLeader) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { isAvailable: false }
                    });
                }
            } catch (errLeader) {
                console.error('Lỗi kiểm tra lãnh đạo CNTT khi login:', errLeader);
            }
        }

        finalUserId = user.id;
        finalUserName = user.name || user.username;
        finalRole = user.role;
        finalMaKhoa = user.ma_khoa;
        finalStaffId = user.staffId;


        // Create JWT
        const alg = 'HS256';
        const secret = new TextEncoder().encode(JWT_SECRET);

        const token = await new jose.SignJWT({
            id: finalUserId,
            username: username,
            role: finalRole,
            ma_khoa: finalMaKhoa,
            staffId: finalStaffId
        })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setExpirationTime('24h') // Token valid for 24 hours
            .sign(secret);

        // Set HttpOnly Cookie
        const response = NextResponse.json({ 
            success: true, 
            user: { 
                name: finalUserName, 
                role: finalRole, 
                ma_khoa: finalMaKhoa
            } 
        });

        const isHttps = process.env.NEXTAUTH_URL?.startsWith('https') || false;

        response.cookies.set({
            name: 'auth_token',
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' && isHttps,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 // 24 hours
        });

        return response;

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
    }
}
