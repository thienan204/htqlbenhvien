import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const chapters = await prisma.icd10Catalog.findMany({
            select: { ma_chuong: true, ten_chuong: true, fullData: true },
            distinct: ['ma_chuong'],
            orderBy: { ma_chuong: 'asc' }
        });

        // Tùy chỉnh sắp xếp theo số La Mã (I, II, III...)
        const romanToInt = (s: string) => {
            const roman: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
            let ans = 0;
            for (let i = s.length - 1; i >= 0; i--) {
                const char = s[i].toUpperCase();
                const num = roman[char];
                if (!num) continue;
                if (4 * num < ans) ans -= num;
                else ans += num;
            }
            return ans;
        };

        const sorted = chapters.sort((a, b) => {
            if (!a.ma_chuong) return 1;
            if (!b.ma_chuong) return -1;
            return romanToInt(a.ma_chuong) - romanToInt(b.ma_chuong);
        });

        const formattedChapters = sorted.map(c => {
            let chapterRange = '';
            if (c.fullData && typeof c.fullData === 'object' && 'PHẠM VI MÃ NHÓM BỆNH' in c.fullData) {
                chapterRange = (c.fullData as any)['PHẠM VI MÃ NHÓM BỆNH'];
            }
            return {
                ma_chuong: c.ma_chuong,
                ten_chuong: c.ten_chuong,
                ma_nhom: chapterRange
            };
        });

        return NextResponse.json({ data: formattedChapters });
    } catch (error) {
        console.error('Error fetching ICD10 chapters:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
