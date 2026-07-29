import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const body = await request.json();

        const updated = await prisma.departmentCatalog.update({
            where: { id },
            data: {
                isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
                STT: body.STT ? Number(body.STT) : null,
                MA_KHOA: String(body.MA_KHOA || '').substring(0, 50),
                TEN_KHOA: String(body.TEN_KHOA || ''),
                BAN_KHAM: body.BAN_KHAM !== null && body.BAN_KHAM !== undefined ? Number(body.BAN_KHAM) : null,
                GIUONG_PD: body.GIUONG_PD !== null && body.GIUONG_PD !== undefined ? Number(body.GIUONG_PD) : null,
                GIUONG_TK: body.GIUONG_TK !== null && body.GIUONG_TK !== undefined ? Number(body.GIUONG_TK) : null,
                GIUONG_HSTC: body.GIUONG_HSTC !== null && body.GIUONG_HSTC !== undefined ? Number(body.GIUONG_HSTC) : null,
                GIUONG_HSCC: body.GIUONG_HSCC !== null && body.GIUONG_HSCC !== undefined ? Number(body.GIUONG_HSCC) : null,
                TU_NGAY: body.TU_NGAY ? String(body.TU_NGAY).substring(0, 8) : null,
                DEN_NGAY: body.DEN_NGAY ? String(body.DEN_NGAY).substring(0, 8) : null,
                MA_CSKCB: body.MA_CSKCB ? String(body.MA_CSKCB).substring(0, 5) : null, // Fix missing body.MA_CSKCB prefix in updating. Wait, earlier code had it correct.
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating mau01 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await prisma.departmentCatalog.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting mau01 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
