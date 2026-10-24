import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        let pagePath = searchParams.get('pagePath');

        if (!pagePath) {
            const allLogs = await (prisma as any).featureChangeLog.findMany({
                orderBy: { appliedAt: 'desc' },
                take: 100
            });
            return NextResponse.json({ success: true, data: allLogs });
        }

        // Normalize path
        if (pagePath.startsWith('/htqlbenhvien')) {
            pagePath = pagePath.replace('/htqlbenhvien', '');
        }
        if (!pagePath.startsWith('/')) {
            pagePath = `/${pagePath}`;
        }

        const logs = await (prisma as any).featureChangeLog.findMany({
            where: { pagePath },
            orderBy: { appliedAt: 'desc' }
        });

        return NextResponse.json({ success: true, data: logs });
    } catch (error: any) {
        console.error('Error fetching feature changelogs:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ success: false, error: 'Unauthorized: Quyền Admin cần thiết' }, { status: 403 });
        }

        const body = await req.json();
        let { pagePath, version, title, changeType, status, content, reason, author, documentUrl } = body;

        if (!pagePath || !title || !content) {
            return NextResponse.json({ success: false, error: 'Vui lòng cung cấp pagePath, tiêu đề và nội dung thay đổi' }, { status: 400 });
        }

        // Normalize path
        if (pagePath.startsWith('/htqlbenhvien')) {
            pagePath = pagePath.replace('/htqlbenhvien', '');
        }
        if (!pagePath.startsWith('/')) {
            pagePath = `/${pagePath}`;
        }

        const newLog = await (prisma as any).featureChangeLog.create({
            data: {
                pagePath,
                version: version || 'v1.0.0',
                title,
                changeType: changeType || 'UPDATE',
                status: status || 'TESTING', // 'TESTING' | 'OFFICIAL'
                content,
                reason: reason || null,
                author: author || user.name || user.username || 'Phòng CNTT',
                documentUrl: documentUrl || null,
                appliedAt: new Date()
            }
        });

        return NextResponse.json({ success: true, data: newLog });
    } catch (error: any) {
        console.error('Error creating feature changelog:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { id, status, content, reason, title, version } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Thiếu id bản ghi' }, { status: 400 });
        }

        const updated = await (prisma as any).featureChangeLog.update({
            where: { id },
            data: {
                ...(status !== undefined && { status }),
                ...(content !== undefined && { content }),
                ...(reason !== undefined && { reason }),
                ...(title !== undefined && { title }),
                ...(version !== undefined && { version }),
                updatedAt: new Date()
            }
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error: any) {
        console.error('Error updating feature changelog:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
