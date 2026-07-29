import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(request: Request) {
    try {
        const { ids, isActive } = await request.json();
        
        if (!Array.isArray(ids)) {
            return NextResponse.json({ error: 'Invalid input, ids must be an array' }, { status: 400 });
        }

        const result = await prisma.mau02Catalog.updateMany({
            where: { id: { in: ids } },
            data: { isActive }
        });

        return NextResponse.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Error in bulk update:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
