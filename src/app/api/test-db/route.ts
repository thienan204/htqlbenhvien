import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-07-30';
    const maKhoa = searchParams.get('maKhoa') || 'K16';

    const targetDate = new Date(date);
    const targetStartOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const targetEndOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    const locationHistories = await prisma.machineLocationHistory.findMany({
        where: {
            ma_khoa: maKhoa,
            AND: [
                { OR: [{ tu_ngay: null }, { tu_ngay: { lte: targetEndOfDay } }] },
                { OR: [{ den_ngay: null }, { den_ngay: { gte: targetStartOfDay } }] }
            ]
        }
    });

    const activeMachineCodesInDept = locationHistories.map((h: any) => h.ma_may);

    const availableMachines = await prisma.mau06Catalog.findMany({
        where: {
            MA_MAY: { in: activeMachineCodesInDept },
            isActive: true
        }
    });

    const allLocations = await prisma.machineLocationHistory.findMany();

    return NextResponse.json({
        targetStartOfDay,
        targetEndOfDay,
        locationHistories,
        activeMachineCodesInDept,
        availableMachines,
        allLocations
    });
}
