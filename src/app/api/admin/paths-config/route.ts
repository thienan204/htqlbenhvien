import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'data', 'admin-paths.json');

import prisma from '@/lib/prisma';

export async function GET() {
    try {
        let filePaths: string[] = [];
        try {
            const fileContent = await fs.readFile(configPath, 'utf-8');
            filePaths = JSON.parse(fileContent);
        } catch (e) {
            console.error('Error reading admin-paths.json:', e);
        }

        // Tự động lấy tất cả các menu được đánh dấu là Quản trị từ Database
        let dbAdminPaths: string[] = [];
        try {
            const adminMenus = await prisma.menu.findMany({
                where: { isAdminOnly: true, isActive: true },
                select: { path: true }
            });
            dbAdminPaths = adminMenus.map(m => m.path).filter((p): p is string => Boolean(p && p.trim() !== '' && p !== '/'));
        } catch (e) {
            console.error('Error fetching admin menus from db:', e);
        }

        const combinedPaths = Array.from(new Set([...filePaths, ...dbAdminPaths]));
        return NextResponse.json(combinedPaths);
    } catch (error) {
        console.error('Error in GET paths-config:', error);
        return NextResponse.json({ error: 'Failed to read config' }, { status: 500 });
    }
}

import { getCurrentUser } from '@/actions/auth';

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const paths = await request.json();
        
        if (!Array.isArray(paths)) {
            return NextResponse.json({ error: 'Invalid data format. Expected an array of strings.' }, { status: 400 });
        }

        await fs.writeFile(configPath, JSON.stringify(paths, null, 4), 'utf-8');
        
        return NextResponse.json({ success: true, message: 'Configuration saved successfully.' });
    } catch (error) {
        console.error('Error writing admin-paths.json:', error);
        return NextResponse.json({ error: 'Failed to write config' }, { status: 500 });
    }
}
