import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const pageId = searchParams.get('pageId');

        if (!pageId) {
            return NextResponse.json({ error: 'Missing pageId' }, { status: 400 });
        }

        const instruction = await prisma.pageInstruction.findUnique({
            where: { pageId }
        });

        return NextResponse.json({ content: instruction?.content || '' });
    } catch (error) {
        console.error('Error fetching page instruction:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { pageId, content } = await request.json();

        if (!pageId) {
            return NextResponse.json({ error: 'Missing pageId' }, { status: 400 });
        }

        const instruction = await prisma.pageInstruction.upsert({
            where: { pageId },
            update: { content },
            create: { pageId, content }
        });

        return NextResponse.json(instruction);
    } catch (error) {
        console.error('Error saving page instruction:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
