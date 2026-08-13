import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getCurrentUser } from '@/actions/auth';

const prisma = new PrismaClient();

async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
        throw new Error('Unauthorized');
    }
    return user;
}

export async function POST(request: Request) {
    try {
        await requireAdmin();
        const body = await request.json();
        
        if (!Array.isArray(body)) {
            return NextResponse.json({ error: 'Dữ liệu không hợp lệ, yêu cầu một mảng (Array)' }, { status: 400 });
        }

        const results = {
            total: body.length,
            success: 0,
            updated: 0,
            created: 0,
            errors: [] as string[]
        };

        for (let i = 0; i < body.length; i++) {
            const row = body[i];
            const rowIndex = i + 1; // 1-based index for errors
            
            const cccd = row['Số CCCD']?.toString()?.trim();
            const username = row['Tên đăng nhập hệ thống']?.toString()?.trim();
            const password = row['Mật khẩu mới']?.toString()?.trim();
            const userHIS = row['Tên đăng nhập HIS (userHIS)']?.toString()?.trim();
            const role = row['Vai trò (Role)']?.toString()?.trim();

            if (!cccd) {
                results.errors.push(`Dòng ${rowIndex}: Thiếu Số CCCD`);
                continue;
            }

            // Tìm nhân viên theo CCCD
            const staff = await prisma.staff.findFirst({
                where: { cccd }
            });

            if (!staff) {
                results.errors.push(`Dòng ${rowIndex}: Không tìm thấy nhân viên có CCCD ${cccd}`);
                continue;
            }

            // Tìm user đã liên kết với nhân viên này
            const existingUser = await prisma.user.findFirst({
                where: { staffId: staff.id }
            });

            try {
                if (existingUser) {
                    // Update user
                    // Chỉ cập nhật nếu có userHIS (theo yêu cầu: "nếu có userhis thì mới update nhé")
                    if (userHIS) {
                        const dataToUpdate: any = { userHIS };
                        
                        if (role) dataToUpdate.role = role;
                        if (password) dataToUpdate.password = await bcrypt.hash(password, 10);

                        await prisma.user.update({
                            where: { id: existingUser.id },
                            data: dataToUpdate
                        });
                        results.updated++;
                        results.success++;
                    } else {
                         results.errors.push(`Dòng ${rowIndex}: Bỏ qua vì không có Tên đăng nhập HIS`);
                    }
                } else {
                    // Create new user (Cần có username và role)
                    if (!username || !role) {
                        results.errors.push(`Dòng ${rowIndex}: Nhân viên chưa có tài khoản, yêu cầu phải điền Tên đăng nhập và Vai trò để tạo mới`);
                        continue;
                    }

                    // Check nếu username đã tồn tại
                    const checkUsername = await prisma.user.findUnique({ where: { username } });
                    if (checkUsername) {
                        results.errors.push(`Dòng ${rowIndex}: Tên đăng nhập '${username}' đã tồn tại cho người khác`);
                        continue;
                    }

                    const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('123456', 10);
                    
                    await prisma.user.create({
                        data: {
                            username,
                            password: hashedPassword,
                            name: staff.ho_ten,
                            role,
                            userHIS: userHIS || null,
                            staffId: staff.id,
                            ma_khoa: role === 'KHOA' ? staff.ma_khoa : null
                        }
                    });
                    
                    results.created++;
                    results.success++;
                }
            } catch (err: any) {
                if (err.code === 'P2002') {
                     results.errors.push(`Dòng ${rowIndex}: Trùng lặp dữ liệu (Tên đăng nhập hoặc userHIS đã được dùng)`);
                } else {
                     results.errors.push(`Dòng ${rowIndex}: Lỗi không xác định`);
                }
                console.error(err);
            }
        }

        return NextResponse.json(results);

    } catch (error: any) {
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        console.error('Error bulk updating users:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
