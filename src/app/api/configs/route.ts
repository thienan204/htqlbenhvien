import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const config = await prisma.systemConfig.findUnique({
            where: { key: 'MR_EDIT_DEADLINE_DAYS' }
        });
        
        // Return default value 3 if not configured
        return NextResponse.json({ value: config ? parseInt(config.value) : 3 });
    } catch (error) {
        console.error('Error fetching config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { value } = await request.json();
        
        const config = await prisma.systemConfig.upsert({
            where: { key: 'MR_EDIT_DEADLINE_DAYS' },
            update: { value: String(value) },
            create: { key: 'MR_EDIT_DEADLINE_DAYS', value: String(value), description: 'Số ngày hạn sửa bệnh án' }
        });

        return NextResponse.json(config);
    } catch (error) {
        console.error('Error updating config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
