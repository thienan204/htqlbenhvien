import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const refsParam = searchParams.get('refs');
        if (!refsParam) return NextResponse.json({});

        const refs = refsParam.split(',').filter(Boolean);
        const result: Record<string, string[]> = {};

        for (const ref of refs) {
            if (ref === 'Mau05_PRICE_MAP') {
                try {
                    const data = await prisma.mau05Catalog.findMany({
                        select: { MA_DICH_VU: true, DON_GIA: true }
                    });
                    result[ref] = data
                        .filter((d: any) => d.MA_DICH_VU !== null && d.MA_DICH_VU !== undefined)
                        .map((d: any) => `${d.MA_DICH_VU}:::${d.DON_GIA}`);
                } catch (err: any) {
                    console.error('Error fetching Mau05_PRICE_MAP:', err.message);
                }
                continue;
            }
            
            if (ref === 'BedCatalog.MaKhoa_MaGiuong') {
                try {
                    const data = await prisma.bedCatalog.findMany({
                        select: { ma_khoa: true, ma_giuong: true }
                    });
                    result[ref] = data
                        .filter((d: any) => d.ma_khoa && d.ma_giuong)
                        .map((d: any) => `${d.ma_khoa}_${d.ma_giuong}`);
                } catch (err: any) {
                    console.error('Error fetching BedCatalog.MaKhoa_MaGiuong:', err.message);
                }
                continue;
            }

            const [table, column] = ref.split('.');
            if (!table || !column) continue;

            const modelName = table.charAt(0).toLowerCase() + table.slice(1);
            if (typeof (prisma as any)[modelName] !== 'object') continue;

            try {
                if (column.includes(':')) {
                    const [keyCol, valCol] = column.split(':');
                    
                    if (valCol.includes('.')) {
                        const [relName, relCol] = valCol.split('.');
                        const data = await (prisma as any)[modelName].findMany({
                            select: { 
                                [keyCol]: true, 
                                [relName]: { select: { [relCol]: true } } 
                            }
                        });
                        result[ref] = data
                            .filter((d: any) => d[keyCol] !== null && d[keyCol] !== undefined && d[relName] !== null && d[relName] !== undefined)
                            .map((d: any) => `${d[keyCol]}:::${d[relName][relCol]}`);
                    } else {
                        const data = await (prisma as any)[modelName].findMany({
                            select: { [keyCol]: true, [valCol]: true }
                        });
                        
                        result[ref] = data
                            .filter((d: any) => d[keyCol] !== null && d[keyCol] !== undefined)
                            .map((d: any) => `${d[keyCol]}:::${d[valCol]}`);
                    }
                } else {
                    const data = await (prisma as any)[modelName].findMany({
                        select: { [column]: true }
                    });
                    
                    // map values, filter nulls, and ensure they are strings
                    result[ref] = data
                        .map((d: any) => d[column])
                        .filter((v: any) => v !== null && v !== undefined)
                        .map(String);
                }
            } catch (err: any) {
                console.error(`Error fetching dynamic master data for ${table}.${column}:`, err.message);
                // Continue to next ref
            }
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error in dynamic master API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
