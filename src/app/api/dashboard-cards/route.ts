import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export async function GET() {
    try {
        const cards = await prisma.dashboardCard.findMany({
            orderBy: { order: 'asc' },
        });
        return NextResponse.json(cards);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const data = await req.json();

        const newCard = await prisma.dashboardCard.create({
            data: {
                title: data.title,
                description: data.description,
                icon: data.icon,
                href: data.href,
                bgColor: data.bgColor,
                borderColor: data.borderColor,
                hoverColor: data.hoverColor,
                order: data.order || 0,
                isActive: data.isActive !== undefined ? data.isActive : true,
            }
        });
        
        return NextResponse.json(newCard);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Batch update for reordering / drag and drop
export async function PUT(req: Request) {
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const data = await req.json();
        
        if (Array.isArray(data)) {
            // Batch update
            for (const item of data) {
                await prisma.dashboardCard.update({
                    where: { id: item.id },
                    data: {
                        order: item.order,
                    }
                });
            }
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid data format, expected array of {id, order}' }, { status: 400 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
