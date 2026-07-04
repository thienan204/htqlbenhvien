import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '50');
        const search = searchParams.get('search') || '';
        const category = searchParams.get('category') || '';

        const where: any = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { group_name: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (category) {
            where.category_name = category;
        }

        const [data, total, data2] = await Promise.all([
            prisma.tT32ServiceCatalog.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { id: 'asc' }
            }),
            prisma.tT32ServiceCatalog.count({ where }),
            prisma.tT32ServiceCatalog.findMany({
                select: { category_name: true },
                distinct: ['category_name']
            })
        ]);

        const distinctCategories = data2.map(c => c.category_name);

        return NextResponse.json({ data, total, page, pageSize, distinctCategories });
    } catch (error) {
        console.error('Error fetching TT32 catalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
