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

        // Ensure no empty strings for optional fields
        if (data.permissionCode === '') data.permissionCode = null;
        if (data.path === '') data.path = null;
        if (data.targetPath === '') data.targetPath = null;
        if (data.icon === '') data.icon = null;
        if (data.parentId === '') data.parentId = null;
        if (data.isSpecialGroup === '') data.isSpecialGroup = null;

        const updatedMenu = await prisma.menu.update({
            where: { id },
            data: {
                title: data.title,
                path: data.path,
                targetPath: data.targetPath,
                icon: data.icon,
                parentId: data.parentId,
                order: data.order,
                permissionCode: data.permissionCode,
                isActive: data.isActive,
                isAdminOnly: data.isAdminOnly !== undefined ? Boolean(data.isAdminOnly) : false,
                isSpecialGroup: data.isSpecialGroup,
                showInPaths: data.showInPaths || [],
            }
        });
        
        return NextResponse.json(updatedMenu);
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

        // Xoá cả menu con (nếu có)
        await prisma.menu.deleteMany({
            where: { parentId: id }
        });

        await prisma.menu.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
