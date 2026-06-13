import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export async function PUT(req: Request, context: any) {
    const { params } = context;
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const data = await req.json();
        const resolvedParams = await params;
        const id = resolvedParams.id;

        const updatedCard = await prisma.dashboardCard.update({
            where: { id },
            data: {
                title: data.title,
                description: data.description,
                icon: data.icon,
                href: data.href,
                bgColor: data.bgColor,
                borderColor: data.borderColor,
                hoverColor: data.hoverColor,
                order: data.order,
                isActive: data.isActive,
            }
        });
        
        return NextResponse.json(updatedCard);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, context: any) {
    const { params } = context;
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const resolvedParams = await params;
        const id = resolvedParams.id;

        await prisma.dashboardCard.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
