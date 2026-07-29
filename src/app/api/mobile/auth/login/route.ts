import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import * as jose from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-change-me-in-prod';

export async function OPTIONS(request: Request) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

export async function POST(request: Request) {
    try {
        const { username, password, deviceToken, platform } = await request.json();

        if (!username || !password) {
            return NextResponse.json({ error: 'Vui lòng nhập đầy đủ thông tin' }, { 
                status: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                }
            });
        }

        let finalUserId = '';
        let finalUserName = '';
        let finalRole = 'USER';
        let finalMaKhoa = null;
        let finalStaffId: string | null = null;

        // Hardcode admin account bypass
        if (username === 'admin' && password === '123456') {
            finalUserId = 'admin-hardcoded';
            finalUserName = 'Quản trị viên';
            finalRole = 'ADMIN';
        } else {
            const user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { username },
                        { staff: { cccd: username } },
                        { staff: { ma_nv: username } }
                    ]
                },
            });

            if (!user) {
                return NextResponse.json({ error: 'Tài khoản hoặc mật khẩu không đúng' }, { 
                    status: 401,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    }
                });
            }

            const isValid = await bcrypt.compare(password, user.password);

            if (!isValid) {
                return NextResponse.json({ error: 'Tài khoản hoặc mật khẩu không đúng' }, { 
                    status: 401,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    }
                });
            }

            finalUserId = user.id;
            finalUserName = user.name || user.username;
            finalRole = user.role;
            finalMaKhoa = user.ma_khoa;
            finalStaffId = user.staffId;
        }

        // Create JWT for Mobile (expires in 30 days)
        const alg = 'HS256';
        const secret = new TextEncoder().encode(JWT_SECRET);

        const token = await new jose.SignJWT({
            id: finalUserId,
            username: username,
            role: finalRole,
            ma_khoa: finalMaKhoa,
            staffId: finalStaffId,
            isMobile: true
        })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setExpirationTime('30d') // Mobile tokens live longer
            .sign(secret);

        // TODO: Save deviceToken to database for push notifications (if provided)
        // if (deviceToken && finalUserId !== 'admin-hardcoded') {
        //     await prisma.userDevice.upsert({ ... })
        // }

        return NextResponse.json({ 
            success: true, 
            token: token, // Dành cho Mobile để lưu vào SharedPreferences / AsyncStorage
            user: { 
                id: finalUserId,
                name: finalUserName, 
                role: finalRole, 
                ma_khoa: finalMaKhoa
            } 
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });

    } catch (error) {
        console.error('Mobile Login error:', error);
        return NextResponse.json({ error: 'Lỗi máy chủ' }, { 
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });
    }
}
