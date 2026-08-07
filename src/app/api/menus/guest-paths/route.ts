import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const guestRole = await prisma.role.findFirst({
            where: { code: 'GUEST' }
        });

        if (!guestRole || !guestRole.permissions) {
            return NextResponse.json([]);
        }

        const permissions = guestRole.permissions as Record<string, any>;
        const allowedPermissionCodes = Object.keys(permissions).filter(code => permissions[code]?.VIEW === true);

        const guestMenus = await prisma.menu.findMany({
            where: {
                permissionCode: { in: allowedPermissionCodes },
                isActive: true
            },
            select: {
                path: true,
                targetPath: true
            }
        });

        const paths = new Set<string>();
        guestMenus.forEach(m => {
            if (m.path) paths.add(m.path);
            if (m.targetPath) paths.add(m.targetPath);
        });

        return NextResponse.json(Array.from(paths), {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
            },
        });
    } catch (error) {
        console.error("Failed to fetch guest paths", error);
        return NextResponse.json([], { status: 500 });
    }
}
