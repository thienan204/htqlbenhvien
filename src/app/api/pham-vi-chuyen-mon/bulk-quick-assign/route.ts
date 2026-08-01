import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { mappings } = body; // Array of { ma_pham_vi, ma_dich_vu }

        if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
            return NextResponse.json({ error: 'Không có dữ liệu gán.' }, { status: 400 });
        }

        let successCount = 0;
        let errors: string[] = [];

        // 1. Lọc trùng lặp ngay trong danh sách gửi lên
        const uniqueMappings = new Map<string, any>();
        mappings.forEach((m: any) => {
            if (m.ma_pham_vi && m.ma_dich_vu) {
                const key = `${m.ma_pham_vi}_${m.ma_dich_vu}`;
                uniqueMappings.set(key, { ma_pham_vi: m.ma_pham_vi, ma_dich_vu: m.ma_dich_vu });
            }
        });
        const itemsToProcess = Array.from(uniqueMappings.values());

        // Lấy danh sách Phạm vi hợp lệ
        const allScopes = await prisma.scopeOfPracticeCatalog.findMany({ select: { ma_pham_vi: true } });
        const validScopes = new Set(allScopes.map(s => s.ma_pham_vi));

        // Lấy danh sách Dịch vụ Mẫu 05 hợp lệ (chỉ lấy những mã có trong itemsToProcess để tối ưu)
        const requestedDichVu = Array.from(new Set(itemsToProcess.map(i => i.ma_dich_vu)));
        const allMau05 = await prisma.mau05Catalog.findMany({
            where: { MA_DICH_VU: { in: requestedDichVu } },
            select: { MA_DICH_VU: true }
        });
        const validMau05 = new Set(allMau05.map(m => m.MA_DICH_VU));

        // Lấy danh sách các mapping đã tồn tại
        const existingMappings = await prisma.scopeServiceMapping.findMany({
            where: {
                OR: itemsToProcess.map(item => ({
                    ma_pham_vi: item.ma_pham_vi,
                    ma_dich_vu: item.ma_dich_vu
                }))
            },
            select: { ma_pham_vi: true, ma_dich_vu: true }
        });
        const existingSet = new Set(existingMappings.map(e => `${e.ma_pham_vi}_${e.ma_dich_vu}`));

        const newRecordsToInsert: any[] = [];

        for (const item of itemsToProcess) {
            const { ma_pham_vi, ma_dich_vu } = item;

            if (!validScopes.has(ma_pham_vi)) {
                errors.push(`Phạm vi ${ma_pham_vi} không tồn tại.`);
                continue;
            }

            if (!validMau05.has(ma_dich_vu)) {
                errors.push(`Dịch vụ ${ma_dich_vu} không có trong Mẫu 05.`);
                continue;
            }

            if (existingSet.has(`${ma_pham_vi}_${ma_dich_vu}`)) {
                // Đã tồn tại, bỏ qua (không báo lỗi gắt, chỉ tính là không gán thêm)
                continue;
            }

            newRecordsToInsert.push({
                id: crypto.randomUUID(),
                ma_pham_vi,
                ma_dich_vu,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        if (newRecordsToInsert.length > 0) {
            // Chèn hàng loạt
            await prisma.scopeServiceMapping.createMany({
                data: newRecordsToInsert,
                skipDuplicates: true // An toàn dự phòng
            });
            successCount = newRecordsToInsert.length;
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Hoàn tất gán hàng loạt.',
            successCount,
            errorCount: errors.length,
            errors: errors.slice(0, 100) // Trả về tối đa 100 lỗi để tránh phình to response
        });

    } catch (error: any) {
        console.error('Error in bulk assigning services:', error);
        return NextResponse.json({ error: error.message || 'Lỗi server' }, { status: 500 });
    }
}
