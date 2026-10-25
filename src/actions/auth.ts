'use server';

import { cookies } from 'next/headers';
import * as jose from 'jose';
import prisma from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-change-me-in-prod';

export type UserPayload = {
    id: string;
    username: string;
    role: string;
    ma_khoa?: string;
    ten_khoa?: string;
    staffId?: string;
    isManager?: boolean;
    ma_cchn?: string;
    name?: string;
    permissions?: any[];
    ma_nv?: string;
    cccd?: string;
};

export async function getCurrentUser(): Promise<UserPayload | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return null;

        const secret = new TextEncoder().encode(JWT_SECRET);
        const { payload } = await jose.jwtVerify(token, secret);

        let permissions: any = [];
        let isManager = false;
        let ma_cchn: string | undefined = undefined;
        let finalName: string | undefined = undefined;
        let finalTenKhoa: string | undefined = undefined;
        let ma_nv: string | undefined = undefined;
        let cccd: string | undefined = undefined;

        if (payload.role === 'ADMIN') {
            permissions = ['*'];
            isManager = true;
            finalName = payload.username === 'admin' ? 'Quản trị viên' : (payload.name as string);
        } else {
            try {
                const roleRecord = await prisma.role.findUnique({
                    where: { code: payload.role as string }
                });
                if (roleRecord && roleRecord.permissions) {
                    permissions = roleRecord.permissions;
                }

                const userRecord = await prisma.user.findUnique({
                    where: { id: payload.id as string },
                    include: {
                        staff: {
                            include: {
                                certificates: true
                            }
                        }
                    }
                });
                if (userRecord?.staff?.chuc_vu_id) {
                    isManager = true;
                }
                if (userRecord?.staff?.certificates && userRecord.staff.certificates.length > 0) {
                    ma_cchn = userRecord.staff.certificates[0].so_cchn;
                }

                if (userRecord) {
                    finalName = userRecord.name || userRecord.staff?.ho_ten || (payload.username as string);
                    ma_nv = userRecord.staff?.ma_nv || undefined;
                    cccd = userRecord.staff?.cccd || undefined;
                }

                if (payload.ma_khoa) {
                    const dept = await prisma.department.findUnique({ where: { ma_khoa: payload.ma_khoa as string } });
                    if (dept) {
                        finalTenKhoa = dept.ten_khoa;
                    }
                }
            } catch (err) {
                console.error('Error fetching fresh permissions:', err);
            }
        }

        return {
            id: payload.id as string,
            username: payload.username as string,
            role: payload.role as string,
            ma_khoa: payload.ma_khoa as string | undefined,
            staffId: payload.staffId as string | undefined,
            permissions,
            isManager,
            ma_cchn,
            name: finalName,
            ten_khoa: finalTenKhoa,
            ma_nv,
            cccd
        };
    } catch (error) {
        return null; // Invalid or expired token
    }
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete('auth_token');
}

export async function getCurrentUserFromRequest(request: Request): Promise<UserPayload | null> {
    try {
        let token: string | undefined;

        // 1. Thử lấy từ header Authorization: Bearer <token>
        const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }

        // 2. Nếu không có ở Header, thử lấy từ cookie (để API tương thích ngược với web nếu cần)
        if (!token) {
            const cookieStore = await cookies();
            token = cookieStore.get('auth_token')?.value;
        }

        if (!token) return null;

        const secret = new TextEncoder().encode(JWT_SECRET);
        const { payload } = await jose.jwtVerify(token, secret);

        let permissions: any = [];
        let isManager = false;
        let ma_cchn: string | undefined = undefined;
        let finalName: string | undefined = undefined;
        let finalTenKhoa: string | undefined = undefined;
        let ma_nv: string | undefined = undefined;
        let cccd: string | undefined = undefined;

        if (payload.role === 'ADMIN') {
            permissions = ['*'];
            isManager = true;
            finalName = payload.username === 'admin' ? 'Quản trị viên' : (payload.name as string);
        } else {
            try {
                const roleRecord = await prisma.role.findUnique({
                    where: { code: payload.role as string }
                });
                if (roleRecord && roleRecord.permissions) {
                    permissions = roleRecord.permissions;
                }

                const userRecord = await prisma.user.findUnique({
                    where: { id: payload.id as string },
                    include: {
                        staff: {
                            include: {
                                certificates: true
                            }
                        }
                    }
                });
                if (userRecord?.staff?.chuc_vu_id) {
                    isManager = true;
                }
                if (userRecord?.staff?.certificates && userRecord.staff.certificates.length > 0) {
                    ma_cchn = userRecord.staff.certificates[0].so_cchn;
                }

                if (userRecord) {
                    finalName = userRecord.name || userRecord.staff?.ho_ten || (payload.username as string);
                    ma_nv = userRecord.staff?.ma_nv || undefined;
                    cccd = userRecord.staff?.cccd || undefined;
                }

                if (payload.ma_khoa) {
                    const dept = await prisma.department.findUnique({ where: { ma_khoa: payload.ma_khoa as string } });
                    if (dept) {
                        finalTenKhoa = dept.ten_khoa;
                    }
                }
            } catch (err) {
                console.error('Error fetching fresh permissions in mobile API:', err);
            }
        }

        return {
            id: payload.id as string,
            username: payload.username as string,
            role: payload.role as string,
            ma_khoa: payload.ma_khoa as string | undefined,
            staffId: payload.staffId as string | undefined,
            permissions,
            isManager,
            ma_cchn,
            name: finalName,
            ten_khoa: finalTenKhoa,
            ma_nv,
            cccd
        };
    } catch (error) {
        return null;
    }
}

import bcrypt from 'bcryptjs';

// Cấu hình bảo vệ chống Brute-force đăng nhập (Giai đoạn 1)
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function setAuthCookie(payload: {
    id: string;
    username: string;
    role: string;
    ma_khoa?: string | null;
    staffId?: string | null;
}) {
    const alg = 'HS256';
    const secret = new TextEncoder().encode(JWT_SECRET);

    const token = await new jose.SignJWT({
        id: payload.id,
        username: payload.username,
        role: payload.role,
        ma_khoa: payload.ma_khoa,
        staffId: payload.staffId
    })
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setExpirationTime('24h') // Token valid for 24 hours
        .sign(secret);

    const isHttps = process.env.NEXTAUTH_URL?.startsWith('https') || false;

    const cookieStore = await cookies();
    cookieStore.set({
        name: 'auth_token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' && isHttps,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 // 24 hours
    });

    return token;
}

export async function loginAction(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!username || !password) {
            return { success: false, error: 'Vui lòng nhập đầy đủ thông tin' };
        }

        const trimmedUser = username.trim();
        const windowStart = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000);

        // 1. Kiểm tra giới hạn số lần thử sai (Brute-force protection)
        const recentFails = await prisma.loginAttempt.count({
            where: {
                username: { equals: trimmedUser, mode: 'insensitive' },
                success: false,
                createdAt: { gte: windowStart }
            }
        });

        if (recentFails >= MAX_LOGIN_ATTEMPTS) {
            const latest = await prisma.loginAttempt.findFirst({
                where: {
                    username: { equals: trimmedUser, mode: 'insensitive' },
                    success: false,
                    createdAt: { gte: windowStart }
                },
                orderBy: { createdAt: 'desc' }
            });
            const elapsed = latest ? Date.now() - latest.createdAt.getTime() : 0;
            const remainingMins = Math.max(1, Math.ceil((LOCKOUT_MINUTES * 60 * 1000 - elapsed) / 60000));

            return {
                success: false,
                error: `Tài khoản tạm thời bị khóa do nhập sai mật khẩu quá 5 lần. Vui lòng thử lại sau ${remainingMins} phút hoặc liên hệ quản trị viên.`
            };
        }

        // 2. Tìm người dùng trong cơ sở dữ liệu (hỗ trợ username, userHIS, CCCD, Mã NV)
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
            const remaining = MAX_LOGIN_ATTEMPTS - (recentFails + 1);
            return {
                success: false,
                error: remaining > 0
                    ? `Tài khoản hoặc mật khẩu không đúng. Còn ${remaining} lần thử.`
                    : `Tài khoản đã bị tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần.`
            };
        }

        if (!user.isActive) {
            return { success: false, error: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.' };
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            await prisma.loginAttempt.create({
                data: { username: trimmedUser, success: false }
            });
            const remaining = MAX_LOGIN_ATTEMPTS - (recentFails + 1);
            return {
                success: false,
                error: remaining > 0
                    ? `Tài khoản hoặc mật khẩu không đúng. Còn ${remaining} lần thử.`
                    : `Tài khoản đã bị tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần.`
            };
        }

        // 3. Đăng nhập thành công -> Xóa các lần thử sai trước đó
        await prisma.loginAttempt.deleteMany({
            where: {
                username: { equals: trimmedUser, mode: 'insensitive' },
                success: false
            }
        });

        // 4. Cấp phiên đăng nhập JWT
        await setAuthCookie({
            id: user.id,
            username: user.username,
            role: user.role,
            ma_khoa: user.ma_khoa,
            staffId: user.staffId
        });

        return { success: true };
    } catch (error) {
        console.error('Login action error:', error);
        return { success: false, error: 'Lỗi máy chủ' };
    }
}

