import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const formId = searchParams.get('formId');
        
        if (!formId) {
            return NextResponse.json({ error: 'Thiếu formId' }, { status: 400 });
        }

        const config = await prisma.formConfig.findUnique({
            where: { formId }
        });

        return NextResponse.json(config || {});
    } catch (error) {
        console.error('Lỗi khi lấy cấu hình form:', error);
        return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { formId, layout, settings } = body;

        if (!formId) {
            return NextResponse.json({ error: 'Thiếu formId' }, { status: 400 });
        }

        const config = await prisma.formConfig.upsert({
            where: { formId },
            update: { 
                layout: layout ? JSON.stringify(layout) : null, 
                settings: settings ? JSON.stringify(settings) : null 
            },
            create: { 
                formId, 
                layout: layout ? JSON.stringify(layout) : null, 
                settings: settings ? JSON.stringify(settings) : null 
            }
        });

        return NextResponse.json({ success: true, config });
    } catch (error) {
        console.error('Lỗi khi lưu cấu hình form:', error);
        return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
    }
}
