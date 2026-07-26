import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchMasterDataForRules } from '@/lib/masterData';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Fetch XML1 and all related XML2..15
        const includeQueries: any = {};
        for (let i = 2; i <= 15; i++) {
            includeQueries[`xml${i}Records`] = true;
        }

        const data = await (prisma as any).xml1.findUnique({
            where: { id },
            include: includeQueries
        });

        if (!data) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        // Run validation
        let validationErrors: any[] = [];
        try {
            const rules = await (prisma as any).validationRule.findMany({ where: { active: true } });
            if (rules.length > 0) {
                const { ValidationEngine } = await import('@/lib/validation');
                const masterData = await fetchMasterDataForRules(rules);
                const engine = new ValidationEngine(rules, masterData);
                
                const groups = [
                    { type: 'XML1', data: data },
                    { type: 'XML2', data: data.xml2Records || [] },
                    { type: 'XML3', data: (data.xml3Records || []).map((x: any) => ({ ...x, MA_VAT_TU: x.MAVATTU })) },
                    { type: 'XML4', data: data.xml4Records || [] },
                    { type: 'XML5', data: data.xml5Records || [] },
                    { type: 'XML7', data: data.xml7Records || [] },
                    { type: 'XML8', data: data.xml8Records || [] },
                    { type: 'XML9', data: data.xml9Records || [] },
                    { type: 'XML10', data: data.xml10Records || [] },
                    { type: 'XML11', data: data.xml11Records || [] },
                    { type: 'XML13', data: data.xml13Records || [] },
                    { type: 'XML14', data: data.xml14Records || [] },
                    { type: 'XML15', data: data.xml15Records || [] }
                ];
                
                const hosoRecord: any = {
                    id: data.MA_LK,
                    maLk: data.MA_LK,
                    summary: data,
                    groups: groups
                };

                validationErrors = engine.validate(hosoRecord).filter((r: any) => r.isError);
            }
        } catch (e) {
            console.error('Error running validation for details:', e);
        }

        return NextResponse.json({ data: { ...data, validationErrors } });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
