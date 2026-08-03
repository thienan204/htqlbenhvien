import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';

const prisma = new PrismaClient();

const CATEGORY_MAP: Record<string, { type: string, idField: string }> = {
    'chuc_danh': { type: 'CHUC_DANH', idField: 'chuc_danh_id' },
    'chuc_vu': { type: 'CHUC_VU', idField: 'chuc_vu_id' },
    'gioi_tinh': { type: 'GENDER', idField: 'gioi_tinh_id' },
    'loai_hop_dong': { type: 'LOAI_HOP_DONG', idField: 'loai_hop_dong_id' },
    'trinh_do': { type: 'TRINH_DO', idField: 'trinh_do_id' },
    'vi_tri_viec_lam': { type: 'VI_TRI_VIEC_LAM', idField: 'vi_tri_viec_lam_id' },
    'dan_toc': { type: 'DAN_TOC', idField: 'dan_toc_id' },
    'vi_tri_bhyt': { type: 'VI_TRI_BHYT', idField: 'vi_tri_bhyt_id' },
    'ton_giao': { type: 'TON_GIAO', idField: 'ton_giao_id' },
    'noi_sinh_ward': { type: 'WARD', idField: 'noi_sinh_ward_id' },
    'que_quan_ward': { type: 'WARD', idField: 'que_quan_ward_id' },
    'noi_o_ward': { type: 'WARD', idField: 'noi_o_ward_id' },
    'ma_ngach': { type: 'NGACH_LUONG', idField: 'ma_ngach_id' },
    'he_so_luong': { type: 'HE_SO_LUONG', idField: 'he_so_luong_id' },
    'bac_luong': { type: 'BAC_LUONG', idField: 'bac_luong_id' },
    'phu_cap_tnvk': { type: 'PHU_CAP', idField: 'phu_cap_tnvk_id' }
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { updates, headers, originalData } = body;

        if (!updates || !Array.isArray(updates) || !originalData) {
            return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
        }

        let successCount = 0;
        let failedCount = 0;
        const resultRows: any[][] = [];
        
        // Add header
        const headerRow = [...originalData[0], 'Trạng thái', 'Ghi chú Lỗi'];
        resultRows.push(headerRow);
        
        // Tạo map updates để tra cứu nhanh bằng ma_nv
        const updatesMap = new Map();
        for (const item of updates) {
            updatesMap.set(item.ma_nv, item);
        }
        
        const maNvIndex = originalData[0].findIndex((h: string) => h.toLowerCase() === 'ma_nv');

        for (let i = 1; i < originalData.length; i++) {
            const row = originalData[i];
            const paddedRow = Array.from({ length: originalData[0].length }, (_, idx) => row[idx] ?? '');
            
            const ma_nv = row[maNvIndex]?.toString().trim();
            if (!ma_nv) {
                // Dòng trống
                continue;
            }

            const fieldsToUpdate = updatesMap.get(ma_nv);
            
            if (!fieldsToUpdate) {
                // Không có gì để update
                resultRows.push([...paddedRow, 'Thất bại', 'Không có dữ liệu hợp lệ để cập nhật']);
                failedCount++;
                continue;
            }

            try {
                // Kiểm tra xem mã NV có tồn tại không
                const existingStaff = await prisma.staff.findUnique({
                    where: { ma_nv }
                });

                if (!existingStaff) {
                    failedCount++;
                    resultRows.push([...paddedRow, 'Thất bại', 'Không tìm thấy Mã NV này trong hệ thống']);
                    continue;
                }

                const validUpdateData: any = {};
                
                // Xử lý từng trường cần update
                for (const key in fieldsToUpdate) {
                    if (key === 'ma_nv') continue;
                    
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
                    resultRows.push([...paddedRow, 'Thành công', '']);
                } else {
                    resultRows.push([...paddedRow, 'Thành công', 'Không có dữ liệu thay đổi']);
                }

            } catch (err: any) {
                failedCount++;
                resultRows.push([...paddedRow, 'Thất bại', err.message || 'Lỗi hệ thống khi cập nhật']);
            }
        }

        const ws = xlsx.utils.aoa_to_sheet(resultRows);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'BulkUpdateResult');
        const outBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(outBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="KetQua_BulkUpdate.xlsx"',
                'X-Success-Count': successCount.toString(),
                'X-Failed-Count': failedCount.toString()
            }
        });
    } catch (error: any) {
        console.error('Lỗi Bulk Update Staff:', error);
        return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
    }
}
