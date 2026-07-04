import * as xlsx from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Hàm tiện ích chuyển đổi ngày Excel sang Date
function excelDateToJSDate(serial: number) {
    const utc_days  = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;                                        
    const date_info = new Date(utc_value * 1000);
    const fractional_day = serial - Math.floor(serial) + 0.0000001;
    let total_seconds = Math.floor(86400 * fractional_day);
    const seconds = total_seconds % 60;
    total_seconds -= seconds;
    const hours = Math.floor(total_seconds / (60 * 60));
    const minutes = Math.floor(total_seconds / 60) % 60;
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
}

function parseExcelDate(value: any): Date | null {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return excelDateToJSDate(value);
    
    const str = value.toString().trim();
    if (str === '') return null;
    
    // YYYYMMDD
    if (/^\d{8}$/.test(str)) {
        const y = parseInt(str.substring(0, 4));
        const m = parseInt(str.substring(4, 6)) - 1;
        const d = parseInt(str.substring(6, 8));
        const date = new Date(y, m, d);
        if (!isNaN(date.getTime())) return date;
    }
    
    // DD/MM/YYYY or similar
    const parts = str.split(/[-/]/);
    if (parts.length === 3) {
        let d = parseInt(parts[0]);
        let m = parseInt(parts[1]) - 1;
        let y = parseInt(parts[2]);
        if (parts[0].length === 4) { // YYYY/MM/DD
            y = parseInt(parts[0]);
            m = parseInt(parts[1]) - 1;
            d = parseInt(parts[2]);
        }
        const date = new Date(y, m, d);
        if (!isNaN(date.getTime())) return date;
    }
    
    const fallback = new Date(str);
    if (!isNaN(fallback.getTime())) return fallback;
    return null;
}

// Hàm trợ giúp Get or Create Category
async function getOrCreateCategory(type: string, name: string): Promise<string | null> {
    if (!name || name.trim() === '') return null;
    const cleanName = name.trim();
    // Tạo code từ name (viết hoa không dấu, thay cách bằng _)
    const code = cleanName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    
    // Tìm thử
    let cat = await prisma.systemCategory.findUnique({
        where: { type_code: { type, code } }
    });
    
    if (!cat) {
        cat = await prisma.systemCategory.create({
            data: { type, code, name: cleanName }
        });
    }
    return cat.id;
}

export async function processExcelImport(buffer: Buffer) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (rawData.length < 2) {
        throw new Error('File Excel không có dữ liệu');
    }

    const headers = rawData[0];
    const rows = rawData.slice(2); // Dòng 1 là Header, Dòng 2 là đánh số thứ tự (2, 3, 4...) nên bỏ qua
    
    // Tìm Index các cột quan trọng
    const colIdx = {
        ma_nv: headers.indexOf('Mã NV'),
        ho_ten: headers.indexOf('Họ và tên'),
        nam: headers.indexOf('Nam'),
        nu: headers.indexOf('Nữ'),
        trinh_do: headers.indexOf('Trình độ\r\nchuyên môn'),
        chuc_danh: headers.indexOf('Chức danh\r\nnghề nghiệp'),
        vi_tri: headers.indexOf('Vị trí việc làm'),
        ma_khoa: headers.indexOf('Mã khoa phòng'),
        ten_khoa: headers.indexOf('Khoa phòng '),
        chuc_vu: headers.indexOf('Chức vụ'),
        loai_hop_dong: headers.indexOf('Loại hợp đồng'),
        so_cchn: headers.indexOf('Số chứng chỉ hành nghề đăng ký với BHYT'),
        ngay_cap_cchn: headers.indexOf('Ngày cấp\r\n(Năm-Tháng-Ngày)'),
        chuc_danh_cchn: headers.indexOf('CDNN trong CCHN'),
        pham_vi: headers.indexOf('Phạm vi hành nghề'),
        pham_vi_bo_sung: headers.indexOf('Phạm vi chuyên môn bổ sung'),
        dich_vu_ky_thuat: headers.indexOf('Dịch vụ kỹ thuật khác'),
        cccd: headers.indexOf('Căn cước công dân'),
        sdt: headers.indexOf('Số\r\nđiện thoại')
    };

    let successCount = 0;

    for (const row of rows) {
        try {
            const ma_nv = row[colIdx.ma_nv]?.toString().trim();
            const ho_ten = row[colIdx.ho_ten]?.toString().trim();
            const ma_khoa = row[colIdx.ma_khoa]?.toString().trim();
            const ten_khoa = row[colIdx.ten_khoa]?.toString().trim() || 'Khoa chưa xác định';
            const cccd = row[colIdx.cccd]?.toString().trim();
            
            if (!ma_nv || !ho_ten || !ma_khoa) continue; // Bỏ qua dòng thiếu thông tin cơ bản

            // Xử lý Ngày sinh & Giới tính
            let ngay_sinh: Date | null = null;
            let gioi_tinh_name = '';
            
            if (row[colIdx.nam]) {
                gioi_tinh_name = 'Nam';
                ngay_sinh = parseExcelDate(row[colIdx.nam]);
            } else if (row[colIdx.nu]) {
                gioi_tinh_name = 'Nữ';
                ngay_sinh = parseExcelDate(row[colIdx.nu]);
            }

            // Đảm bảo Khoa Phòng tồn tại trước khi thêm nhân viên
            await prisma.department.upsert({
                where: { ma_khoa },
                update: { 
                    ten_khoa,
                    ma_khoa_bv: ma_khoa,
                    ten_khoa_bv: ten_khoa
                },
                create: { 
                    ma_khoa, 
                    ten_khoa, 
                    ma_khoa_bv: ma_khoa,
                    ten_khoa_bv: ten_khoa,
                    type: 'CLINICAL' 
                }
            });

            // Tạo các danh mục động
            const gioi_tinh_id = gioi_tinh_name ? await getOrCreateCategory('GENDER', gioi_tinh_name) : null;
            const trinh_do_id = row[colIdx.trinh_do] ? await getOrCreateCategory('TRINH_DO', row[colIdx.trinh_do]) : null;
            const chuc_danh_id = row[colIdx.chuc_danh] ? await getOrCreateCategory('CHUC_DANH', row[colIdx.chuc_danh]) : null;
            const vi_tri_viec_lam_id = row[colIdx.vi_tri] ? await getOrCreateCategory('VI_TRI_VIEC_LAM', row[colIdx.vi_tri]) : null;
            const chuc_vu_id = row[colIdx.chuc_vu] ? await getOrCreateCategory('CHUC_VU', row[colIdx.chuc_vu]) : null;
            const loai_hop_dong_id = row[colIdx.loai_hop_dong] ? await getOrCreateCategory('LOAI_HOP_DONG', row[colIdx.loai_hop_dong]) : null;

            // Upsert Nhân sự
            const staff = await prisma.staff.upsert({
                where: { ma_nv },
                update: {
                    ho_ten,
                    so_dien_thoai: row[colIdx.sdt]?.toString(),
                    cccd,
                    ma_khoa,
                    gioi_tinh_id,
                    trinh_do_id,
                    chuc_danh_id,
                    vi_tri_viec_lam_id,
                    chuc_vu_id,
                    loai_hop_dong_id,
                    ngay_sinh
                },
                create: {
                    ma_nv,
                    ho_ten,
                    so_dien_thoai: row[colIdx.sdt]?.toString(),
                    cccd,
                    ma_khoa,
                    gioi_tinh_id,
                    trinh_do_id,
                    chuc_danh_id,
                    vi_tri_viec_lam_id,
                    chuc_vu_id,
                    loai_hop_dong_id,
                    ngay_sinh
                }
            });

            // Xử lý Chứng chỉ hành nghề (Nếu có)
            const so_cchn = row[colIdx.so_cchn]?.toString().trim();
            if (so_cchn) {
                // Kiểm tra xem CCHN này đã có chưa
                const existingCert = await prisma.practicingCertificate.findFirst({
                    where: { staffId: staff.id, so_cchn }
                });

                if (!existingCert) {
                    let ngay_cap_cchn: Date | null = null;
                    if (row[colIdx.ngay_cap_cchn]) {
                        ngay_cap_cchn = parseExcelDate(row[colIdx.ngay_cap_cchn]);
                    }

                    await prisma.practicingCertificate.create({
                        data: {
                            staffId: staff.id,
                            so_cchn,
                            ngay_cap: ngay_cap_cchn,
                            chuc_danh_cchn: row[colIdx.chuc_danh_cchn]?.toString(),
                            pham_vi_hanh_nghe: row[colIdx.pham_vi]?.toString(),
                            pham_vi_bo_sung: row[colIdx.pham_vi_bo_sung]?.toString(),
                            dich_vu_ky_thuat: row[colIdx.dich_vu_ky_thuat]?.toString()
                        }
                    });
                }
            }

            successCount++;
        } catch (err) {
            console.error('Lỗi khi import dòng:', row, err);
        }
    }

    return successCount;
}
