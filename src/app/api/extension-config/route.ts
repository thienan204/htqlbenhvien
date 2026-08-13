import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Cho phép CORS để extension gọi vào được (nếu khác origin)
export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-master-key'
        }
    });
}

function setCorsHeaders(res: NextResponse) {
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-master-key');
    return res;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key') || 'carecheck_rules';

        const config = await prisma.extensionConfig.findUnique({
            where: { key }
        });

        // Extension mong đợi trả về đúng mảng JSON (nếu không có thì trả mảng rỗng)
        const responseData = config ? config.data : [];
        return setCorsHeaders(NextResponse.json(responseData, { status: 200 }));
    } catch (error) {
        console.error('Error fetching extension config:', error);
        return setCorsHeaders(NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }));
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key') || 'carecheck_rules';

        // Bảo mật (Tuỳ chọn): Bắt buộc có x-master-key mới cho PUSH
        // const masterKey = request.headers.get('x-master-key');
        // if (masterKey !== 'CARECHECK_123') {
        //     return setCorsHeaders(NextResponse.json({ error: 'Unauthorized: Sai Master Key' }, { status: 401 }));
        // }

        await prisma.extensionConfig.upsert({
            where: { key },
            update: { data: body },
            create: { key, data: body }
        });

        return setCorsHeaders(NextResponse.json({ success: true, message: 'Đã lưu cấu hình thành công trên Server BV' }));
    } catch (error) {
        console.error('Error saving extension config:', error);
        return setCorsHeaders(NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }));
    }
}
