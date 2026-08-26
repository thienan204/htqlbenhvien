import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        const { maCoQuan, tenCoQuan, data } = payload;
        
        if (!maCoQuan || !tenCoQuan || !data || !Array.isArray(data)) {
             return NextResponse.json({ error: 'Dữ liệu không hợp lệ (Thiếu Mã cơ quan, Tên cơ quan hoặc Danh sách)' }, { status: 400 });
        }
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const item of data) {
            try {
                if (!item.sdtBenhNhan) {
                    errorCount++;
                    errors.push(`Thiếu SĐT: ${item.tenBenhNhan || 'Không rõ tên'}`);
                    continue;
                }

                // Gắn thêm mã và tên cơ quan vào hồ sơ
                const recordData = {
                    ...item,
                    maCoQuan: maCoQuan,
                    tenCoQuan: tenCoQuan
                };

                const existing = await prisma.kskToanDan.findFirst({
                    where: { sdtBenhNhan: item.sdtBenhNhan }
                });
                
                if (existing) {
                     await prisma.kskToanDan.update({
                         where: { id: existing.id },
                         data: recordData
                     });
                } else {
                    await prisma.kskToanDan.create({
                        data: recordData
                    });
                }
                successCount++;
            } catch (err: any) {
                errorCount++;
                errors.push(`Lỗi dòng ${item.tenBenhNhan}: ${err.message}`);
            }
        }

        return NextResponse.json({ 
            success: true, 
            successCount, 
            errorCount,
            errors 
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
