import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
    const cats = await prisma.systemCategory.findMany({
        distinct: ['type'],
        select: { type: true }
    });
    return NextResponse.json(cats);
}
