import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export async function GET() {
    try {
        const user = await getCurrentUser();
        const cards = await prisma.dashboardCard.findMany({
            orderBy: { order: 'asc' },
        });

        if (user?.role === 'ADMIN') {
            return NextResponse.json(cards);
        }

        const userRole = user?.role || 'GUEST';

        const filteredCards = cards.filter(card => {
            // Nếu allowedRoles rỗng -> Hiển thị cho tất cả mọi người
            if (!card.allowedRoles || card.allowedRoles.length === 0) {
                return true;
            }

            // Nếu có cấu hình danh sách roles -> Kiểm tra xem role của user có nằm trong danh sách không
            return card.allowedRoles.includes(userRole);
        });

        return NextResponse.json(filteredCards);
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
                allowedRoles: Array.isArray(data.allowedRoles) ? data.allowedRoles : [],
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
