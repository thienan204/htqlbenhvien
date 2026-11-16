import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(request: Request) {
    try {
        const { ids, isActive, bat_buoc_co_ma_may } = await request.json();
        
        if (!Array.isArray(ids)) {
            return NextResponse.json({ error: 'Invalid input, ids must be an array' }, { status: 400 });
        }

        const updateData: any = {};
        if (isActive !== undefined) updateData.isActive = Boolean(isActive);
        if (bat_buoc_co_ma_may !== undefined) updateData.bat_buoc_co_ma_may = Boolean(bat_buoc_co_ma_may);

        const result = await prisma.mau05Catalog.updateMany({
            where: { id: { in: ids } },
            data: updateData
        });

        return NextResponse.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Error in bulk update:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
