import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const hsGroups = await prisma.hoSoDaGui.groupBy({
            by: ['trangThaiHS'],
            where: { trangThaiHS: { not: '' } }
        });

        const ttGroups = await prisma.hoSoDaGui.groupBy({
            by: ['trangThaiTT'],
            where: { trangThaiTT: { not: '' } }
        });

        return NextResponse.json({
            success: true,
            data: {
                trangThaiHS: hsGroups.map(g => g.trangThaiHS).filter(Boolean),
                trangThaiTT: ttGroups.map(g => g.trangThaiTT).filter(Boolean),
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
