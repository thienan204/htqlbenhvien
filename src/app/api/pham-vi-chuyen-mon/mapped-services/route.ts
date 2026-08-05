import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const ma_pham_vi = searchParams.get('ma_pham_vi');

        if (!ma_pham_vi) {
            return NextResponse.json({ error: 'ma_pham_vi is required' }, { status: 400 });
        }

        const mappings = await prisma.scopeServiceMapping.findMany({
            where: { ma_pham_vi },
            select: { ma_dich_vu: true }
        });

        const maDichVuList = mappings.map(m => m.ma_dich_vu);

        if (maDichVuList.length === 0) {
            return NextResponse.json([]);
        }

        const services = await prisma.mau05Catalog.findMany({
            where: {
                MA_DICH_VU: {
                    in: maDichVuList
                }
            },
            select: {
                id: true,
                MA_DICH_VU: true,
                TEN_DICH_VU: true,
                TEN_DVKT_GIA: true,
                DON_GIA: true
            }
        });

        return NextResponse.json(services);
    } catch (error) {
        console.error('Error fetching mapped services:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
