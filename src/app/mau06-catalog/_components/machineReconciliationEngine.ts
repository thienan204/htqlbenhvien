/**
 * Engine xử lý Đối soát 3 chiều Danh mục Mẫu 06:
 * Database Nội bộ vs File Cổng BHXH/BYT vs File Phần mềm HIS
 */

export interface ColumnMappingConfig {
    maMayCol: string;
    tenTbCol?: string;
    kyHieuCol?: string; // Model / Serial
    khoaCol?: string;
    congTySxCol?: string;
    nuocSxCol?: string;
    namSxCol?: string;
    namSdCol?: string;
    tenBvCol?: string;
}

export interface MappedMachineItem {
    source: 'PORTAL' | 'HIS' | 'DB';
    maMay: string;
    tenTb: string;
    kyHieu: string; // Model / Serial
    khoa: string;
    congTySx?: string;
    nuocSx?: string;
    namSx?: string;
    namSd?: string;
    tenBv?: string;
    rawRowIndex?: number;
}

export type ReconciliationStatus =
    | 'MATCH_ALL'                  // Khớp hoàn toàn cả 3 nguồn (DB, Cổng, HIS)
    | 'PORTAL_AND_HIS_NO_DB'       // Có trên Cổng và HIS nhưng chưa có trong DB
    | 'DB_AND_PORTAL_NO_HIS'       // Có trong DB và Cổng nhưng THIẾU trên HIS
    | 'DB_AND_HIS_NO_PORTAL'       // Có trong DB và HIS nhưng THIẾU trên Cổng (RẤT NGUY HIỂM)
    | 'ONLY_HIS'                   // Chỉ có trên HIS (chưa khai báo Cổng & DB - Nguy cơ xuất toán 100%)
    | 'ONLY_PORTAL'                // Chỉ có trên Cổng (chưa có trên HIS & DB)
    | 'ONLY_DB'                    // Chỉ có trong DB (không có trên cả Cổng và HIS)
    | 'SAME_SERIAL_DIFF_CODE'      // Cùng số Serial/Model nhưng Mã máy trên HIS khác Cổng
    | 'DIFF_INFO';                 // Cùng mã máy nhưng lệch Tên thiết bị hoặc Serial

export interface ReconciliationItem {
    stt?: number;
    id: string; // Khóa định danh dòng đối soát
    status: ReconciliationStatus;
    statusLabel: string;
    severity: 'success' | 'warning' | 'error' | 'info';
    actionSuggestion: string; // Gợi ý xử lý nghiệp vụ

    // Thông tin từ Database
    dbItem?: {
        id?: string;
        maMay: string;
        tenTb: string;
        kyHieu: string;
        khoa: string;
        isActive: boolean;
        tenBv?: string;
    };

    // Thông tin từ File Cổng
    portalItem?: {
        maMay: string;
        tenTb: string;
        kyHieu: string;
        khoa: string;
        congTySx?: string;
        nuocSx?: string;
        namSx?: string;
        namSd?: string;
        rawRowIndex?: number;
    };

    // Thông tin từ File HIS
    hisItem?: {
        maMay: string;
        tenTb: string;
        kyHieu: string;
        khoa: string;
        rawRowIndex?: number;
    };

    // Chi tiết chênh lệch
    diffFields: string[]; // ['Tên thiết bị', 'Khoa phòng', 'Model/Serial']
}

export interface ReconciliationSummary {
    totalDb: number;
    totalPortal: number;
    totalHis: number;
    totalUniqueRecords: number;
    matchAllCount: number;
    onlyHisCount: number;             // Rất nguy hiểm
    onlyPortalCount: number;          // Cần bổ sung HIS
    onlyDbCount: number;
    sameSerialDiffCodeCount: number;  // Cùng serial khác mã
    diffInfoCount: number;            // Lệch thông tin
    portalAndHisNoDbCount: number;
    dbAndPortalNoHisCount: number;
    dbAndHisNoPortalCount: number;
}

/**
 * Chuẩn hóa chuỗi (bỏ khoảng trắng thừa, chuyển chữ hoa)
 */
export function normalizeText(str?: string | null): string {
    if (!str) return '';
    return String(str).trim();
}

/**
 * Chuẩn hóa mã máy để so khớp (bỏ khoảng trắng trong và ngoài, chuyển chữ hoa)
 */
export function normalizeCode(code?: string | null): string {
    if (!code) return '';
    return String(code).toUpperCase().replace(/\s+/g, '').trim();
}

/**
 * Chuẩn hóa số Serial / Model để so khớp
 */
export function normalizeSerial(serial?: string | null): string {
    if (!serial) return '';
    let s = String(serial).toUpperCase().trim();
    // Bỏ các tiền tố thường gặp
    s = s.replace(/^(SN|SERI|SERIAL|S\/N|NO|MODEL|KY_HIEU)[\s:_\-\.]+/i, '');
    return s.replace(/[\s\-_:\.\/]/g, '');
}

/**
 * Tự động đoán tên cột phù hợp từ danh sách cột của file Excel
 */
export function autoDetectColumns(columns: string[]): ColumnMappingConfig {
    const config: ColumnMappingConfig = {
        maMayCol: '',
        tenTbCol: '',
        kyHieuCol: '',
        khoaCol: '',
        congTySxCol: '',
        nuocSxCol: '',
        namSxCol: '',
        namSdCol: '',
        tenBvCol: ''
    };

    const cleanCols = columns.map(c => ({
        original: c,
        lower: String(c || '').toLowerCase().trim()
    }));

    // 1. Mã máy
    const maMayPatterns = ['mã máy', 'ma_may', 'mamay', 'mã tb', 'ma_tb', 'mã thiết bị', 'ma_thiet_bi', 'máy id', 'machine_code', 'code'];
    const foundMaMay = cleanCols.find(c => maMayPatterns.some(p => c.lower.includes(p)));
    if (foundMaMay) config.maMayCol = foundMaMay.original;

    // 2. Tên thiết bị
    const tenTbPatterns = ['tên tb', 'ten_tb', 'tên thiết bị', 'ten_thiet_bi', 'tên máy', 'ten_may', 'thiết bị', 'tên'];
    const foundTenTb = cleanCols.find(c => c.original !== config.maMayCol && tenTbPatterns.some(p => c.lower.includes(p)));
    if (foundTenTb) config.tenTbCol = foundTenTb.original;

    // 3. Ký hiệu / Model / Serial
    const kyHieuPatterns = ['ký hiệu', 'ky_hieu', 'model', 'mã hiệu', 'số serial', 'serial', 'số chế tạo', 's/n', 'kí hiệu'];
    const foundKyHieu = cleanCols.find(c => kyHieuPatterns.some(p => c.lower.includes(p)));
    if (foundKyHieu) config.kyHieuCol = foundKyHieu.original;

    // 4. Khoa phòng
    const khoaPatterns = ['khoa', 'phòng', 'khoa phòng', 'bộ phận', 'đơn vị', 'ma_khoa', 'ten_khoa'];
    const foundKhoa = cleanCols.find(c => khoaPatterns.some(p => c.lower.includes(p)));
    if (foundKhoa) config.khoaCol = foundKhoa.original;

    // 5. Công ty sản xuất
    const ctyPatterns = ['công ty sx', 'congty_sx', 'hãng sx', 'nhà sản xuất', 'hãng sản xuất', 'nhà sx'];
    const foundCty = cleanCols.find(c => ctyPatterns.some(p => c.lower.includes(p)));
    if (foundCty) config.congTySxCol = foundCty.original;

    // 6. Nước sản xuất
    const nuocPatterns = ['nước sx', 'nuoc_sx', 'quốc gia', 'xuất xứ', 'nơi sản xuất'];
    const foundNuoc = cleanCols.find(c => nuocPatterns.some(p => c.lower.includes(p)));
    if (foundNuoc) config.nuocSxCol = foundNuoc.original;

    // 7. Năm sản xuất
    const namSxPatterns = ['năm sx', 'nam_sx', 'năm sản xuất'];
    const foundNamSx = cleanCols.find(c => namSxPatterns.some(p => c.lower.includes(p)));
    if (foundNamSx) config.namSxCol = foundNamSx.original;

    // 8. Năm sử dụng
    const namSdPatterns = ['năm sd', 'nam_sd', 'năm sử dụng', 'đưa vào sd'];
    const foundNamSd = cleanCols.find(c => namSdPatterns.some(p => c.lower.includes(p)));
    if (foundNamSd) config.namSdCol = foundNamSd.original;

    // 9. Tên bệnh viện
    const bvPatterns = ['tên bv', 'ten_bv', 'bệnh viện', 'cskcb'];
    const foundBv = cleanCols.find(c => bvPatterns.some(p => c.lower.includes(p)));
    if (foundBv) config.tenBvCol = foundBv.original;

    return config;
}

/**
 * Trích xuất dữ liệu dòng Excel sau khi đã cấu hình Mapping cột
 */
export function extractMappedRows(
    rows: any[],
    mapping: ColumnMappingConfig,
    source: 'PORTAL' | 'HIS'
): MappedMachineItem[] {
    const result: MappedMachineItem[] = [];

    rows.forEach((row, index) => {
        const maMay = mapping.maMayCol ? normalizeText(row[mapping.maMayCol]) : '';
        if (!maMay) return; // Bỏ qua dòng không có mã máy

        const tenTb = mapping.tenTbCol ? normalizeText(row[mapping.tenTbCol]) : '';
        const kyHieu = mapping.kyHieuCol ? normalizeText(row[mapping.kyHieuCol]) : '';
        const khoa = mapping.khoaCol ? normalizeText(row[mapping.khoaCol]) : '';
        const congTySx = mapping.congTySxCol ? normalizeText(row[mapping.congTySxCol]) : undefined;
        const nuocSx = mapping.nuocSxCol ? normalizeText(row[mapping.nuocSxCol]) : undefined;
        const namSx = mapping.namSxCol ? normalizeText(row[mapping.namSxCol]) : undefined;
        const namSd = mapping.namSdCol ? normalizeText(row[mapping.namSdCol]) : undefined;
        const tenBv = mapping.tenBvCol ? normalizeText(row[mapping.tenBvCol]) : undefined;

        result.push({
            source,
            maMay,
            tenTb,
            kyHieu,
            khoa,
            congTySx,
            nuocSx,
            namSx,
            namSd,
            tenBv,
            rawRowIndex: index + 2 // Giả định có header dòng 1
        });
    });

    return result;
}

/**
 * Thuật toán Đối soát 3 chiều: Database vs Cổng vs HIS
 */
export function reconcileMachines(
    dbList: any[],
    portalItems: MappedMachineItem[],
    hisItems: MappedMachineItem[]
): {
    items: ReconciliationItem[];
    summary: ReconciliationSummary;
} {
    // 1. Tạo Map dữ liệu cho từng nguồn theo mã máy chuẩn hóa
    const dbByCode = new Map<string, any>();
    const dbBySerial = new Map<string, any>();
    dbList.forEach(item => {
        const code = normalizeCode(item.MA_MAY);
        if (code) dbByCode.set(code, item);

        const serial = normalizeSerial(item.KY_HIEU);
        if (serial && serial.length >= 3 && !dbBySerial.has(serial)) {
            dbBySerial.set(serial, item);
        }
    });

    const portalByCode = new Map<string, MappedMachineItem>();
    const portalBySerial = new Map<string, MappedMachineItem>();
    portalItems.forEach(item => {
        const code = normalizeCode(item.maMay);
        if (code) portalByCode.set(code, item);

        const serial = normalizeSerial(item.kyHieu);
        if (serial && serial.length >= 3 && !portalBySerial.has(serial)) {
            portalBySerial.set(serial, item);
        }
    });

    const hisByCode = new Map<string, MappedMachineItem>();
    const hisBySerial = new Map<string, MappedMachineItem>();
    hisItems.forEach(item => {
        const code = normalizeCode(item.maMay);
        if (code) hisByCode.set(code, item);

        const serial = normalizeSerial(item.kyHieu);
        if (serial && serial.length >= 3 && !hisBySerial.has(serial)) {
            hisBySerial.set(serial, item);
        }
    });

    // 2. Thu thập tất cả các mã máy xuất hiện trong cả 3 nguồn
    const allNormalizedCodes = new Set<string>();
    dbByCode.forEach((_, k) => allNormalizedCodes.add(k));
    portalByCode.forEach((_, k) => allNormalizedCodes.add(k));
    hisByCode.forEach((_, k) => allNormalizedCodes.add(k));

    const processedHisCodes = new Set<string>();
    const processedPortalCodes = new Set<string>();
    const processedDbCodes = new Set<string>();

    const items: ReconciliationItem[] = [];

    // Duyệt theo tất cả các mã máy
    for (const code of Array.from(allNormalizedCodes)) {
        const dbRec = dbByCode.get(code);
        const portalRec = portalByCode.get(code);
        const hisRec = hisByCode.get(code);

        if (dbRec) processedDbCodes.add(code);
        if (portalRec) processedPortalCodes.add(code);
        if (hisRec) processedHisCodes.add(code);

        const hasDb = Boolean(dbRec);
        const hasPortal = Boolean(portalRec);
        const hasHis = Boolean(hisRec);

        let status: ReconciliationStatus;
        let statusLabel = '';
        let severity: 'success' | 'warning' | 'error' | 'info' = 'info';
        let actionSuggestion = '';
        const diffFields: string[] = [];

        // So sánh chi tiết các trường nếu có nhiều hơn 1 nguồn
        const names = [dbRec?.TEN_TB, portalRec?.tenTb, hisRec?.tenTb].filter(Boolean);
        if (new Set(names.map(n => normalizeText(n).toLowerCase())).size > 1) {
            diffFields.push('Tên thiết bị');
        }

        const serials = [dbRec?.KY_HIEU, portalRec?.kyHieu, hisRec?.kyHieu].filter(Boolean);
        if (new Set(serials.map(s => normalizeSerial(s))).size > 1) {
            diffFields.push('Model / Serial');
        }

        const depts = [
            dbRec?.ten_khoa_su_dung || dbRec?.ma_khoa_su_dung,
            portalRec?.khoa,
            hisRec?.khoa
        ].filter(Boolean);
        if (new Set(depts.map(d => normalizeText(d).toLowerCase())).size > 1) {
            diffFields.push('Khoa phòng');
        }

        // Xác định trạng thái
        if (hasDb && hasPortal && hasHis) {
            if (diffFields.length > 0) {
                status = 'DIFF_INFO';
                statusLabel = 'Khớp 3 nguồn (Lệch chi tiết)';
                severity = 'warning';
                actionSuggestion = `Cùng mã máy nhưng thông tin khác nhau ở: ${diffFields.join(', ')}. Cần thống nhất thông tin theo Cổng.`;
            } else {
                status = 'MATCH_ALL';
                statusLabel = 'Khớp hoàn toàn cả 3 nguồn';
                severity = 'success';
                actionSuggestion = 'Dữ liệu đồng bộ chuẩn xác giữa DB, Cổng và HIS.';
            }
        } else if (hasPortal && hasHis && !hasDb) {
            status = 'PORTAL_AND_HIS_NO_DB';
            statusLabel = 'Có Cổng & HIS (Chưa có trong DB)';
            severity = 'info';
            actionSuggestion = 'Bấm nút "Đồng bộ vào DB" để bổ sung thiết bị này vào hệ thống.';
        } else if (hasDb && hasPortal && !hasHis) {
            status = 'DB_AND_PORTAL_NO_HIS';
            statusLabel = 'Có Cổng & DB (THIẾU trên HIS)';
            severity = 'warning';
            actionSuggestion = 'Thiết bị đã duyệt trên Cổng nhưng chưa cấu hình trên phần mềm HIS. Cần bổ sung vào HIS.';
        } else if (hasDb && hasHis && !hasPortal) {
            status = 'DB_AND_HIS_NO_PORTAL';
            statusLabel = 'Có HIS & DB (THIẾU trên Cổng)';
            severity = 'error';
            actionSuggestion = 'NGUY HIỂM: Máy đang kê trên HIS nhưng chưa khai báo trên Cổng! Nguy cơ xuất toán 100% khi gửi XML.';
        } else if (hasHis && !hasPortal && !hasDb) {
            // Kiểm tra xem serial của HIS có nằm trên Cổng với mã khác không
            const hisSerial = normalizeSerial(hisRec?.kyHieu);
            const matchedPortalBySerial = (hisSerial && hisSerial.length >= 3) ? portalBySerial.get(hisSerial) : null;

            if (matchedPortalBySerial) {
                status = 'SAME_SERIAL_DIFF_CODE';
                statusLabel = 'Cùng Serial (Khác Mã máy)';
                severity = 'error';
                actionSuggestion = `Mã HIS là [${hisRec?.maMay}] nhưng trên Cổng mã chuẩn là [${matchedPortalBySerial.maMay}] (cùng Serial ${hisRec?.kyHieu}). Cần sửa mã trên HIS theo Cổng!`;
            } else {
                status = 'ONLY_HIS';
                statusLabel = 'Chỉ có trên HIS (Thiếu Cổng & DB)';
                severity = 'error';
                actionSuggestion = 'RẤT NGUY HIỂM: Máy chỉ có trên HIS, chưa hề có trên Cổng BHXH/BYT. Cần khai báo Mẫu 06 lên Cổng ngay lập tức!';
            }
        } else if (hasPortal && !hasHis && !hasDb) {
            status = 'ONLY_PORTAL';
            statusLabel = 'Chỉ có trên Cổng (Thiếu HIS & DB)';
            severity = 'warning';
            actionSuggestion = 'Máy có trên Cổng nhưng chưa được nhập vào HIS và DB. Cần cập nhật vào HIS để bác sĩ chỉ định.';
        } else {
            status = 'ONLY_DB';
            statusLabel = 'Chỉ có trong Database';
            severity = 'info';
            actionSuggestion = 'Máy có trong Database nhưng không xuất hiện trong cả 2 file Cổng và HIS (có thể là máy cũ/đã thanh lý).';
        }

        items.push({
            id: code,
            status,
            statusLabel,
            severity,
            actionSuggestion,
            dbItem: dbRec ? {
                id: dbRec.id,
                maMay: dbRec.MA_MAY,
                tenTb: dbRec.TEN_TB,
                kyHieu: dbRec.KY_HIEU,
                khoa: dbRec.ten_khoa_su_dung || dbRec.ma_khoa_su_dung || '',
                isActive: dbRec.isActive,
                tenBv: dbRec.TEN_BV
            } : undefined,
            portalItem: portalRec ? {
                maMay: portalRec.maMay,
                tenTb: portalRec.tenTb,
                kyHieu: portalRec.kyHieu,
                khoa: portalRec.khoa,
                congTySx: portalRec.congTySx,
                nuocSx: portalRec.nuocSx,
                namSx: portalRec.namSx,
                namSd: portalRec.namSd,
                rawRowIndex: portalRec.rawRowIndex
            } : undefined,
            hisItem: hisRec ? {
                maMay: hisRec.maMay,
                tenTb: hisRec.tenTb,
                kyHieu: hisRec.kyHieu,
                khoa: hisRec.khoa,
                rawRowIndex: hisRec.rawRowIndex
            } : undefined,
            diffFields
        });
    }

    // Đánh số thứ tự (STT)
    items.sort((a, b) => {
        // Ưu tiên đưa các trạng thái lỗi/nguy hiểm lên đầu
        const severityRank = { error: 1, warning: 2, info: 3, success: 4 };
        const diffRank = severityRank[a.severity] - severityRank[b.severity];
        if (diffRank !== 0) return diffRank;

        return a.id.localeCompare(b.id, undefined, { numeric: true });
    });

    items.forEach((item, index) => {
        item.stt = index + 1;
    });

    // Thống kê
    const summary: ReconciliationSummary = {
        totalDb: dbList.length,
        totalPortal: portalItems.length,
        totalHis: hisItems.length,
        totalUniqueRecords: items.length,
        matchAllCount: items.filter(i => i.status === 'MATCH_ALL').length,
        onlyHisCount: items.filter(i => i.status === 'ONLY_HIS').length,
        onlyPortalCount: items.filter(i => i.status === 'ONLY_PORTAL').length,
        onlyDbCount: items.filter(i => i.status === 'ONLY_DB').length,
        sameSerialDiffCodeCount: items.filter(i => i.status === 'SAME_SERIAL_DIFF_CODE').length,
        diffInfoCount: items.filter(i => i.status === 'DIFF_INFO').length,
        portalAndHisNoDbCount: items.filter(i => i.status === 'PORTAL_AND_HIS_NO_DB').length,
        dbAndPortalNoHisCount: items.filter(i => i.status === 'DB_AND_PORTAL_NO_HIS').length,
        dbAndHisNoPortalCount: items.filter(i => i.status === 'DB_AND_HIS_NO_PORTAL').length
    };

    return {
        items,
        summary
    };
}

