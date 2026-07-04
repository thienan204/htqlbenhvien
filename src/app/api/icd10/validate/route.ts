import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const codes: string[] = body.codes || [];
        
        if (!codes || codes.length === 0) {
            return NextResponse.json({ data: {} });
        }

        // Unique codes
        const uniqueCodes = Array.from(new Set(codes));

        // Find these codes in DB
        const catalogData = await prisma.icd10Catalog.findMany({
            where: {
                ma_chi_tiet: { in: uniqueCodes }
            }
        });

        const codeMap: Record<string, any> = {};
        
        // Mark found codes
        catalogData.forEach(item => {
            codeMap[item.ma_chi_tiet] = {
                found: true,
                ...item
            };
        });

        // Mark missing codes
        uniqueCodes.forEach(code => {
            if (!codeMap[code]) {
                codeMap[code] = { found: false };
            }
        });

        return NextResponse.json({ data: codeMap });
    } catch (error) {
        console.error('Error validating ICD10 codes:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
