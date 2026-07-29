import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const menus = await prisma.menu.findMany({
            orderBy: [
                { parentId: 'asc' },
                { order: 'asc' },
            ],
        });
        return NextResponse.json(menus);
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
        
        // Ensure no empty strings for optional fields
        if (data.permissionCode === '') data.permissionCode = null;
        if (data.path === '') data.path = null;
        if (data.targetPath === '') data.targetPath = null;
        if (data.icon === '') data.icon = null;
        if (data.parentId === '') data.parentId = null;
        if (data.isSpecialGroup === '') data.isSpecialGroup = null;

        const newMenu = await prisma.menu.create({
            data: {
                title: data.title,
                path: data.path,
                targetPath: data.targetPath,
                icon: data.icon,
                parentId: data.parentId,
                order: data.order || 0,
                permissionCode: data.permissionCode,
                isActive: data.isActive !== undefined ? data.isActive : true,
                isSpecialGroup: data.isSpecialGroup,
                showInPaths: data.showInPaths || [],
            }
        });
        
        return NextResponse.json(newMenu);
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
                await prisma.menu.update({
                    where: { id: item.id },
                    data: {
                        parentId: item.parentId,
                        order: item.order,
                    }
                });
            }
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid data format, expected array of {id, parentId, order}' }, { status: 400 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
