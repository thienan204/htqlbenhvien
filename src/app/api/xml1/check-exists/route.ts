import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { maLkList: rawMaLkList, items } = body;

        // Nếu có items kèm checksum (chế độ kiểm tra sâu nội dung)
        if (Array.isArray(items) && items.length > 0) {
            const maLkList = items.map((i: any) => String(i.maLk)).filter(Boolean);
            
            const existingRecords = await (prisma as any).xml1.findMany({
                where: {
                    MA_LK: {
                        in: maLkList
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                select: {
                    MA_LK: true,
                    checksum: true
                }
            });

            // Map MA_LK -> latest checksum trong DB
            const latestChecksumMap = new Map<string, string>();
            for (const r of existingRecords) {
                if (r.MA_LK && !latestChecksumMap.has(r.MA_LK)) {
                    latestChecksumMap.set(r.MA_LK, r.checksum || '');
                }
            }

            const unchanged: string[] = [];
            const changed: string[] = [];
            const newRecords: string[] = [];

            for (const item of items) {
                const maLk = String(item.maLk);
                const itemChecksum = String(item.checksum || '');

                if (!latestChecksumMap.has(maLk)) {
                    newRecords.push(maLk);
                } else if (latestChecksumMap.get(maLk) === itemChecksum) {
                    unchanged.push(maLk);
                } else {
                    changed.push(maLk);
                }
            }

            return NextResponse.json({
                exists: Array.from(latestChecksumMap.keys()),
                total: items.length,
                unchangedCount: unchanged.length,
                changedCount: changed.length,
                newCount: newRecords.length,
                unchanged,
                changed,
                new: newRecords
            });
        }

        // Chế độ tương thích ngược (chỉ truyền maLkList)
        const maLkList = Array.isArray(rawMaLkList) ? rawMaLkList : [];
        if (maLkList.length === 0) {
            return NextResponse.json({ exists: [], unchangedCount: 0, changedCount: 0, newCount: 0 });
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

        return NextResponse.json({ 
            exists: uniqueExists,
            total: maLkList.length,
            unchangedCount: uniqueExists.length,
            changedCount: 0,
            newCount: maLkList.length - uniqueExists.length
        });
    } catch (error: any) {
        console.error('Error checking Xml1 exists:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
