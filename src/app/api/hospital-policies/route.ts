import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const onlyActive = searchParams.get('onlyActive') === 'true';
        const key = searchParams.get('key');
        const id = searchParams.get('id');
        const search = searchParams.get('search');

        if (key) {
            const policy = await (prisma as any).hospitalPolicy.findUnique({
                where: { qrCodeKey: key }
            });
            return NextResponse.json({ success: true, data: policy });
        }

        if (id) {
            const policy = await (prisma as any).hospitalPolicy.findUnique({
                where: { id }
            });
            return NextResponse.json({ success: true, data: policy });
        }

        const where: any = {};

        if (onlyActive) {
            where.isActive = true;
            where.OR = [
                { endDate: null },
                { endDate: { gte: new Date() } }
            ];
        }

        if (search && search.trim() !== '') {
            const s = search.trim();
            where.AND = [
                ...(where.AND || []),
                {
                    OR: [
                        { title: { contains: s, mode: 'insensitive' } },
                        { code: { contains: s, mode: 'insensitive' } },
                        { summary: { contains: s, mode: 'insensitive' } }
                    ]
                }
            ];
        }

        const policies = await (prisma as any).hospitalPolicy.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ success: true, data: policies });
    } catch (error: any) {
        console.error('Error fetching hospital policies:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ success: false, error: 'Chỉ Quản trị viên và Ban Giám đốc mới có quyền tạo văn bản lấy ý kiến' }, { status: 403 });
        }

        const body = await req.json();
        const {
            code,
            title,
            category,
            summary,
            fileUrl,
            fileName,
            fileSize,
            startDate,
            endDate,
            isActive,
            targetDepartments
        } = body;

        if (!title || title.trim() === '') {
            return NextResponse.json({ success: false, error: 'Vui lòng nhập tên văn bản / chính sách' }, { status: 400 });
        }

        const newPolicy = await (prisma as any).hospitalPolicy.create({
            data: {
                code: code?.trim() || null,
                title: title.trim(),
                category: category || 'POLICY',
                summary: summary?.trim() || null,
                fileUrl: fileUrl || null,
                fileName: fileName || null,
                fileSize: fileSize ? Number(fileSize) : null,
                startDate: startDate ? new Date(startDate) : new Date(),
                endDate: endDate ? new Date(endDate) : null,
                isActive: isActive !== undefined ? Boolean(isActive) : true,
                status: 'OPEN',
                targetDepartments: targetDepartments || 'ALL',
                createdBy: user.name || user.username || 'Ban Giám đốc'
            }
        });

        return NextResponse.json({ success: true, data: newPolicy });
    } catch (error: any) {
        console.error('Error creating hospital policy:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ success: false, error: 'Quyền Quản trị viên cần thiết' }, { status: 403 });
        }

        const body = await req.json();
        const { id, isActive, status, code, title, category, summary, fileUrl, fileName, endDate } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Thiếu id văn bản' }, { status: 400 });
        }

        const updateData: any = {};
        if (isActive !== undefined) updateData.isActive = Boolean(isActive);
        if (status !== undefined) updateData.status = status;
        if (code !== undefined) updateData.code = code;
        if (title !== undefined) updateData.title = title;
        if (category !== undefined) updateData.category = category;
        if (summary !== undefined) updateData.summary = summary;
        if (fileUrl !== undefined) updateData.fileUrl = fileUrl;
        if (fileName !== undefined) updateData.fileName = fileName;
        if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

        const updated = await (prisma as any).hospitalPolicy.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error: any) {
        console.error('Error updating hospital policy:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ success: false, error: 'Quyền Quản trị viên cần thiết' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'Thiếu id bản ghi' }, { status: 400 });
        }

        await (prisma as any).hospitalPolicy.delete({
            where: { id }
        });

        return NextResponse.json({ success: true, message: 'Đã xóa văn bản lấy ý kiến' });
    } catch (error: any) {
        console.error('Error deleting hospital policy:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
