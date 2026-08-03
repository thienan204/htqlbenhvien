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
    const isNewFormat = headers.includes('HO_TEN');

    const colIdx = isNewFormat ? {
        ma_nv: headers.indexOf('SO_CCCD') >= 0 ? headers.indexOf('SO_CCCD') : headers.indexOf('ID'),
        ho_ten: headers.indexOf('HO_TEN'),
        nam: -1,
        nu: -1,
        gioi_tinh: headers.indexOf('GIOI_TINH'),
        ngay_sinh: headers.indexOf('NGAY_SINH'),
        trinh_do: -1,
        chuc_danh: headers.indexOf('CHUCDANH_NN'),
        vi_tri: headers.indexOf('VI_TRI'),
        ma_khoa: headers.indexOf('MA_KHOA'),
        ten_khoa: headers.indexOf('TEN_KHOA'),
        chuc_vu: -1,
        loai_hop_dong: -1,
        so_cchn: headers.indexOf('MACCHN'),
        ngay_cap_cchn: headers.indexOf('NGAYCAP_CCHN'),
        chuc_danh_cchn: headers.indexOf('CHUCDANH_NN'),
        pham_vi: headers.indexOf('PHAMVI_CM'),
        pham_vi_bo_sung: headers.indexOf('PHAMVI_CMBS'),
        dich_vu_ky_thuat: headers.indexOf('DVKT_KHAC'),
        cccd: headers.indexOf('SO_CCCD'),
        sdt: -1,
        ma_bhxh: headers.indexOf('MA_BHXH'),
        ma_dan_toc: headers.indexOf('MA_DANTOC'),
        noi_cap_cchn: headers.indexOf('NOICAP_CCHN'),
        vb_phan_cong: headers.indexOf('VB_PHANCONG'),
        thoi_gian_dang_ky: headers.indexOf('THOIGIAN_DK'),
        thoi_gian_ngay: headers.indexOf('THOIGIAN_NGAY'),
        thoi_gian_tuan: headers.indexOf('THOIGIAN_TUAN'),
        cskcb_khac: headers.indexOf('CSKCB_KHAC'),
        cskcb_cgkt: headers.indexOf('CSKCB_CGKT'),
        qd_cgkt: headers.indexOf('QD_CGKT'),
        tu_ngay: headers.indexOf('TU_NGAY'),
        den_ngay: headers.indexOf('DEN_NGAY'),
        noi_sinh: -1,
        que_quan: -1,
        noi_o: -1,
        ma_ngach: -1,
        he_so_luong: -1,
        bac_luong: -1,
        phu_cap_tnvk: -1,
        so_qd_tuyen_dung: -1,
        ngay_tuyen_dung: -1,
        thoi_diem_nang_luong: -1,
        ton_giao: -1
    } : {
        ma_nv: headers.indexOf('Mã NV'),
        ho_ten: headers.indexOf('Họ và tên'),
        nam: headers.indexOf('Nam'),
        nu: headers.indexOf('Nữ'),
        gioi_tinh: -1,
        ngay_sinh: -1,
        trinh_do: headers.indexOf('Trình độ chuyên môn'),
        chuc_danh: headers.indexOf('Chức danh nghề nghiệp'),
        vi_tri: headers.indexOf('Vị trí việc làm'),
        ma_khoa: headers.indexOf('Mã khoa phòng'),
        ten_khoa: headers.indexOf('Khoa phòng '),
        chuc_vu: headers.indexOf('Chức vụ'),
        loai_hop_dong: headers.indexOf('Loại hợp đồng'),
        so_cchn: headers.indexOf('Số chứng chỉ hành nghề đăng ký với BHYT'),
        ngay_cap_cchn: headers.indexOf('Ngày cấp (Năm-Tháng-Ngày)'),
        chuc_danh_cchn: headers.indexOf('CDNN trong CCHN'),
        pham_vi: headers.indexOf('Phạm vi hành nghề'),
        pham_vi_bo_sung: headers.indexOf('Phạm vi chuyên môn bổ sung'),
        dich_vu_ky_thuat: headers.indexOf('Dịch vụ kỹ thuật khác'),
        cccd: headers.indexOf('Căn cước công dân'),
        sdt: headers.indexOf('Số điện thoại'),
        ma_bhxh: headers.indexOf('Mã BHXH'), 
        ma_dan_toc: headers.indexOf('Dân tộc'), 
        noi_cap_cchn: headers.indexOf('Nơi cấp CCHN'), 
        vb_phan_cong: -1, thoi_gian_dang_ky: -1,
        thoi_gian_ngay: -1, thoi_gian_tuan: -1, cskcb_khac: -1, cskcb_cgkt: -1, qd_cgkt: -1, tu_ngay: -1, den_ngay: -1,
        noi_sinh: headers.indexOf('Nơi sinh'),
        que_quan: headers.indexOf('Quê quán'),
        noi_o: headers.indexOf('Nơi ở hiện nay'),
        ma_ngach: headers.indexOf('Mã ngạch'),
        he_so_luong: headers.indexOf('Hệ số lương'),
        bac_luong: headers.indexOf('Bậc lương'),
        phu_cap_tnvk: headers.indexOf('Phụ cấp TNVK'),
        so_qd_tuyen_dung: headers.indexOf('Số QĐ Tuyển dụng'),
        ngay_tuyen_dung: headers.indexOf('Ngày Tuyển dụng'),
        thoi_diem_nang_luong: headers.indexOf('Thời điểm nâng lương'),
        ton_giao: headers.indexOf('Tôn giáo')
    };

    let successCount = 0;
    let failedCount = 0;
    const resultRows: any[][] = [];
    
    // Header dòng báo cáo
    const headerRow = [...headers, 'Trạng thái', 'Ghi chú Lỗi'];
    resultRows.push(headerRow);

    for (const row of rows) {
        // Đảm bảo độ dài mảng bằng với headers
        const paddedRow = Array.from({ length: headers.length }, (_, i) => row[i] ?? '');
        try {
            const ma_nv = row[colIdx.ma_nv]?.toString().trim();
            const ho_ten = row[colIdx.ho_ten]?.toString().trim();
            const ma_khoa = row[colIdx.ma_khoa]?.toString().trim();
            const ten_khoa = row[colIdx.ten_khoa]?.toString().trim() || 'Khoa chưa xác định';
            const cccd = row[colIdx.cccd]?.toString().trim();
            
            if (!ma_nv || !ho_ten || !ma_khoa) {
                resultRows.push([...paddedRow, 'Thất bại', 'Thiếu Mã NV, Họ Tên hoặc Mã Khoa']);
                failedCount++;
                continue; 
            }

            // Xử lý Ngày sinh & Giới tính
            let ngay_sinh: Date | null = null;
            let gioi_tinh_name = '';
            
            if (colIdx.nam >= 0 && row[colIdx.nam]) {
                gioi_tinh_name = 'Nam';
                ngay_sinh = parseExcelDate(row[colIdx.nam]);
            } else if (colIdx.nu >= 0 && row[colIdx.nu]) {
                gioi_tinh_name = 'Nữ';
                ngay_sinh = parseExcelDate(row[colIdx.nu]);
            } else if (colIdx.gioi_tinh >= 0 && row[colIdx.gioi_tinh] !== undefined) {
                gioi_tinh_name = row[colIdx.gioi_tinh].toString() === '1' ? 'Nam' : 'Nữ';
                if (colIdx.ngay_sinh >= 0 && row[colIdx.ngay_sinh]) {
                    ngay_sinh = parseExcelDate(row[colIdx.ngay_sinh]);
                }
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
            const trinh_do_id = colIdx.trinh_do >= 0 && row[colIdx.trinh_do] ? await getOrCreateCategory('TRINH_DO', row[colIdx.trinh_do]) : null;
            const chuc_danh_id = colIdx.chuc_danh >= 0 && row[colIdx.chuc_danh] ? await getOrCreateCategory('CHUC_DANH', row[colIdx.chuc_danh]) : null;
            const vi_tri_viec_lam_id = colIdx.vi_tri >= 0 && row[colIdx.vi_tri] ? await getOrCreateCategory('VI_TRI_VIEC_LAM', row[colIdx.vi_tri]) : null;
            const chuc_vu_id = colIdx.chuc_vu >= 0 && row[colIdx.chuc_vu] ? await getOrCreateCategory('CHUC_VU', row[colIdx.chuc_vu]) : null;
            const loai_hop_dong_id = colIdx.loai_hop_dong >= 0 && row[colIdx.loai_hop_dong] ? await getOrCreateCategory('LOAI_HOP_DONG', row[colIdx.loai_hop_dong]) : null;
            const dan_toc_id = colIdx.ma_dan_toc >= 0 && row[colIdx.ma_dan_toc] ? await getOrCreateCategory('DAN_TOC', row[colIdx.ma_dan_toc].toString()) : null;
            const ton_giao_id = colIdx.ton_giao >= 0 && row[colIdx.ton_giao] ? await getOrCreateCategory('TON_GIAO', row[colIdx.ton_giao].toString()) : null;
            
            // Tuyển dụng & Lương
            const ma_ngach_id = colIdx.ma_ngach >= 0 && row[colIdx.ma_ngach] ? await getOrCreateCategory('NGACH_LUONG', row[colIdx.ma_ngach].toString()) : null;
            const he_so_luong_id = colIdx.he_so_luong >= 0 && row[colIdx.he_so_luong] ? await getOrCreateCategory('HE_SO_LUONG', row[colIdx.he_so_luong].toString()) : null;
            const bac_luong_id = colIdx.bac_luong >= 0 && row[colIdx.bac_luong] ? await getOrCreateCategory('BAC_LUONG', row[colIdx.bac_luong].toString()) : null;
            const phu_cap_tnvk_id = colIdx.phu_cap_tnvk >= 0 && row[colIdx.phu_cap_tnvk] ? await getOrCreateCategory('PHU_CAP', row[colIdx.phu_cap_tnvk].toString()) : null;
            
            // Địa chỉ (chỉ tạo WARD tạm thời để giữ data)
            const noi_sinh_ward_id = colIdx.noi_sinh >= 0 && row[colIdx.noi_sinh] ? await getOrCreateCategory('WARD', row[colIdx.noi_sinh].toString()) : null;
            const que_quan_ward_id = colIdx.que_quan >= 0 && row[colIdx.que_quan] ? await getOrCreateCategory('WARD', row[colIdx.que_quan].toString()) : null;
            const noi_o_ward_id = colIdx.noi_o >= 0 && row[colIdx.noi_o] ? await getOrCreateCategory('WARD', row[colIdx.noi_o].toString()) : null;
            
            const ma_bhxh = colIdx.ma_bhxh >= 0 ? row[colIdx.ma_bhxh]?.toString().trim() : null;
            const so_qd_tuyen_dung = colIdx.so_qd_tuyen_dung >= 0 ? row[colIdx.so_qd_tuyen_dung]?.toString().trim() : null;
            const ngay_tuyen_dung = colIdx.ngay_tuyen_dung >= 0 && row[colIdx.ngay_tuyen_dung] ? parseExcelDate(row[colIdx.ngay_tuyen_dung]) : null;
            const thoi_diem_nang_luong = colIdx.thoi_diem_nang_luong >= 0 && row[colIdx.thoi_diem_nang_luong] ? parseExcelDate(row[colIdx.thoi_diem_nang_luong]) : null;

            // Upsert Nhân sự
            const staffData: any = {
                ho_ten,
                ma_khoa,
                cccd
            };
            if (row[colIdx.sdt]) staffData.so_dien_thoai = row[colIdx.sdt].toString();
            if (gioi_tinh_id) staffData.gioi_tinh_id = gioi_tinh_id;
            if (trinh_do_id) staffData.trinh_do_id = trinh_do_id;
            if (chuc_danh_id) staffData.chuc_danh_id = chuc_danh_id;
            if (vi_tri_viec_lam_id) staffData.vi_tri_viec_lam_id = vi_tri_viec_lam_id;
            if (chuc_vu_id) staffData.chuc_vu_id = chuc_vu_id;
            if (loai_hop_dong_id) staffData.loai_hop_dong_id = loai_hop_dong_id;
            if (ngay_sinh) staffData.ngay_sinh = ngay_sinh;
            if (ma_bhxh) staffData.ma_bhxh = ma_bhxh;
            if (dan_toc_id) staffData.dan_toc_id = dan_toc_id;
            if (ton_giao_id) staffData.ton_giao_id = ton_giao_id;
            
            if (ma_ngach_id) staffData.ma_ngach_id = ma_ngach_id;
            if (he_so_luong_id) staffData.he_so_luong_id = he_so_luong_id;
            if (bac_luong_id) staffData.bac_luong_id = bac_luong_id;
            if (phu_cap_tnvk_id) staffData.phu_cap_tnvk_id = phu_cap_tnvk_id;
            if (so_qd_tuyen_dung) staffData.so_qd_tuyen_dung = so_qd_tuyen_dung;
            if (ngay_tuyen_dung) staffData.ngay_tuyen_dung = ngay_tuyen_dung;
            if (thoi_diem_nang_luong) staffData.thoi_diem_nang_luong = thoi_diem_nang_luong;
            
            if (noi_sinh_ward_id) staffData.noi_sinh_ward_id = noi_sinh_ward_id;
            if (que_quan_ward_id) staffData.que_quan_ward_id = que_quan_ward_id;
            if (noi_o_ward_id) staffData.noi_o_ward_id = noi_o_ward_id;

            const staff = await prisma.staff.upsert({
                where: { ma_nv },
                update: staffData,
                create: {
                    ma_nv,
                    ...staffData
                }
            });

            // Xử lý Chứng chỉ hành nghề (Nếu có)
            const so_cchn = row[colIdx.so_cchn]?.toString().trim();
            if (so_cchn) {
                // Kiểm tra xem CCHN này đã có chưa
                const existingCert = await prisma.practicingCertificate.findFirst({
                    where: { staffId: staff.id, so_cchn }
                });

                let ngay_cap_cchn: Date | null = null;
                if (colIdx.ngay_cap_cchn >= 0 && row[colIdx.ngay_cap_cchn]) {
                    ngay_cap_cchn = parseExcelDate(row[colIdx.ngay_cap_cchn]);
                }

                let tu_ngay: Date | null = null;
                if (colIdx.tu_ngay >= 0 && row[colIdx.tu_ngay]) {
                    tu_ngay = parseExcelDate(row[colIdx.tu_ngay]);
                }

                let den_ngay: Date | null = null;
                if (colIdx.den_ngay >= 0 && row[colIdx.den_ngay]) {
                    den_ngay = parseExcelDate(row[colIdx.den_ngay]);
                }

                const certData: any = {
                    staffId: staff.id,
                    so_cchn
                };

                // Chỉ lấy dữ liệu nếu trong Excel có điền (không trống)
                if (ngay_cap_cchn) certData.ngay_cap = ngay_cap_cchn;
                if (tu_ngay) certData.tu_ngay = tu_ngay;
                if (den_ngay) certData.den_ngay = den_ngay;
                
                if (colIdx.chuc_danh_cchn >= 0 && row[colIdx.chuc_danh_cchn]) certData.chuc_danh_cchn = row[colIdx.chuc_danh_cchn].toString();
                if (colIdx.pham_vi_bo_sung >= 0 && row[colIdx.pham_vi_bo_sung]) certData.pham_vi_bo_sung = row[colIdx.pham_vi_bo_sung].toString();
                if (colIdx.dich_vu_ky_thuat >= 0 && row[colIdx.dich_vu_ky_thuat]) certData.dich_vu_ky_thuat = row[colIdx.dich_vu_ky_thuat].toString();
                
                if (colIdx.noi_cap_cchn >= 0 && row[colIdx.noi_cap_cchn]) {
                    const noiCapStr = row[colIdx.noi_cap_cchn].toString().trim();
                    if (noiCapStr) {
                        certData.noi_cap_cchn_id = await getOrCreateCategory('NOI_CAP_CCHN', noiCapStr);
                    }
                }
                if (colIdx.vb_phan_cong >= 0 && row[colIdx.vb_phan_cong]) certData.vb_phan_cong = row[colIdx.vb_phan_cong].toString();
                if (colIdx.thoi_gian_dang_ky >= 0 && row[colIdx.thoi_gian_dang_ky]) certData.thoi_gian_dang_ky = row[colIdx.thoi_gian_dang_ky].toString();
                if (colIdx.thoi_gian_ngay >= 0 && row[colIdx.thoi_gian_ngay]) certData.thoi_gian_ngay = row[colIdx.thoi_gian_ngay].toString();
                if (colIdx.thoi_gian_tuan >= 0 && row[colIdx.thoi_gian_tuan]) certData.thoi_gian_tuan = row[colIdx.thoi_gian_tuan].toString();
                if (colIdx.cskcb_khac >= 0 && row[colIdx.cskcb_khac]) certData.cskcb_khac = row[colIdx.cskcb_khac].toString();
                if (colIdx.cskcb_cgkt >= 0 && row[colIdx.cskcb_cgkt]) certData.cskcb_cgkt = row[colIdx.cskcb_cgkt].toString();
                if (colIdx.qd_cgkt >= 0 && row[colIdx.qd_cgkt]) certData.qd_cgkt = row[colIdx.qd_cgkt].toString();

                // Xử lý scopes
                let scopesData: any[] = [];
                if (colIdx.pham_vi >= 0 && row[colIdx.pham_vi]) {
                    const phamViStr = row[colIdx.pham_vi].toString().trim();
                    if (phamViStr) {
                        // Extract ma_pham_vi (e.g. from "302 - Điều dưỡng; 303 - Hộ sinh")
                        const parts = phamViStr.split(';');
                        for (let p of parts) {
                            const match = p.trim().match(/^(\d+)/);
                            if (match && match[1]) {
                                // Kiểm tra xem mã này có trong danh mục không
                                const exists = await prisma.scopeOfPracticeCatalog.findUnique({
                                    where: { ma_pham_vi: match[1] }
                                });
                                if (exists) {
                                    scopesData.push({ scope: { connect: { ma_pham_vi: match[1] } } });
                                }
                            }
                        }
                    }
                }

                if (!existingCert) {
                    if (scopesData.length > 0) {
                        certData.scopes = { create: scopesData };
                    }
                    // Tạo mới
                    await prisma.practicingCertificate.create({
                        data: certData
                    });
                } else {
                    if (scopesData.length > 0) {
                        await prisma.cCHNScopeMapping.deleteMany({
                            where: { cchn_id: existingCert.id }
                        });
                        certData.scopes = { create: scopesData };
                    }
                    
                    await prisma.practicingCertificate.update({
                        where: { id: existingCert.id },
                        data: certData
                    });
                }
            }

            successCount++;
            resultRows.push([...paddedRow, 'Thành công', '']);
        } catch (err: any) {
            failedCount++;
            resultRows.push([...paddedRow, 'Thất bại', err.message || 'Lỗi không xác định']);
            console.error('Lỗi khi import dòng:', row, err);
        }
    }

    // Generate output Excel buffer
    const ws = xlsx.utils.aoa_to_sheet(resultRows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'ImportResult');
    const outBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return {
        successCount,
        failedCount,
        outBuffer
    };
}
