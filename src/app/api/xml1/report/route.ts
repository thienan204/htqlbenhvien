import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchMasterDataForRules } from '@/lib/masterData';
import { ValidationEngine } from '@/lib/validation';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { ids, filters } = body;
        
        let records = [];
        
        if (ids && ids.length > 0) {
            records = await (prisma as any).xml1.findMany({
                where: { id: { in: ids } },
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
                    xml15Records: true,
                }
            });
        } else if (filters) {
            const { search, fromDate, toDate, errorStatus } = filters;
            let where: any = {};
            if (search) {
                where.OR = [
                    { MA_LK: { contains: search } },
                    { HO_TEN: { contains: search } },
                    { MA_BN: { contains: search } }
                ];
            }
            if (fromDate && toDate) {
                where.NGAY_RA = { gte: fromDate, lte: toDate };
            }
            if (errorStatus === 'ERROR') where.hasError = true;
            if (errorStatus === 'VALID') where.hasError = false;

            records = await (prisma as any).xml1.findMany({
                where,
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
                    xml15Records: true,
                }
            });
        }

        if (records.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        // Fetch master data and initialize engine
        const rules = await (prisma as any).validationRule.findMany({ where: { active: true } });
        const masterData = await fetchMasterDataForRules(rules);
        const engine = new ValidationEngine(rules, masterData);
        
        let allErrors: any[] = [];

        for (const record of records) {
            const groups = [
                { type: 'XML1', data: record },
                { type: 'XML2', data: record.xml2Records || [] },
                { type: 'XML3', data: (record.xml3Records || []).map((x: any) => ({ ...x, MA_VAT_TU: x.MAVATTU })) },
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

            const results = engine.validate(hosoRecord).filter((r: any) => r.isError);
            
            results.forEach((r: any) => {
                let ngay_yl = '';
                let ngay_th_yl = '';
                let ngay_kq = '';
                
                if (r.xmlType === 'XML3' && r.index !== undefined) {
                    const xml3Data = groups.find(g => g.type === 'XML3')?.data || [];
                    const row = xml3Data[r.index];
                    if (row) {
                        ngay_yl = row.NGAY_YL || '';
                        ngay_th_yl = row.NGAY_TH_YL || '';
                        ngay_kq = row.NGAY_KQ || '';
                    }
                }

                allErrors.push({
                    ma_lk: record.MA_LK,
                    ma_bn: record.MA_BN,
                    ho_ten: record.HO_TEN,
                    ngay_vao: record.NGAY_VAO || '',
                    ngay_ra: record.NGAY_RA || '',
                    ngay_yl: ngay_yl,
                    ngay_th_yl: ngay_th_yl,
                    ngay_kq: ngay_kq,
                    ...r
                });
            });
        }

        return NextResponse.json({ success: true, data: allErrors });
    } catch (error: any) {
        console.error('Error in /api/xml1/report:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
