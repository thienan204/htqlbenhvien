import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { updates } = body;

        if (!updates || !Array.isArray(updates)) {
            return NextResponse.json({ error: 'Dữ liệu không hợp lệ, yêu cầu mảng updates' }, { status: 400 });
        }

        let successCount = 0;
        let failedCount = 0;
        const failedRows = [];

        for (const item of updates) {
            const { so_cchn, pham_vi_hanh_nghe_ids, ...fieldsToUpdate } = item;
            
            if (!so_cchn) {
                failedCount++;
                failedRows.push({ so_cchn: 'Không xác định', reason: 'Thiếu Số CCHN' });
                continue;
            }

            try {
                const validUpdateData: any = {};
                for (const key in fieldsToUpdate) {
                    if (fieldsToUpdate[key] !== undefined && fieldsToUpdate[key] !== null) {
                        if (key === 'noi_cap_cchn') {
                            const nameStr = fieldsToUpdate[key].toString().trim();
                            if (nameStr) {
                                let cat = await prisma.systemCategory.findFirst({
                                    where: { type: 'NOI_CAP_CCHN', name: nameStr }
                                });
                                if (!cat) {
                                    cat = await prisma.systemCategory.create({
                                        data: {
                                            type: 'NOI_CAP_CCHN',
                                            code: nameStr.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase(),
                                            name: nameStr
                                        }
                                    });
                                }
                                validUpdateData.noi_cap_cchn_id = cat.id;
                            }
                        } else {
                            validUpdateData[key] = fieldsToUpdate[key];
                        }
                    }
                }

                // Tìm tất cả các CCHN có số này
                const cchns = await prisma.practicingCertificate.findMany({
                    where: { so_cchn }
                });

                if (cchns.length === 0) {
                    failedCount++;
                    failedRows.push({ so_cchn, reason: 'Không tìm thấy Số CCHN này trong hệ thống' });
                    continue;
                }

                // Lặp qua từng CCHN tìm được và update
                for (const cert of cchns) {
                    // Nếu có gửi pham_vi_hanh_nghe_ids, tiến hành xóa cũ và nối mới
                    if (pham_vi_hanh_nghe_ids && Array.isArray(pham_vi_hanh_nghe_ids)) {
                        await prisma.cCHNScopeMapping.deleteMany({
                            where: { cchn_id: cert.id }
                        });
                        validUpdateData.scopes = {
                            create: pham_vi_hanh_nghe_ids.map((ma: string) => ({ scope: { connect: { ma_pham_vi: ma } } }))
                        };
                    }

                    if (Object.keys(validUpdateData).length > 0) {
                        await prisma.practicingCertificate.update({
                            where: { id: cert.id },
                            data: validUpdateData
                        });
                    }
                    successCount++;
                }

            } catch (err: any) {
                failedCount++;
                failedRows.push({ so_cchn, reason: err.message || 'Lỗi hệ thống' });
            }
        }

        return NextResponse.json({
            message: `Đã cập nhật thành công ${successCount} chứng chỉ hành nghề.`,
            successCount,
            failedCount,
            failedRows
        });
    } catch (error: any) {
        console.error('Lỗi Bulk Update CCHN:', error);
        return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
    }
}
