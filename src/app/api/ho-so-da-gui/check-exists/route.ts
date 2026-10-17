import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { maLienKetList = [], maBnList = [] } = body;

        const cleanMlk = Array.isArray(maLienKetList)
            ? Array.from(new Set(maLienKetList.map((s: any) => String(s).trim()).filter(Boolean)))
            : [];
        const cleanMbn = Array.isArray(maBnList)
            ? Array.from(new Set(maBnList.map((s: any) => String(s).trim()).filter(Boolean)))
            : [];

        if (cleanMlk.length === 0 && cleanMbn.length === 0) {
            return NextResponse.json({ exists: [], existsMaBN: [], details: {} });
        }

        const conditions: any[] = [];
        if (cleanMlk.length > 0) conditions.push({ maLienKet: { in: cleanMlk } });
        if (cleanMbn.length > 0) conditions.push({ maBN: { in: cleanMbn } });

        const existingRecords = await prisma.hoSoDaGui.findMany({
            where: {
                OR: conditions
            },
            select: {
                maLienKet: true,
                maBN: true,
                ngayGuiHS: true,
                trangThaiHS: true,
                trangThaiTT: true
            }
        });

        const exists = Array.from(new Set(existingRecords.map(r => r.maLienKet).filter(Boolean)));
        const existsMaBN = Array.from(new Set(existingRecords.map(r => r.maBN).filter(Boolean)));

        const details: Record<string, any> = {};
        existingRecords.forEach(r => {
            const item = {
                maLienKet: r.maLienKet,
                maBN: r.maBN,
                ngayGuiHS: r.ngayGuiHS,
                trangThaiHS: r.trangThaiHS,
                trangThaiTT: r.trangThaiTT
            };
            if (r.maLienKet) details[r.maLienKet] = item;
            if (r.maBN) details[r.maBN] = item;
        });

        return NextResponse.json({ exists, existsMaBN, details });
    } catch (error: any) {
        console.error('Error checking HoSoDaGui:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
