import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const pageId = searchParams.get('pageId');

        if (!pageId) {
            // Lấy danh sách tất cả bài hướng dẫn
            const instructions = await prisma.pageInstruction.findMany({
                orderBy: { updatedAt: 'desc' }
            });
            return NextResponse.json({ success: true, data: instructions });
        }

        // Các trường hợp có thể xảy ra:
        // 1. Khớp chính xác: "/users" hoặc "users"
        // 2. Có dấu gạch chéo đầu: "/users"
        // 3. Không có dấu gạch chéo: "users"
        // 4. Thay gạch chéo bằng gạch ngang: "users-admin"
        const noSlash = pageId.replace(/^\//, '');
        const withSlash = `/${noSlash}`;
        const dashed = noSlash.replace(/\//g, '-');

        const instruction = await prisma.pageInstruction.findFirst({
            where: {
                OR: [
                    { pageId: pageId },
                    { pageId: withSlash },
                    { pageId: noSlash },
                    { pageId: dashed }
                ]
            }
        });

        return NextResponse.json({ success: true, content: instruction?.content || '', data: instruction });
    } catch (error) {
        console.error('Error fetching page instruction:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { pageId, content, title, description, showOnPage } = await request.json();

        if (!pageId) {
            return NextResponse.json({ success: false, error: 'Missing pageId' }, { status: 400 });
        }

        const instruction = await prisma.pageInstruction.upsert({
            where: { pageId },
            update: { 
                content,
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(showOnPage !== undefined && { showOnPage })
            },
            create: { 
                pageId, 
                content,
                title: title || '',
                description: description || '',
                showOnPage: showOnPage !== undefined ? showOnPage : true
            }
        });

        return NextResponse.json({ success: true, data: instruction });
    } catch (error) {
        console.error('Error saving page instruction:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const pageId = searchParams.get('pageId');

        if (!pageId) {
            return NextResponse.json({ success: false, error: 'Missing pageId' }, { status: 400 });
        }

        await prisma.pageInstruction.delete({
            where: { pageId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting page instruction:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
