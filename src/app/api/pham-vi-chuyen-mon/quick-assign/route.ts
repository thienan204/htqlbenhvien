import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ma_pham_vi, ma_dich_vu } = body;

        if (!ma_pham_vi || !ma_dich_vu) {
            return NextResponse.json({ error: 'Missing ma_pham_vi or ma_dich_vu' }, { status: 400 });
        }

        // 1. Check if scope exists
        const scope = await prisma.scopeOfPracticeCatalog.findUnique({
            where: { ma_pham_vi }
        });
        if (!scope) {
            return NextResponse.json({ error: `Phạm vi chuyên môn ${ma_pham_vi} chưa tồn tại trong danh mục.` }, { status: 400 });
        }

        // 2. Check if service exists in Mau05Catalog
        const serviceInMau05 = await prisma.mau05Catalog.findFirst({
            where: { MA_DICH_VU: ma_dich_vu }
        });
        if (!serviceInMau05) {
            return NextResponse.json({ error: `Cảnh báo: Không thể gán! Mã dịch vụ ${ma_dich_vu} chưa có trong Danh mục Mẫu 05 (Có thể HIS đã có nhưng phần mềm chưa được cập nhật).` }, { status: 400 });
        }

        // 3. Check if mapping already exists
        const existing = await prisma.scopeServiceMapping.findUnique({
            where: {
                ma_pham_vi_ma_dich_vu: {
                    ma_pham_vi,
                    ma_dich_vu
                }
            }
        });

        if (existing) {
            return NextResponse.json({ error: `Dịch vụ ${ma_dich_vu} ĐÃ CÓ trong Mẫu 05 của Phạm vi ${ma_pham_vi} rồi.` }, { status: 400 });
        }

        await prisma.scopeServiceMapping.create({
            data: {
                id: crypto.randomUUID(),
                ma_pham_vi,
                ma_dich_vu,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        });

        return NextResponse.json({ success: true, message: 'Đã gán dịch vụ thành công' });

    } catch (error: any) {
        console.error('Error assigning service to scope:', error);
        return NextResponse.json({ error: error.message || 'Lỗi server' }, { status: 500 });
    }
}
