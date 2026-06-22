'use server';

import { cookies } from 'next/headers';
import * as jose from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-change-me-in-prod';

export type UserPayload = {
    id: string;
    username: string;
    role: string;
    ma_khoa?: string;
    staffId?: string;
    permissions?: any;
    isManager?: boolean;
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
        
        if (payload.role === 'ADMIN') {
            permissions = ['*'];
            isManager = true;
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
                    include: { staff: true }
                });
                if (userRecord?.staff?.chuc_vu_id) {
                    isManager = true;
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
            isManager
        };
    } catch (error) {
        return null; // Invalid or expired token
    }
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete('auth_token');
}
