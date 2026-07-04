import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        // Fetch all staff members who do not have an associated User account
        const staffWithoutUsers = await prisma.staff.findMany({
            where: {
                user: null
            }
        });

        if (staffWithoutUsers.length === 0) {
            return NextResponse.json({ message: 'Tất cả nhân sự đều đã có tài khoản User.', count: 0 });
        }

        // Fetch existing usernames to avoid conflicts
        const existingUsers = await prisma.user.findMany({
            select: { username: true }
        });
        const existingUsernames = new Set(existingUsers.map(u => u.username));

        const hashedPassword = await bcrypt.hash('123456', 10);
        let createdCount = 0;
        let failedCount = 0;

        // Process in a transaction for better performance if possible, or sequential to handle errors
        for (const staff of staffWithoutUsers) {
            let proposedUsername = staff.cccd || staff.ma_nv;
            
            // Ensure unique username
            let finalUsername = proposedUsername;
            let counter = 1;
            while (existingUsernames.has(finalUsername)) {
                finalUsername = `${proposedUsername}_${counter}`;
                counter++;
            }
            existingUsernames.add(finalUsername);

            try {
                await prisma.user.create({
                    data: {
                        username: finalUsername,
                        password: hashedPassword,
                        name: staff.ho_ten,
                        role: 'KHOA_PHONG',
                        ma_khoa: staff.ma_khoa,
                        staffId: staff.id
                    }
                });
                createdCount++;
            } catch (err) {
                console.error(`Lỗi tạo user cho staff ${staff.ma_nv}:`, err);
                failedCount++;
            }
        }

        return NextResponse.json({ 
            message: `Tạo thành công ${createdCount} tài khoản. Thất bại: ${failedCount}.`,
            count: createdCount,
            failed: failedCount
        });

    } catch (error: any) {
        console.error('Error auto-generating users:', error);
        return NextResponse.json({ error: error.message || 'Lỗi máy chủ nội bộ' }, { status: 500 });
    }
}
