import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const ma_may = searchParams.get('ma_may');
        
        let whereClause = {};
        if (ma_may) {
            whereClause = { ma_may, den_ngay: null }; // Lấy khoa hiện tại đang sử dụng
        } else {
            whereClause = { den_ngay: null };
        }

        const locations = await prisma.machineLocationHistory.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });
        
        return NextResponse.json(locations);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ma_may, ma_khoa } = body;

        if (!ma_may || !ma_khoa) {
            return NextResponse.json({ error: 'Thiếu thông tin Mã máy hoặc Mã khoa' }, { status: 400 });
        }

        // Đóng tất cả các phiên sử dụng hiện tại của máy này
        await prisma.machineLocationHistory.updateMany({
            where: { ma_may, den_ngay: null },
            data: { den_ngay: new Date() }
        });

        // Tạo phiên sử dụng mới
        const newLocation = await prisma.machineLocationHistory.create({
            data: {
                ma_may,
                ma_khoa,
                tu_ngay: new Date(),
                den_ngay: null
            }
        });

        return NextResponse.json(newLocation);
    } catch (error: any) {
        console.error('Lỗi khi phân bổ máy:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
