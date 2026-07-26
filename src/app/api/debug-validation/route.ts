import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchMasterDataForRules } from '@/lib/masterData';
import { ValidationEngine } from '@/lib/validation';

export async function GET(req: NextRequest) {
    try {
        const searchParams = new URL(req.url).searchParams;
        const maLk = searchParams.get('ma_lk') || '1549457';

        const record = await (prisma as any).xml1.findFirst({
            where: { MA_LK: maLk },
            include: {
                xml2Records: true,
                xml3Records: true,
                xml4Records: true,
                xml5Records: true,
                xml7Records: true,
                xml8Records: true,
                xml9Records: true,
                xml10Records: true,
                xml11Records: true,
                xml13Records: true,
                xml14Records: true,
                xml15Records: true
            }
        });

        if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const rules = await (prisma as any).validationRule.findMany({ where: { active: true } });
        const masterData = await fetchMasterDataForRules(rules);
        const engine = new ValidationEngine(rules, masterData);

        const groups = [
            { type: 'XML1', data: record },
            { type: 'XML2', data: record.xml2Records || [] },
            { type: 'XML3', data: record.xml3Records || [] },
            { type: 'XML4', data: record.xml4Records || [] },
            { type: 'XML5', data: record.xml5Records || [] },
            { type: 'XML7', data: record.xml7Records || [] },
            { type: 'XML8', data: record.xml8Records || [] },
            { type: 'XML9', data: record.xml9Records || [] },
            { type: 'XML10', data: record.xml10Records || [] },
            { type: 'XML11', data: record.xml11Records || [] },
            { type: 'XML13', data: record.xml13Records || [] },
            { type: 'XML14', data: record.xml14Records || [] },
            { type: 'XML15', data: record.xml15Records || [] }
        ];

        const hosoRecord: any = {
            id: record.MA_LK,
            maLk: record.MA_LK,
            summary: record,
            groups: groups
        };

        const results = engine.validate(hosoRecord);
        const errors = results.filter((r: any) => r.isError);

        return NextResponse.json({
            ma_lk: maLk,
            totalErrors: errors.length,
            errors: errors
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message, stack: e.stack });
    }
}
