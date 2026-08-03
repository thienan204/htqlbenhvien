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
                const { ma_nv, ...actualFields } = fieldsToUpdate;
                
                const validUpdateData: any = {};
                for (const key in actualFields) {
                    if (actualFields[key] !== undefined && actualFields[key] !== null) {
                        if (key === 'noi_cap_cchn') {
                            const nameStr = actualFields[key].toString().trim();
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
                            validUpdateData[key] = actualFields[key];
                        }
                    }
                }

                // Tìm tất cả các CCHN có số này
                const cchns = await prisma.practicingCertificate.findMany({
                    where: { so_cchn }
                });

                if (cchns.length === 0) {
                    if (ma_nv) {
                        // Logic thêm mới
                        const staff = await prisma.staff.findFirst({
                            where: { ma_nv: ma_nv.toString().trim() }
                        });
                        
                        if (!staff) {
                            failedCount++;
                            failedRows.push({ so_cchn, reason: `Không tìm thấy Mã NV: ${ma_nv} để thêm mới` });
                            continue;
                        }

                        // Validate scopes trước khi tạo
                        if (pham_vi_hanh_nghe_ids && Array.isArray(pham_vi_hanh_nghe_ids) && pham_vi_hanh_nghe_ids.length > 0) {
                            const existingScopes = await prisma.scopeOfPracticeCatalog.findMany({
                                where: { ma_pham_vi: { in: pham_vi_hanh_nghe_ids } },
                                select: { ma_pham_vi: true }
                            });
                            const existingScopeIds = existingScopes.map(s => s.ma_pham_vi);
                            const missingScopes = pham_vi_hanh_nghe_ids.filter(ma => !existingScopeIds.includes(ma));
                            
                            if (missingScopes.length > 0) {
                                throw new Error(`Mã phạm vi hành nghề không tồn tại: ${missingScopes.join(', ')}`);
                            }
                            
                            const uniqueScopeIds = Array.from(new Set(pham_vi_hanh_nghe_ids));
                            validUpdateData.scopes = {
                                create: uniqueScopeIds.map((ma: string) => ({ scope: { connect: { ma_pham_vi: ma } } }))
                            };
                        }

                        await prisma.practicingCertificate.create({
                            data: {
                                ...validUpdateData,
                                so_cchn,
                                staffId: staff.id
                            }
                        });
                        
                        successCount++;
                        continue; // Bỏ qua phần update ở dưới
                    } else {
                        failedCount++;
                        failedRows.push({ so_cchn, reason: 'Không tìm thấy Số CCHN và không có Mã NV để Thêm mới' });
                        continue;
                    }
                }

                // Kiểm tra xem các mã phạm vi hành nghề có hợp lệ không
                if (pham_vi_hanh_nghe_ids && Array.isArray(pham_vi_hanh_nghe_ids) && pham_vi_hanh_nghe_ids.length > 0) {
                    const existingScopes = await prisma.scopeOfPracticeCatalog.findMany({
                        where: { ma_pham_vi: { in: pham_vi_hanh_nghe_ids } },
                        select: { ma_pham_vi: true }
                    });
                    const existingScopeIds = existingScopes.map(s => s.ma_pham_vi);
                    const missingScopes = pham_vi_hanh_nghe_ids.filter(ma => !existingScopeIds.includes(ma));
                    
                    if (missingScopes.length > 0) {
                        throw new Error(`Mã phạm vi hành nghề không tồn tại trong hệ thống: ${missingScopes.join(', ')}`);
                    }
                }

                // Lặp qua từng CCHN tìm được và update
                for (const cert of cchns) {
                    // Nếu có gửi pham_vi_hanh_nghe_ids, tiến hành xóa cũ và nối mới
                    if (pham_vi_hanh_nghe_ids && Array.isArray(pham_vi_hanh_nghe_ids)) {
                        await prisma.cCHNScopeMapping.deleteMany({
                            where: { cchn_id: cert.id }
                        });
                        
                        const uniqueScopeIds = Array.from(new Set(pham_vi_hanh_nghe_ids));
                        
                        validUpdateData.scopes = {
                            create: uniqueScopeIds.map((ma: string) => ({ scope: { connect: { ma_pham_vi: ma } } }))
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
