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

        // Tự động đồng bộ trạng thái nhận việc (isAvailable) theo Bảng chấm công ngày hôm nay
        const isSupportDeptUser = ['CNTT', 'VTYT', 'HCQT'].includes(user.role) || ['KP046', 'KP038', 'KP040'].includes(user.ma_khoa || '');
        if (isSupportDeptUser && user.staffId) {
            try {
                // Đọc cấu hình liên kết chấm công
                const itConfigRule = await prisma.specializedRule.findUnique({
                    where: { slug: 'it-request-fields-config' }
                });
                const itConfig: any = itConfigRule?.logicConfig || {};
                const syncAttendanceEnabled = itConfig.syncAttendanceEnabled !== false;
                const applyForLeaders = itConfig.applyForLeaders === true;
                const autoDisableOnLeave = itConfig.autoDisableOnLeave !== false;

                const staff = await prisma.staff.findUnique({
                    where: { id: user.staffId },
                    include: { chuc_vu_ref: true }
                });
                const explicitLevel = (staff?.chuc_vu_ref as any)?.level;
                const cvCode = (staff?.chuc_vu_ref?.code || '').toUpperCase();
                const cvName = (staff?.chuc_vu_ref?.name || '').toLowerCase();
                const isTeamLeader = Boolean(
                    explicitLevel === 'LEVEL_2_1_TEAM_LEADER' || 
                    explicitLevel === 'LEVEL_2.1' || 
                    cvCode === 'TO_TRUONG' || 
                    cvCode.includes('TO_TRUONG') || 
                    cvName.includes('tổ trưởng')
                );
                const isLeader = !isTeamLeader && Boolean(
                    explicitLevel === 'LEVEL_1_BGD' || 
                    explicitLevel === 'LEVEL_2_LEADER' || 
                    cvCode.includes('TRUONG_PHONG') || 
                    cvCode.includes('PHO_TRUONG_PHONG') || 
                    cvCode.includes('TRUONG_KHOA') || 
                    cvCode.includes('PHO_TRUONG_KHOA') ||
                    cvName.includes('trưởng phòng') || 
                    cvName.includes('phó trưởng phòng') || 
                    cvName.includes('trưởng khoa') || 
                    cvName.includes('phó trưởng khoa')
                );

                // Lấy ngày hôm nay
                const todayStr = new Date().toISOString().split('T')[0];
                const todayAtt = await prisma.staffAttendanceRecord.findFirst({
                    where: {
                        staffId: user.staffId,
                        workDate: todayStr
                    }
                });

                if (todayAtt && syncAttendanceEnabled) {
                    const cleanCode = (todayAtt.code || '').trim().toUpperCase();
                    const isWorkingToday = ['X', '+', 'NB/2', 'P/2'].includes(cleanCode);
                    const isLeaveToday = ['P', 'O', 'CO', 'NB', 'K', 'RO', 'TS', 'H'].includes(cleanCode);

                    if (isWorkingToday) {
                        if (!isLeader || applyForLeaders) {
                            await prisma.user.update({
                                where: { id: user.id },
                                data: { isAvailable: true }
                            });
                        }
                    } else if (isLeaveToday && autoDisableOnLeave) {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { isAvailable: false }
                        });
                    }
                } else if (!isLeader) {
                    // Nhân viên kỹ thuật nếu chưa có công hôm nay thì giữ nguyên trạng thái hoặc bật
                    if (!user.isAvailable) {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { isAvailable: true }
                        });
                    }
                }
            } catch (errLeader) {
                console.error('Lỗi kiểm tra lãnh đạo phòng hỗ trợ khi login:', errLeader);
            }
        }

        finalUserId = user.id;
        finalUserName = user.name || user.username;
        finalRole = user.role;
        finalMaKhoa = user.ma_khoa;
        finalStaffId = user.staffId;

        // Nếu user có liên kết với Staff, ưu tiên lấy mã khoa mới nhất từ Staff và tự động đồng bộ vào User
        if (user.staffId) {
            try {
                const staffRecord = await prisma.staff.findUnique({
                    where: { id: user.staffId },
                    select: { ma_khoa: true }
                });
                if (staffRecord?.ma_khoa) {
                    finalMaKhoa = staffRecord.ma_khoa;
                    if (user.ma_khoa !== staffRecord.ma_khoa) {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { ma_khoa: staffRecord.ma_khoa }
                        });
                    }
                }
            } catch (errSync) {
                console.error('Lỗi đồng bộ mã khoa từ staff khi login:', errSync);
            }
        }


        // Nhận diện thiết bị di động qua User-Agent
        const userAgent = request.headers.get('user-agent') || '';
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        const expirationTime = isMobile ? '90d' : '24h';
        const cookieMaxAge = isMobile ? 60 * 60 * 24 * 90 : 60 * 60 * 24;

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
            .setExpirationTime(expirationTime)
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
            maxAge: cookieMaxAge
        });

        return response;

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
    }
}
