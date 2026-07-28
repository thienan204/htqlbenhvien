import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { maLkList } = body;

        if (!Array.isArray(maLkList) || maLkList.length === 0) {
            return NextResponse.json({ exists: [] });
        }

        const existingRecords = await (prisma as any).xml1.findMany({
            where: {
                MA_LK: {
                    in: maLkList
                }
            },
            select: {
                MA_LK: true
            }
        });

        const exists = existingRecords.map((r: any) => r.MA_LK);
        const uniqueExists = Array.from(new Set(exists));

        return NextResponse.json({ exists: uniqueExists });
    } catch (error: any) {
        console.error('Error checking Xml1 exists:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
