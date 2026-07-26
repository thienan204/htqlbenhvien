import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ValidationEngine, ValidationRule } from '@/lib/validation';
import { fetchMasterDataForRules } from '@/lib/masterData';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { ids, filters } = body;

        let recordIdsToValidate: string[] = [];

        if (ids && Array.isArray(ids) && ids.length > 0) {
            recordIdsToValidate = ids;
        } else if (filters) {
            // Find all matching IDs based on filters
            const { search, fromDate, toDate, errorStatus } = filters;
            let andConditions: any[] = [];

            if (search) {
                if (!search.includes(' ')) {
                    const fuzzyPattern = '%' + search.split('').join('%') + '%';
                    const exactPattern = '%' + search + '%';
                    const matchedRecords = await (prisma as any).$queryRaw`
                        SELECT id FROM "Xml1" 
                        WHERE "MA_LK" ILIKE ${exactPattern} 
                           OR "HO_TEN" ILIKE ${fuzzyPattern}
                    `;
                    const matchedIds = matchedRecords.map((r: any) => r.id);
                    andConditions.push({ id: { in: matchedIds } });
                } else {
                    andConditions.push({
                        OR: [
                            { MA_LK: { contains: search, mode: 'insensitive' } },
                            { HO_TEN: { contains: search, mode: 'insensitive' } }
                        ]
                    });
                }
            }

            if (fromDate && toDate) {
                andConditions.push({
                    NGAY_RA: {
                        gte: fromDate,
                        lte: toDate
                    }
                });
            }

            if (errorStatus === 'ERROR') {
                andConditions.push({ hasError: true });
            } else if (errorStatus === 'VALID') {
                andConditions.push({ hasError: false });
            }

            const whereClause = andConditions.length > 0 ? { AND: andConditions } : {};

            const matchingRecords = await (prisma as any).xml1.findMany({
                where: whereClause,
                select: { id: true }
            });
            recordIdsToValidate = matchingRecords.map((r: any) => r.id);
        }

        if (recordIdsToValidate.length === 0) {
            return NextResponse.json({ success: true, count: 0, message: 'Không có hồ sơ nào cần kiểm tra.' });
        }

        // Fetch all rules
        const rules: ValidationRule[] = await (prisma as any).validationRule.findMany({
            where: { active: true }
        });
        
        const masterData = await fetchMasterDataForRules(rules);
        const engine = new ValidationEngine(rules, masterData);
        let errorCount = 0;

        // Process in chunks to avoid memory issues if there are thousands of records
        const chunkSize = 50;
        for (let i = 0; i < recordIdsToValidate.length; i += chunkSize) {
            const chunk = recordIdsToValidate.slice(i, i + chunkSize);
            
            const xmlRecords = await (prisma as any).xml1.findMany({
                where: { id: { in: chunk } },
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

            for (const record of xmlRecords) {
                // Adapt to HosoRecord format
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

                const results = engine.validate(hosoRecord);
                const hasErrors = results.some((r: any) => r.isError);
                const count = results.filter((r: any) => r.isError).length;

                if (hasErrors) {
                    errorCount++;
                }

                // Update DB with the error status
                await (prisma as any).xml1.update({
                    where: { id: record.id },
                    data: {
                        hasError: hasErrors,
                        errorCount: count
                    }
                });
            }
        }

        return NextResponse.json({ 
            success: true, 
            count: recordIdsToValidate.length,
            errorCount: errorCount,
            message: `Đã kiểm tra ${recordIdsToValidate.length} hồ sơ, phát hiện ${errorCount} hồ sơ có lỗi.`
        });

    } catch (error: any) {
        console.error('Validation Batch Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
