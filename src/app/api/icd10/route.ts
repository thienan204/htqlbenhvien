import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const chapter = searchParams.get('chapter') || '';
        
        // Boolean filters
        const isNotMain = searchParams.get('is_not_main_disease') === 'true';
        const notRecommendedMain = searchParams.get('not_recommended_main') === 'true';
        const reqSpecific = searchParams.get('requires_more_specific') === 'true';
        const deathCause = searchParams.get('is_death_cause_only') === 'true';
        const femaleOnly = searchParams.get('is_female_only') === 'true';
        const maleOnly = searchParams.get('is_male_only') === 'true';
        const isPhuLuc1TT25 = searchParams.get('is_phu_luc_1_tt25') === 'true';
        const isPhuLuc2TT25 = searchParams.get('is_phu_luc_2_tt25') === 'true';
        const isPhuLuc3TT25 = searchParams.get('is_phu_luc_3_tt25') === 'true';

        // Pagination
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const skip = (page - 1) * limit;

        const where: Prisma.Icd10CatalogWhereInput = {
            isActive: true,
        };

        const andConditions: Prisma.Icd10CatalogWhereInput[] = [];

        if (search) {
            andConditions.push({
                OR: [
                    { ma_chi_tiet: { contains: search, mode: 'insensitive' } },
                    { ten_chi_tiet: { contains: search, mode: 'insensitive' } },
                    { ma_benh: { contains: search, mode: 'insensitive' } }
                ]
            });
        }

        if (chapter) {
            andConditions.push({ ma_chuong: chapter });
        }

        if (isNotMain) andConditions.push({ is_not_main_disease: true });
        if (notRecommendedMain) andConditions.push({ not_recommended_main: true });
        
        if (reqSpecific) {
            const parentGroupCodes = await prisma.icd10Catalog.findMany({
                where: { requires_more_specific: true },
                select: { ma_benh: true },
                distinct: ['ma_benh']
            });
            const maBenhList = parentGroupCodes.map(g => g.ma_benh).filter(Boolean) as string[];
            
            if (maBenhList.length > 0) {
                andConditions.push({
                    OR: [
                        { requires_more_specific: true },
                        { ma_benh: { in: maBenhList } }
                    ]
                });
            } else {
                andConditions.push({ requires_more_specific: true });
            }
        }
        if (deathCause) andConditions.push({ is_death_cause_only: true });
        if (femaleOnly) andConditions.push({ is_female_only: true });
        if (maleOnly) andConditions.push({ is_male_only: true });
        if (isPhuLuc1TT25) andConditions.push({ is_phu_luc_1_tt25: true });
        if (isPhuLuc2TT25) andConditions.push({ is_phu_luc_2_tt25: true });
        if (isPhuLuc3TT25) andConditions.push({ is_phu_luc_3_tt25: true });

        if (andConditions.length > 0) {
            where.AND = andConditions;
        }

        const [total, data] = await Promise.all([
            prisma.icd10Catalog.count({ where }),
            prisma.icd10Catalog.findMany({
                where,
                skip,
                take: limit,
                orderBy: { ma_chi_tiet: 'asc' }
            })
        ]);

        // Find parents that require more specific codes
        const parents = data.filter(d => d.requires_more_specific).map(d => d.ma_chi_tiet);
        if (parents.length > 0) {
            const children = await prisma.icd10Catalog.findMany({
                where: {
                    OR: parents.map(p => ({ ma_chi_tiet: { startsWith: `${p}.` } })),
                    requires_more_specific: false
                },
                select: { ma_chi_tiet: true },
                orderBy: { ma_chi_tiet: 'asc' }
            });
            
            const childrenMap: Record<string, string[]> = {};
            children.forEach(c => {
                const parent = parents.find(p => c.ma_chi_tiet.startsWith(`${p}.`));
                if (parent) {
                    if (!childrenMap[parent]) childrenMap[parent] = [];
                    childrenMap[parent].push(c.ma_chi_tiet);
                }
            });
            
            data.forEach(d => {
                if (d.requires_more_specific && d.ma_chi_tiet && childrenMap[d.ma_chi_tiet]) {
                    (d as any).valid_children = childrenMap[d.ma_chi_tiet];
                }
            });
        }

        return NextResponse.json({
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching ICD10:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
