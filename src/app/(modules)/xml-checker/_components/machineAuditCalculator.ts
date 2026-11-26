import { HosoRecord, getXmlDataList } from '@/lib/xml';
import { MachineCatalogItem } from '@/app/api/xml-checker/machine-audit-data/route';
import type { ValidationRule } from '@/lib/validation';

export type MachineAuditErrorType = 'NOT_IN_MAU06' | 'MISSING_REQUIRED';

export interface MachineAuditItem {
    stt?: number;
    maLk: string;
    maBn: string;
    hoTen: string;
    ngayVao: string;
    ngayVaoFormatted: string;
    ngayRa: string;
    ngayRaFormatted: string;
    ngayRaDateOnly: string;
    ngayYl: string;
    ngayYlFormatted: string;
    maDichVu: string;
    tenDichVu: string;
    maKhoa: string;
    tenKhoa: string;
    maMayXml: string;
    errorType: MachineAuditErrorType;
    errorLabel: string;
    suggestedMaMay: string;
    suggestedTenTb: string;
    suggestedKyHieu: string;
    suggestedReason: string;
    soLuong: number;
    donGia: number;
    thanhTien: number;
}

export interface MachineAuditSummary {
    totalXml3Scanned: number;
    totalErrors: number;
    totalNotInMau06: number;
    totalMissingRequired: number;
    totalWithSuggestions: number;
    totalHosoAffected: number;
}

/**
 * Định dạng ngày YL XML (thường là YYYYMMDDHHmm hoặc YYYYMMDD) sang DD/MM/YYYY HH:mm
 */
export function formatXmlDate(rawDate?: string | null): string {
    if (!rawDate) return '';
    const clean = String(rawDate).trim();
    if (clean.length >= 12) {
        // YYYYMMDDHHmm
        const y = clean.substring(0, 4);
        const m = clean.substring(4, 6);
        const d = clean.substring(6, 8);
        const h = clean.substring(8, 10);
        const mi = clean.substring(10, 12);
        return `${d}/${m}/${y} ${h}:${mi}`;
    }
    if (clean.length >= 8) {
        // YYYYMMDD
        const y = clean.substring(0, 4);
        const m = clean.substring(4, 6);
        const d = clean.substring(6, 8);
        return `${d}/${m}/${y}`;
    }
    return clean;
}

/**
 * Định dạng ngày ra viện dạng DD-MM-YYYY (thích hợp cho tên Sheet Excel hoặc lọc theo ngày)
 */
export function formatXmlDateOnly(rawDate?: string | null): string {
    if (!rawDate) return '';
    const clean = String(rawDate).trim();
    if (clean.length >= 8) {
        const y = clean.substring(0, 4);
        const m = clean.substring(4, 6);
        const d = clean.substring(6, 8);
        return `${d}-${m}-${y}`;
    }
    return clean;
}

/**
 * Chuẩn hóa chuỗi để so khớp serial / model
 */
function normalizeSerial(text?: string | null): string {
    if (!text) return '';
    let s = String(text).toUpperCase().trim();
    // Bỏ tiền tố thông dụng
    s = s.replace(/^(SN|SERI|SERIAL|S\/N|NO|MODEL|KY_HIEU|MÃ_MÁY|MAMAY|MAY)[\s:_\-\.]+/i, '');
    // Bỏ khoảng trắng và dấu phân tách thừa
    return s.replace(/[\s\-_:\.\/]/g, '');
}

/**
 * Chuẩn hóa chuỗi tiếng Việt không dấu để so khớp từ khóa
 */
function removeVietnameseTones(str: string): string {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
}

/**
 * Các bộ từ khóa nhận diện loại máy y tế phổ biến
 */
const DEVICE_KEYWORD_GROUPS: { keywords: string[]; deviceMatch: string[] }[] = [
    {
        keywords: ['x-quang', 'xquang', 'chup xquang', 'chup x-quang', 'chieu x-quang'],
        deviceMatch: ['x-quang', 'xquang', 'x quang', 'tang sang']
    },
    {
        keywords: ['sieu am', 'doppler', '4d', '2d', 'tim mạch'],
        deviceMatch: ['sieu am', 'ultrasound', 'doppler']
    },
    {
        keywords: ['cat lop vi tinh', 'ct scanner', 'chup ct', 'clvt'],
        deviceMatch: ['cat lop', 'ct scanner', 'clvt', 'ct scan']
    },
    {
        keywords: ['cong huong tu', 'mri'],
        deviceMatch: ['cong huong tu', 'mri']
    },
    {
        keywords: ['noi soi', 'da day', 'dai trang', 'tai mui hong', 'phe quan'],
        deviceMatch: ['noi soi', 'endoscopy', 'video']
    },
    {
        keywords: ['dien tim', 'dien tam do', 'ecg', 'ekg'],
        deviceMatch: ['dien tim', 'dien tam do', 'ecg']
    },
    {
        keywords: ['dien nao', 'eeg'],
        deviceMatch: ['dien nao', 'eeg']
    },
    {
        keywords: ['do chuc nang ho hap', 'ho hap ke'],
        deviceMatch: ['ho hap', 'spirometer']
    },
    {
        keywords: ['sinh hoa', 'xet nghiem mau', 'huyet hoc', 'mien dich', 'nuoc tieu'],
        deviceMatch: ['sinh hoa', 'huyet hoc', 'mien dich', 'nuoc tieu', 'xet nghiem']
    },
    {
        keywords: ['tan soi', 'laser', 'song xung kich'],
        deviceMatch: ['tan soi', 'laser']
    },
    {
        keywords: ['chay than', 'loc mau', 'than nhan tao'],
        deviceMatch: ['chay than', 'than nhan tao', 'loc mau', 'dialysis']
    }
];

/**
 * Tìm đề xuất mã máy Mẫu 06 cho 1 dòng dịch vụ XML3
 */
export function findSuggestedMachine(
    maMayXml: string,
    maDichVu: string,
    tenDichVu: string,
    maKhoa: string,
    mau06List: MachineCatalogItem[]
): {
    suggestedMaMay: string;
    suggestedTenTb: string;
    suggestedKyHieu: string;
    suggestedReason: string;
} {
    const rawXmlMachine = maMayXml.trim();
    const normXmlMachine = normalizeSerial(rawXmlMachine);

    // =========================================================================
    // Cấp 1: Khớp chính xác Ký hiệu / Serial (KY_HIEU)
    // =========================================================================
    if (normXmlMachine.length >= 2) {
        // Ưu tiên máy cùng khoa nếu có nhiều máy cùng serial/ký hiệu
        const exactMatches = mau06List.filter(m => {
            const normKyHieu = normalizeSerial(m.KY_HIEU);
            return normKyHieu && normKyHieu === normXmlMachine;
        });

        if (exactMatches.length > 0) {
            // Nếu có máy trùng khoa thực hiện, ưu tiên trước
            const sameDept = exactMatches.find(m => m.ma_khoa_su_dung === maKhoa);
            const chosen = sameDept || exactMatches[0];
            return {
                suggestedMaMay: chosen.MA_MAY,
                suggestedTenTb: chosen.TEN_TB,
                suggestedKyHieu: chosen.KY_HIEU,
                suggestedReason: `Khớp chính xác Serial/Ký hiệu (${chosen.KY_HIEU})`
            };
        }
    }

    // =========================================================================
    // Cấp 2: Khớp tương đối / chuỗi con Serial / Model (KY_HIEU)
    // =========================================================================
    if (normXmlMachine.length >= 4) {
        // Tìm máy mà ký hiệu chứa chuỗi XML hoặc chuỗi XML chứa ký hiệu
        const subMatches = mau06List.filter(m => {
            const normKyHieu = normalizeSerial(m.KY_HIEU);
            if (!normKyHieu || normKyHieu.length < 3) return false;
            return normXmlMachine.includes(normKyHieu) || normKyHieu.includes(normXmlMachine);
        });

        if (subMatches.length > 0) {
            const sameDept = subMatches.find(m => m.ma_khoa_su_dung === maKhoa);
            const chosen = sameDept || subMatches[0];
            return {
                suggestedMaMay: chosen.MA_MAY,
                suggestedTenTb: chosen.TEN_TB,
                suggestedKyHieu: chosen.KY_HIEU,
                suggestedReason: `Khớp tương đối Serial/Ký hiệu (${chosen.KY_HIEU})`
            };
        }
    }

    // =========================================================================
    // Cấp 3: Khớp theo Khoa phòng & Tên thiết bị tương đồng loại dịch vụ
    // =========================================================================
    const normTenDv = removeVietnameseTones(tenDichVu);
    const matchedGroup = DEVICE_KEYWORD_GROUPS.find(grp =>
        grp.keywords.some(kw => normTenDv.includes(kw))
    );

    if (matchedGroup) {
        // 3.1. Tìm trong các máy thuộc đúng khoa chỉ định
        const deptMachines = mau06List.filter(m => m.ma_khoa_su_dung === maKhoa);
        const deptMatchedMachine = deptMachines.find(m => {
            const normTb = removeVietnameseTones(m.TEN_TB || '');
            return matchedGroup.deviceMatch.some(dm => normTb.includes(dm));
        });

        if (deptMatchedMachine) {
            return {
                suggestedMaMay: deptMatchedMachine.MA_MAY,
                suggestedTenTb: deptMatchedMachine.TEN_TB,
                suggestedKyHieu: deptMatchedMachine.KY_HIEU,
                suggestedReason: `Khớp Khoa (${maKhoa}) & Loại thiết bị (${deptMatchedMachine.TEN_TB})`
            };
        }

        // 3.2. Nếu cùng khoa không có, tìm trong toàn viện xem có loại máy tương ứng không
        const allMatchedMachine = mau06List.find(m => {
            const normTb = removeVietnameseTones(m.TEN_TB || '');
            return matchedGroup.deviceMatch.some(dm => normTb.includes(dm));
        });

        if (allMatchedMachine) {
            return {
                suggestedMaMay: allMatchedMachine.MA_MAY,
                suggestedTenTb: allMatchedMachine.TEN_TB,
                suggestedKyHieu: allMatchedMachine.KY_HIEU,
                suggestedReason: `Khớp loại thiết bị theo dịch vụ (${allMatchedMachine.TEN_TB})`
            };
        }
    }

    // =========================================================================
    // Cấp 4: Nếu máy chỉ có 1 máy duy nhất ở khoa đó
    // =========================================================================
    if (maKhoa) {
        const deptMachines = mau06List.filter(m => m.ma_khoa_su_dung === maKhoa);
        if (deptMachines.length === 1) {
            const only = deptMachines[0];
            return {
                suggestedMaMay: only.MA_MAY,
                suggestedTenTb: only.TEN_TB,
                suggestedKyHieu: only.KY_HIEU,
                suggestedReason: `Khoa (${maKhoa}) chỉ có 01 thiết bị trong Mẫu 06`
            };
        }
    }

    return {
        suggestedMaMay: '',
        suggestedTenTb: '',
        suggestedKyHieu: '',
        suggestedReason: 'Chưa xác định được máy phù hợp'
    };
}

/**
 * Chuẩn hóa khoảng trắng của mã máy theo 2 tùy chọn độc lập:
 * - trimEnds: bỏ khoảng trắng 2 đầu
 * - removeMiddle: bỏ khoảng trắng ở giữa (bên trong chuỗi)
 */
export function normalizeMachineWhitespace(
    text?: string | null,
    trimEnds: boolean = false,
    removeMiddle: boolean = false
): string {
    if (text === null || text === undefined) return '';
    let s = String(text);
    if (!trimEnds && !removeMiddle) return s;
    if (trimEnds && removeMiddle) return s.replace(/\s+/g, '');
    if (trimEnds) return s.trim();
    if (removeMiddle) {
        const leading = s.match(/^\s*/)?.[0] || '';
        const trailing = s.match(/\s*$/)?.[0] || '';
        return leading + s.trim().replace(/\s+/g, '') + trailing;
    }
    return s;
}

/**
 * Trích xuất giá trị trường dữ liệu từ item XML3 hoặc summary XML1 (hỗ trợ cả prefix XML1. và không phân biệt hoa thường)
 */
function extractXmlFieldValue(item: any, record: HosoRecord, fieldName: string): string {
    if (!fieldName) return '';
    const cleanField = fieldName.trim();

    let rawVal: any = undefined;
    if (cleanField.toUpperCase().startsWith('XML1.')) {
        const subKey = cleanField.slice(5);
        const summary: any = record.summary || {};
        rawVal = summary[subKey];
        if (rawVal === undefined) {
            const actualKey = Object.keys(summary).find(k => k.toLowerCase() === subKey.toLowerCase());
            if (actualKey) rawVal = summary[actualKey];
        }
    } else {
        rawVal = item?.[cleanField];
        if (rawVal === undefined && item) {
            const actualKey = Object.keys(item).find(k => k.toLowerCase() === cleanField.toLowerCase());
            if (actualKey) rawVal = item[actualKey];
        }
        if (rawVal === undefined && record.summary) {
            const summary: any = record.summary;
            rawVal = summary[cleanField];
            if (rawVal === undefined) {
                const actualKey = Object.keys(summary).find(k => k.toLowerCase() === cleanField.toLowerCase());
                if (actualKey) rawVal = summary[actualKey];
            }
        }
    }

    if (rawVal === null || rawVal === undefined) return '';
    if (typeof rawVal === 'object' && rawVal['#text'] !== undefined) {
        return String(rawVal['#text']).trim();
    }
    return String(rawVal).trim();
}

/**
 * Kiểm tra xem 1 dòng XML3 có thỏa mãn điều kiện kích hoạt của Rule (/rules) hay không:
 * - Trạng thái active
 * - Trường điều kiện (conditionField / conditionValue, ví dụ: MA_NHOM)
 * - Mã dịch vụ điều kiện (conditionMaDichVuValue)
 * - Trường loại trừ (excludeConditionField / excludeConditionValue, ví dụ loại trừ MA_NHOM = 10)
 */
export function matchesRuleConditions(item: any, record: HosoRecord, rule?: ValidationRule): boolean {
    if (!rule) return true;
    if (rule.active === false) return false;

    // 1. Điều kiện bắt buộc (VD: conditionField = 'MA_NHOM', conditionValue = '1,2,3,8,18')
    if (rule.conditionField && rule.conditionValue) {
        const valStr = extractXmlFieldValue(item, record, rule.conditionField);
        const allowedValues = rule.conditionValue.split(/[;,\n]+/).map(s => s.trim()).filter(Boolean);
        if (allowedValues.length > 0 && (!valStr || !allowedValues.includes(valStr))) {
            return false;
        }
    }

    // 2. Điều kiện mã dịch vụ
    if (rule.conditionMaDichVuValue) {
        const fieldToCheck = rule.conditionMaDichVu || 'MA_DICH_VU';
        const valStr = extractXmlFieldValue(item, record, fieldToCheck);
        const allowedValues = rule.conditionMaDichVuValue.split(/[;,\n]+/).map(s => s.trim()).filter(Boolean);
        if (allowedValues.length > 0 && (!valStr || !allowedValues.includes(valStr))) {
            return false;
        }
    }

    // 3. Điều kiện loại trừ (VD: excludeConditionField = 'MA_NHOM', excludeConditionValue = '10,11')
    if (rule.excludeConditionField && rule.excludeConditionValue) {
        const valStr = extractXmlFieldValue(item, record, rule.excludeConditionField);
        const excludedValues = rule.excludeConditionValue.split(/[;,\n]+/).map(s => s.trim()).filter(Boolean);
        if (valStr && excludedValues.includes(valStr)) {
            return false;
        }
    }

    return true;
}

export interface MachineAuditOptions {
    trimEnds?: boolean;
    removeMiddle?: boolean;
    applyRules?: boolean;
    mau06Rule?: ValidationRule;
    mau05Rule?: ValidationRule;
}

/**
 * Quét toàn bộ hồ sơ XML, đối soát mã máy và sắp xếp kết quả chuẩn theo:
 * MA_LK -> MA_BN -> NGAY_YL -> MA_DICH_VU
 */
export function auditMachineRecords(
    records: HosoRecord[],
    mau06List: MachineCatalogItem[],
    requiredServiceCodes: Set<string>,
    departments: Record<string, string> = {},
    options: MachineAuditOptions = {}
): {
    items: MachineAuditItem[];
    summary: MachineAuditSummary;
} {
    const trimEnds = Boolean(options.trimEnds);
    const removeMiddle = Boolean(options.removeMiddle);
    const applyRules = options.applyRules !== undefined ? options.applyRules : true;

    // 1. Tạo tập hợp mã máy hợp lệ trong Mẫu 06 theo cấu hình khoảng trắng
    const mau06MaMaySet = new Set<string>();
    mau06List.forEach(m => {
        if (m.MA_MAY !== undefined && m.MA_MAY !== null) {
            const normalized = normalizeMachineWhitespace(m.MA_MAY, trimEnds, removeMiddle);
            if (normalized !== '') mau06MaMaySet.add(normalized);
        }
    });

    const errorItems: MachineAuditItem[] = [];
    let totalXml3Scanned = 0;
    let totalNotInMau06 = 0;
    let totalMissingRequired = 0;
    const affectedHosoSet = new Set<string>();

    for (const record of records) {
        const maLk = String(record.id || record.summary?.MA_LK || '').trim();
        const maBn = String(record.summary?.MA_BN || '').trim();
        const hoTen = String(record.summary?.HO_TEN || '').trim();
        const ngayVao = String(record.summary?.NGAY_VAO || '').trim();
        const ngayRa = String(record.summary?.NGAY_RA || '').trim();
        const ngayVaoFormatted = formatXmlDate(ngayVao);
        const ngayRaFormatted = formatXmlDate(ngayRa);
        const ngayRaDateOnly = formatXmlDateOnly(ngayRa) || 'Khong_Xac_Dinh';

        const xml3Group = record.groups?.find(g => g.type === 'XML3');
        if (!xml3Group) continue;

        const xml3List = getXmlDataList(xml3Group);
        if (!Array.isArray(xml3List) || xml3List.length === 0) continue;

        for (const item of xml3List) {
            totalXml3Scanned++;

            const maDichVu = String(item.MA_DICH_VU || '').trim();
            const rawTenDv = String(item.TEN_DICH_VU || '').trim();
            const rawTenVt = String(item.TEN_VAT_TU || '').trim();
            const maNhom = String(item.MA_NHOM || '').trim();
            const tenDichVu = rawTenDv || (rawTenVt ? `[VTYT${maNhom ? ` - Nhóm ${maNhom}` : ''}] ${rawTenVt}` : '');
            const ngayYl = String(item.NGAY_YL || '').trim();
            // Lấy nguyên chuỗi gốc không tự ý trim khoảng trắng (có như thế nào kiểm tra thế)
            const rawMaMay = item.MA_MAY !== undefined && item.MA_MAY !== null ? String(item.MA_MAY) : '';
            // Chuỗi mã máy sau khi áp dụng tuỳ chọn khoảng trắng để so khớp
            const comparedMaMay = normalizeMachineWhitespace(rawMaMay, trimEnds, removeMiddle);

            const maKhoa = String(item.MA_KHOA || record.summary?.MA_KHOA || '').trim();
            const tenKhoa = departments[maKhoa] || maKhoa;

            const soLuong = Number(item.SO_LUONG) || 1;
            const donGia = Number(item.DON_GIA) || 0;
            const thanhTien = Number(item.THANH_TIEN) || (soLuong * donGia);

            let errorType: MachineAuditErrorType | null = null;
            let errorLabel = '';

            // Kiểm tra lỗi 1: Có mã máy nhưng không thuộc Mẫu 06
            if (comparedMaMay !== '' && comparedMaMay.trim() !== '') {
                const shouldCheckMau06 = applyRules
                    ? matchesRuleConditions(item, record, options.mau06Rule)
                    : true;
                if (shouldCheckMau06 && !mau06MaMaySet.has(comparedMaMay)) {
                    errorType = 'NOT_IN_MAU06';
                    errorLabel = 'Mã máy không thuộc Mẫu 06';
                    totalNotInMau06++;
                }
            } else {
                // Kiểm tra lỗi 2: Không có mã máy nhưng dịch vụ bắt buộc có theo Mẫu 05
                const shouldCheckMau05 = applyRules
                    ? matchesRuleConditions(item, record, options.mau05Rule)
                    : true;
                if (shouldCheckMau05 && maDichVu && requiredServiceCodes.has(maDichVu)) {
                    errorType = 'MISSING_REQUIRED';
                    errorLabel = 'Thiếu mã máy bắt buộc (Mẫu 05)';
                    totalMissingRequired++;
                }
            }

            // Nếu phát hiện vi phạm mã máy
            if (errorType) {
                affectedHosoSet.add(maLk);

                // Tìm đề xuất Mẫu 06
                const suggestion = findSuggestedMachine(
                    rawMaMay,
                    maDichVu,
                    tenDichVu,
                    maKhoa,
                    mau06List
                );

                errorItems.push({
                    maLk,
                    maBn,
                    hoTen,
                    ngayVao,
                    ngayVaoFormatted,
                    ngayRa,
                    ngayRaFormatted,
                    ngayRaDateOnly,
                    ngayYl,
                    ngayYlFormatted: formatXmlDate(ngayYl),
                    maDichVu,
                    tenDichVu,
                    maKhoa,
                    tenKhoa,
                    maMayXml: rawMaMay,
                    errorType,
                    errorLabel,
                    suggestedMaMay: suggestion.suggestedMaMay,
                    suggestedTenTb: suggestion.suggestedTenTb,
                    suggestedKyHieu: suggestion.suggestedKyHieu,
                    suggestedReason: suggestion.suggestedReason,
                    soLuong,
                    donGia,
                    thanhTien
                });
            }
        }
    }

    // =========================================================================
    // SẮP XẾP THEO YÊU CẦU: MA_LK -> MA_BN -> NGAY_YL -> MA_DICH_VU
    // =========================================================================
    errorItems.sort((a, b) => {
        // 1. MA_LK
        const cmpLk = a.maLk.localeCompare(b.maLk, undefined, { numeric: true });
        if (cmpLk !== 0) return cmpLk;

        // 2. MA_BN
        const cmpBn = a.maBn.localeCompare(b.maBn, undefined, { numeric: true });
        if (cmpBn !== 0) return cmpBn;

        // 3. NGAY_YL
        const cmpYl = a.ngayYl.localeCompare(b.ngayYl);
        if (cmpYl !== 0) return cmpYl;

        // 4. MA_DICH_VU
        return a.maDichVu.localeCompare(b.maDichVu, undefined, { numeric: true });
    });

    // Đánh số thứ tự (STT) sau khi đã sắp xếp
    errorItems.forEach((item, index) => {
        item.stt = index + 1;
    });

    const totalWithSuggestions = errorItems.filter(i => Boolean(i.suggestedMaMay)).length;

    const summary: MachineAuditSummary = {
        totalXml3Scanned,
        totalErrors: errorItems.length,
        totalNotInMau06,
        totalMissingRequired,
        totalWithSuggestions,
        totalHosoAffected: affectedHosoSet.size
    };

    return {
        items: errorItems,
        summary
    };
}

