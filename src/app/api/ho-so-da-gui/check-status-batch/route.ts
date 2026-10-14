import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { maLienKetList } = body;

        if (!Array.isArray(maLienKetList) || maLienKetList.length === 0) {
            return NextResponse.json({ 
                results: {}, 
                summary: { totalChecked: 0, totalDaDeNghiTT: 0, totalChuaDeNghiTT: 0 } 
            });
        }

        const cleanList = Array.from(new Set(maLienKetList.map(s => String(s).trim()).filter(Boolean)));

        const existingRecords = await prisma.hoSoDaGui.findMany({
            where: {
                maLienKet: {
                    in: cleanList
                }
            },
            select: {
                maLienKet: true,
                maBN: true,
                hoTen: true,
                ngayRa: true,
                ngayDeNghiTT: true,
                trangThaiTT: true,
                trangThaiHS: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const resultMap: Record<string, any> = {};
        let totalDaDeNghiTT = 0;

        // Group by maLienKet (get the most recent one)
        existingRecords.forEach(rec => {
            if (!resultMap[rec.maLienKet]) {
                const isDaDeNghiTT = Boolean(
                    (rec.ngayDeNghiTT && rec.ngayDeNghiTT.trim() !== '') ||
                    (rec.trangThaiTT && /đề nghị thanh toán|đã thanh toán|quyết toán/i.test(rec.trangThaiTT))
                );

                if (isDaDeNghiTT) totalDaDeNghiTT++;

                resultMap[rec.maLienKet] = {
                    exists: true,
                    daDeNghiTT: isDaDeNghiTT,
                    ngayDeNghiTT: rec.ngayDeNghiTT || null,
                    trangThaiTT: rec.trangThaiTT || null,
                    trangThaiHS: rec.trangThaiHS || null,
                    maBN: rec.maBN || null,
                    hoTen: rec.hoTen || null
                };
            }
        });

        // Fill non-existent
        cleanList.forEach(mlk => {
            if (!resultMap[mlk]) {
                resultMap[mlk] = {
                    exists: false,
                    daDeNghiTT: false,
                    ngayDeNghiTT: null,
                    trangThaiTT: 'Chưa có trên Cổng',
                    trangThaiHS: 'Chưa gửi cổng',
                    maBN: null,
                    hoTen: null
                };
            }
        });

        return NextResponse.json({
            results: resultMap,
            summary: {
                totalChecked: cleanList.length,
                totalDaDeNghiTT,
                totalChuaDeNghiTT: cleanList.length - totalDaDeNghiTT
            }
        });
    } catch (error: any) {
        console.error('Lỗi check-status-batch:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
