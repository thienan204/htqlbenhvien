import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const isSuperAdmin = user.role === 'ADMIN';
        const isTCCB = user.role === 'TCCB' || (user.ma_khoa && ['TCCB', 'TC_CB', 'P02'].includes(user.ma_khoa.toUpperCase()));
        const isDirector = user.userLevel === 'LEVEL_1_BGD' || user.isDirector;
        const isDeptLeader = Boolean(
            user.userLevel === 'LEVEL_2_LEADER' || 
            user.isDeptLeader || 
            user.isManager
        );
        const isLeader = isSuperAdmin || isTCCB || isDirector || isDeptLeader;

        if (!isLeader) {
            return NextResponse.json({ 
                error: 'Chỉ lãnh đạo khoa/phòng mới có quyền chấm độc hại!' 
            }, { status: 403 });
        }

        const body = await request.json();
        const {
            staffId,
            date, // 'YYYY-MM-DD'
            code, // 'X' | 'I' | '' (delete)
            ma_khoa,
            hazardLevel = 2,
            allowanceRate = 20000,
            note = null
        } = body;

        if (!staffId || !date) {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc (staffId, date)' }, { status: 400 });
        }

        const cleanCode = (code || '').trim().toUpperCase();

        if (!cleanCode) {
            // Xóa bản ghi
            await prisma.staffHazardRecord.deleteMany({
                where: {
                    staffId,
                    workDate: date
                }
            });
            return NextResponse.json({ success: true, message: `Đã xóa chấm độc hại ngày ${date}` });
        }

        // Giá trị quy đổi ngày hưởng: X = 1.0 ngày (>= 4h), I = 0.5 ngày (< 4h)
        const value = cleanCode === 'I' ? 0.5 : 1.0;

        // Đơn giá chuẩn tương ứng với mức:
        const rateMap: Record<number, number> = {
            1: 13000,
            2: 20000,
            3: 26000,
            4: 32000
        };
        const resolvedRate = allowanceRate || rateMap[hazardLevel] || 20000;

        const record = await prisma.staffHazardRecord.upsert({
            where: {
                staffId_workDate: { staffId, workDate: date }
            },
            update: {
                code: cleanCode,
                value,
                hazardLevel: Number(hazardLevel) || 2,
                allowanceRate: resolvedRate,
                note: note || null,
                updatedBy: user.id
            },
            create: {
                staffId,
                ma_khoa: ma_khoa || user.ma_khoa || 'KP046',
                workDate: date,
                code: cleanCode,
                value,
                hazardLevel: Number(hazardLevel) || 2,
                allowanceRate: resolvedRate,
                note: note || null,
                updatedBy: user.id,
                createdBy: user.id
            }
        });

        return NextResponse.json({ success: true, record });

    } catch (error: any) {
        console.error('Lỗi cập nhật ô chấm độc hại:', error);
        return NextResponse.json({ error: error.message || 'Lỗi server nội bộ' }, { status: 500 });
    }
}

