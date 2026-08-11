import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const config = await prisma.systemConfig.findUnique({
            where: { key: 'MAINTENANCE_MODE' }
        });
        
        const isMaintenance = config?.value === 'true';
        return NextResponse.json({ isMaintenance });
    } catch (error) {
        console.error('Error fetching maintenance config:', error);
        return NextResponse.json({ error: 'Internal Server Error', isMaintenance: false }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { value } = await request.json();
        const isMaintenance = value === true || value === 'true';
        
        const config = await prisma.systemConfig.upsert({
            where: { key: 'MAINTENANCE_MODE' },
            update: { value: String(isMaintenance) },
            create: { key: 'MAINTENANCE_MODE', value: String(isMaintenance), description: 'Chế độ bảo trì hệ thống' }
        });

        return NextResponse.json(config);
    } catch (error) {
        console.error('Error updating maintenance config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
