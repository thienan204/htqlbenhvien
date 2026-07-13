import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, props: { params: Promise<{ maLienKet: string }> }) {
    try {
        const params = await props.params;
        const maLienKet = params.maLienKet;

        const records = await prisma.hoSoDaGui.findMany({
            where: { maLienKet },
            orderBy: { createdAt: 'asc' } // Sắp xếp cũ đến mới
        });

        return NextResponse.json({
            success: true,
            data: records
        });
    } catch (error: any) {
        console.error('Lỗi khi lấy lịch sử hồ sơ:', error);
        return NextResponse.json(
            { error: 'Có lỗi xảy ra: ' + error.message },
            { status: 500 }
        );
    }
}
