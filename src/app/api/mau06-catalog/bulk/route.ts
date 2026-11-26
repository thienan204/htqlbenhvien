import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authorizeMau06Action } from '../_auth';

const prisma = new PrismaClient();

export async function PUT(request: Request) {
    try {
        const auth = await authorizeMau06Action(request, 'EDIT');
        if (auth.errorResponse) return auth.errorResponse;

        const { ids, isActive } = await request.json();
        
        if (!Array.isArray(ids)) {
            return NextResponse.json({ error: 'Invalid input, ids must be an array' }, { status: 400 });
        }

        const result = await prisma.mau06Catalog.updateMany({
            where: { id: { in: ids } },
            data: { isActive }
        });

        return NextResponse.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Error in bulk update:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const auth = await authorizeMau06Action(request, 'DELETE');
        if (auth.errorResponse) return auth.errorResponse;

        const { ids } = await request.json();
        
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Danh sách ID không hợp lệ' }, { status: 400 });
        }

        const result = await prisma.mau06Catalog.deleteMany({
            where: { id: { in: ids } }
        });

        return NextResponse.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Error in bulk delete mau06 catalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
