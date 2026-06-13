import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import * as jose from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-change-me-in-prod';

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

        // Hardcode admin account bypass
        if (username === 'admin' && password === '123456') {
            finalUserId = 'admin-hardcoded';
            finalUserName = 'Quản trị viên (Gốc)';
            finalRole = 'ADMIN';
            finalPermissions = ['*']; // ADMIN has all permissions
        } else {
            const user = await prisma.user.findUnique({
                where: { username },
            });

            if (!user) {
                return NextResponse.json({ error: 'Tài khoản hoặc mật khẩu không đúng' }, { status: 401 });
            }

            const isValid = await bcrypt.compare(password, user.password);

            if (!isValid) {
                return NextResponse.json({ error: 'Tài khoản hoặc mật khẩu không đúng' }, { status: 401 });
            }

            finalUserId = user.id;
            finalUserName = user.name || user.username;
            finalRole = user.role;
            finalMaKhoa = user.ma_khoa;
            finalStaffId = user.staffId;

            // We no longer fetch permissions here to avoid stale data in JWT.
            // Permissions will be fetched on-the-fly by the server action `getCurrentUser`.
        }

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
