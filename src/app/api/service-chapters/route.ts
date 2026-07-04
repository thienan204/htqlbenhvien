import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const chapters = await prisma.serviceChapter.findMany({
            orderBy: {
                code: 'asc'
            }
        });
        return NextResponse.json(chapters);
    } catch (error) {
        console.error('Error fetching service chapters:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { code, name } = body;

        if (!code || !name) {
            return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
        }

        const updated = await prisma.serviceChapter.update({
            where: { code },
            data: { name }
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Error updating service chapter:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
