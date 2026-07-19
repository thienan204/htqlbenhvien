import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { maLienKetList } = body;

        if (!Array.isArray(maLienKetList) || maLienKetList.length === 0) {
            return NextResponse.json({ exists: [] });
        }

        const existingRecords = await prisma.hoSoDaGui.findMany({
            where: {
                maLienKet: {
                    in: maLienKetList
                }
            },
            select: {
                maLienKet: true
            }
        });

        const exists = existingRecords.map(r => r.maLienKet);

        return NextResponse.json({ exists });
    } catch (error: any) {
        console.error('Error checking HoSoDaGui:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
