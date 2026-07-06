'use server';

import { cookies } from 'next/headers';
import * as jose from 'jose';

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
            finalName = payload.username === 'admin' ? 'Quản trị viên (Gốc)' : (payload.name as string);
        } else {
            const { PrismaClient } = await import('@prisma/client');
            const prisma = new PrismaClient();
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
            } finally {
                await prisma.$disconnect();
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
