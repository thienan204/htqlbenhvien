import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeApiRequest } from '@/lib/deleteProtection';

export async function GET() {
    try {
        const categories = await prisma.tT32Category.findMany({
            include: {
                TT32ChapterMapping: {
                    include: {
                        ServiceChapter: true
                    }
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });
        
        return NextResponse.json(categories);
    } catch (error) {
        console.error('Error fetching TT32 categories:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { code, name, description, chapterCodes } = body;

        if (!code || !name) {
            return NextResponse.json({ error: 'Thiếu mã hoặc tên danh mục' }, { status: 400 });
        }

        const newCategory = await prisma.tT32Category.create({
            data: {
                id: crypto.randomUUID(),
                code,
                name,
                description,
                updatedAt: new Date(),
                TT32ChapterMapping: {
                    create: (chapterCodes || []).map((chapCode: string) => ({
                        chapter_code: chapCode
                    }))
                }
            }
        });

        return NextResponse.json(newCategory);
    } catch (error: any) {
        console.error('Error creating TT32 category:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, code, name, description, chapterCodes } = body;

        if (!id || !code || !name) {
            return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
        }

        // Cập nhật thông tin cơ bản
        await prisma.tT32Category.update({
            where: { id },
            data: { code, name, description, updatedAt: new Date() }
        });

        // Cập nhật mappings (xóa hết rồi thêm lại cho đơn giản)
        if (chapterCodes !== undefined) {
            await prisma.tT32ChapterMapping.deleteMany({
                where: { tt32_category_id: id }
            });
            if (chapterCodes.length > 0) {
                await prisma.tT32ChapterMapping.createMany({
                    data: chapterCodes.map((chapCode: string) => ({
                        tt32_category_id: id,
                        chapter_code: chapCode
                    }))
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error updating TT32 category:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const auth = await authorizeApiRequest(request, {
            allowedRoles: ['ADMIN'],
            menuKeys: ['MENU_TT32'],
            action: 'DELETE',
        });
        if (auth.errorResponse) return auth.errorResponse;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Thiếu ID' }, { status: 400 });
        }

        const usedCount = await prisma.practicingCertificate.count({
            where: { tt32_category_id: id },
        });
        if (usedCount > 0) {
            return NextResponse.json(
                { error: `Không thể xóa vì đang có ${usedCount} CCHN được phân quyền theo nhóm TT32 này.` },
                { status: 400 }
            );
        }

        await prisma.tT32Category.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting TT32 category:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
