import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORY_MAP: Record<string, { type: string, idField: string }> = {
    'chuc_danh': { type: 'CHUC_DANH', idField: 'chuc_danh_id' },
    'chuc_vu': { type: 'CHUC_VU', idField: 'chuc_vu_id' },
    'gioi_tinh': { type: 'GENDER', idField: 'gioi_tinh_id' },
    'loai_hop_dong': { type: 'LOAI_HOP_DONG', idField: 'loai_hop_dong_id' },
    'trinh_do': { type: 'TRINH_DO', idField: 'trinh_do_id' },
    'vi_tri_viec_lam': { type: 'VI_TRI_VIEC_LAM', idField: 'vi_tri_viec_lam_id' },
    'dan_toc': { type: 'DAN_TOC', idField: 'dan_toc_id' },
    'vi_tri_bhyt': { type: 'VI_TRI_BHYT', idField: 'vi_tri_bhyt_id' }
};

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
            const { ma_nv, ...fieldsToUpdate } = item;
            
            if (!ma_nv) {
                failedCount++;
                failedRows.push({ ma_nv: 'Không xác định', reason: 'Thiếu Mã NV' });
                continue;
            }

            try {
                // Kiểm tra xem mã NV có tồn tại không
                const existingStaff = await prisma.staff.findUnique({
                    where: { ma_nv }
                });

                if (!existingStaff) {
                    failedCount++;
                    failedRows.push({ ma_nv, reason: 'Không tìm thấy Mã NV này trong hệ thống' });
                    continue;
                }

                const validUpdateData: any = {};
                
                // Xử lý từng trường cần update
                for (const key in fieldsToUpdate) {
                    const value = fieldsToUpdate[key];
                    if (value === undefined || value === null || value === '') continue;

                    // Nếu là trường cần tra cứu danh mục
                    if (CATEGORY_MAP[key]) {
                        const nameStr = value.toString().trim();
                        if (nameStr) {
                            const { type, idField } = CATEGORY_MAP[key];
                            let cat = await prisma.systemCategory.findFirst({
                                where: { type: type, name: nameStr }
                            });
                            if (!cat) {
                                cat = await prisma.systemCategory.create({
                                    data: {
                                        type: type,
                                        code: nameStr.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase(),
                                        name: nameStr
                                    }
                                });
                            }
                            validUpdateData[idField] = cat.id;
                        }
                    } 
                    // Xử lý khoa phòng riêng
                    else if (key === 'ma_khoa') {
                        const maKhoa = value.toString().trim();
                        // Đảm bảo khoa phòng tồn tại
                        let dept = await prisma.department.findUnique({ where: { ma_khoa: maKhoa } });
                        if (!dept) {
                            dept = await prisma.department.create({
                                data: {
                                    ma_khoa: maKhoa,
                                    ten_khoa: maKhoa, // Tạm thời dùng mã làm tên nếu chưa có
                                    ma_khoa_bv: maKhoa,
                                    ten_khoa_bv: maKhoa,
                                    type: 'CLINICAL'
                                }
                            });
                        }
                        validUpdateData.ma_khoa = dept.ma_khoa;
                    }
                    else {
                        validUpdateData[key] = value;
                    }
                }

                if (Object.keys(validUpdateData).length > 0) {
                    await prisma.staff.update({
                        where: { id: existingStaff.id },
                        data: validUpdateData
                    });
                    successCount++;
                } else {
                    // Không có gì để update
                    continue; 
                }

            } catch (err: any) {
                failedCount++;
                failedRows.push({ ma_nv, reason: err.message || 'Lỗi hệ thống khi cập nhật' });
            }
        }

        return NextResponse.json({
            message: `Đã cập nhật thành công ${successCount} nhân sự.`,
            successCount,
            failedCount,
            failedRows
        });
    } catch (error: any) {
        console.error('Lỗi Bulk Update Staff:', error);
        return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
    }
}
