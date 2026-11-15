import { HosoRecord, getXmlDataList } from '@/lib/xml';

export type BedDaysCaseGroup = 1 | 2 | 3 | 4 | 0;

export type BedDaysAuditStatus = 'CORRECT' | 'OVER_BED' | 'UNDER_BED' | 'INVALID_KCB';

export interface BedDaysRecordAudit {
    maLk: string;
    maBn: string;
    hoTen: string;
    maKhoa: string;
    tenKhoa: string;
    maKhoaRv: string;
    tenKhoaRv: string;
    maKhoaChiDinhList: string[];
    tenKhoaChiDinhList: string[];
    tenKhoaChiDinhStr: string;
    maLoaiKcb: string;
    tenLoaiKcb: string;
    ngayVaoStr: string;
    ngayRaStr: string;
    ketQuaDtri: string;
    tenKetQuaDtri: string;
    maLoaiRv: string;
    tenLoaiRv: string;
    durationMinutes: number;
    durationHours: number;
    diffCalendarDays: number;
    caseGroup: BedDaysCaseGroup;
    caseGroupDesc: string;
    sChuan: number;
    sThucTe: number;
    diffDays: number; // sThucTe - sChuan
    status: BedDaysAuditStatus;
    statusDesc: string;
    detailedReason: string; // Lý do & căn cứ chi tiết vì sao đúng/sai
    maBenhChinh: string; // Mã bệnh chính XML1
    tenBenhChinh: string; // Tên bệnh chính
    isExemptNewborn: boolean; // Trẻ sơ sinh nằm cùng mẹ (Z38) được miễn giường
    warn09: boolean; // Nằm <= 4h nhưng đang ghi mã 03 thay vì 09
    warnNgoaiTruGiuong: boolean; // Ngoại trú kê giường nội trú
    estimatedOverCost: number; // Tiền chênh lệch xuất toán (nếu thừa giường)
    totalBedCost: number; // Tổng tiền giường kê khai
    bedServicesCount: number; // Số dòng giường trong XML3
    rawRecord: HosoRecord;
}

export interface DepartmentBedSummary {
    maKhoa: string;
    tenKhoa: string;
    totalRecords: number;
    correctCount: number;
    overCount: number;
    underCount: number;
    warn09Count: number;
    totalOverBedDays: number;
    totalUnderBedDays: number;
    complianceRate: number; // Tỷ lệ đúng (%)
    estimatedOverCost: number; // Ước tính tiền xuất toán
    totalBedCost: number;
}

export const MA_LOAI_KCB_MAP: Record<string, string> = {
    '01': 'Khám bệnh',
    '02': 'Điều trị ngoại trú',
    '03': 'Điều trị nội trú',
    '04': 'Điều trị ban ngày',
    '05': 'Điều trị ngoại trú dài ngày (khám & lĩnh thuốc)',
    '06': 'Lưu người bệnh tại PKĐK/TYT',
    '07': 'Nhận thuốc theo hẹn',
    '08': 'Điều trị ngoại trú dài ngày (DVKT & thuốc)',
    '09': 'Điều trị nội trú dưới 04 giờ',
    '10': 'Các trường hợp khác',
    '11': 'KCB lưu động'
};

export const KET_QUA_DTRI_MAP: Record<string, string> = {
    '1': 'Khỏi',
    '2': 'Đỡ',
    '3': 'Không thay đổi',
    '4': 'Nặng hơn',
    '5': 'Tử vong tại cơ sở KBCB',
    '6': 'Tiên lượng nặng xin về',
    '7': 'Chưa xác định',
    '8': 'Tử vong ngoại viện'
};

export const MA_LOAI_RV_MAP: Record<string, string> = {
    '1': 'Ra viện',
    '2': 'Chuyển cơ sở KBCB theo yêu cầu chuyên môn',
    '3': 'Trốn viện',
    '4': 'Xin ra viện',
    '5': 'Chuyển cơ sở KBCB theo yêu cầu người bệnh'
};

/**
 * Phân tích chuỗi ngày giờ XML YYYYMMDDHHmm hoặc YYYYMMDDHHmmss hoặc YYYYMMDD
 */
export function parseXmlDateTime(dateStr: any): Date | null {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    if (s.length >= 12) {
        const year = parseInt(s.substring(0, 4), 10);
        const month = parseInt(s.substring(4, 6), 10) - 1;
        const day = parseInt(s.substring(6, 8), 10);
        const hour = parseInt(s.substring(8, 10), 10);
        const minute = parseInt(s.substring(10, 12), 10);
        return new Date(year, month, day, hour, minute);
    }
    if (s.length >= 8) {
        const year = parseInt(s.substring(0, 4), 10);
        const month = parseInt(s.substring(4, 6), 10) - 1;
        const day = parseInt(s.substring(6, 8), 10);
        return new Date(year, month, day);
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

export function formatXmlDateDisplay(dateStr: any): string {
    if (!dateStr) return '';
    const s = String(dateStr).trim();
    if (s.length >= 12) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)} ${s.substring(8, 10)}:${s.substring(10, 12)}`;
    }
    if (s.length >= 8) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)}`;
    }
    return s;
}

/**
 * Parse danh sách mã nhóm giường từ chuỗi cấu hình (ví dụ: "14,15")
 */
export function parseAllowedMaNhom(conditionValue?: string | null): string[] {
    if (!conditionValue || typeof conditionValue !== 'string') {
        return ['14', '15'];
    }
    const list = conditionValue
        .split(/[;,\s]+/)
        .map(s => s.trim())
        .filter(Boolean);
    return list.length > 0 ? list : ['14', '15'];
}

/**
 * Parse danh sách mã bệnh chính loại trừ (ví dụ: Z38.0, Z38)
 */
export function parseExcludedMaBenh(excludeValue?: string | null): string[] {
    if (!excludeValue || typeof excludeValue !== 'string') {
        return ['Z38', 'Z38.0', 'Z38.1', 'Z38.2', 'Z38.3', 'Z38.4', 'Z38.5', 'Z38.6', 'Z38.7', 'Z38.8'];
    }
    const list = excludeValue
        .split(/[;,\s]+/)
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);
    return list.length > 0 ? list : ['Z38', 'Z38.0'];
}

/**
 * Kiểm toán và đối chiếu số ngày giường chuẩn (XML1) so với thực tế (XML3) cho 1 hồ sơ
 */
export function calculateBedDaysForRecord(
    record: HosoRecord,
    allowedMaNhom: string[] = ['14', '15'],
    departmentsMap: Record<string, string> = {},
    excludedMaBenhList: string[] = ['Z38', 'Z38.0', 'Z38.1', 'Z38.2', 'Z38.3', 'Z38.4', 'Z38.5', 'Z38.6', 'Z38.7', 'Z38.8']
): BedDaysRecordAudit {
    const summary = record.summary || {};
    const maLk = String(summary.MA_LK || record.id || '').trim();
    const maBn = String(summary.MA_BN || '').trim();
    const hoTen = String(summary.HO_TEN || '').trim();

    // Mã bệnh chính và tên bệnh
    const maBenhChinh = String(summary.MA_BENH_CHINH || summary.MA_BENH || '').trim().toUpperCase();
    const tenBenhChinh = String(summary.TEN_BENH || summary.TEN_BENH_CHINH || '').trim();

    // 0. Trích xuất Khoa ra viện (Ưu tiên XML7 -> XML1)
    let maKhoaRv = '';
    const xml7Group = record.groups?.find(g => g.type === 'XML7');
    if (xml7Group) {
        const xml7List = getXmlDataList(xml7Group);
        const firstXml7 = Array.isArray(xml7List) && xml7List.length > 0
            ? (xml7List[xml7List.length - 1] || xml7List[0])
            : ((xml7Group.data as any)?.CHITIEU_DU_LIEU_GIAY_RA_VIEN?.GIAY_RA_VIEN || (xml7Group.data as any)?.GIAY_RA_VIEN || xml7Group.data);
        const target = Array.isArray(firstXml7) ? (firstXml7[firstXml7.length - 1] || firstXml7[0]) : firstXml7;
        const val = target?.MA_KHOA_RV || target?.ma_khoa_rv;
        if (val) maKhoaRv = String(val).trim();
    }
    if (!maKhoaRv) {
        maKhoaRv = String(summary.MA_KHOA_RV || summary.MA_KHOA || '').trim();
    }
    const tenKhoaRv = departmentsMap[maKhoaRv] || summary.TEN_KHOA || maKhoaRv || 'Chưa xác định';

    const maLoaiKcb = String(summary.MA_LOAI_KCB || '').trim();
    const tenLoaiKcb = MA_LOAI_KCB_MAP[maLoaiKcb] || (maLoaiKcb ? `Loại ${maLoaiKcb}` : 'Chưa có');

    const ngayVaoRaw = summary.NGAY_VAO_NOI_TRU || summary.NGAY_VAO;
    const ngayRaRaw = summary.NGAY_RA;
    const ngayVaoStr = String(ngayVaoRaw || '').trim();
    const ngayRaStr = String(ngayRaRaw || '').trim();

    const ketQuaDtri = String(summary.KET_QUA_DTRI || '').trim();
    const tenKetQuaDtri = KET_QUA_DTRI_MAP[ketQuaDtri] || (ketQuaDtri ? `Mã ${ketQuaDtri}` : '');

    const maLoaiRv = String(summary.MA_LOAI_RV || '').trim();
    const tenLoaiRv = MA_LOAI_RV_MAP[maLoaiRv] || (maLoaiRv ? `Mã ${maLoaiRv}` : '');

    // 1. Tính mốc thời gian và số ngày
    const dateVao = parseXmlDateTime(ngayVaoStr);
    const dateRa = parseXmlDateTime(ngayRaStr);

    let durationMinutes = 0;
    let diffCalendarDays = 0;

    if (dateVao && dateRa) {
        durationMinutes = Math.round((dateRa.getTime() - dateVao.getTime()) / (1000 * 60));
        const calDayVao = new Date(dateVao.getFullYear(), dateVao.getMonth(), dateVao.getDate());
        const calDayRa = new Date(dateRa.getFullYear(), dateRa.getMonth(), dateRa.getDate());
        diffCalendarDays = Math.round((calDayRa.getTime() - calDayVao.getTime()) / (1000 * 60 * 60 * 24));
    }

    const durationHours = Math.round((durationMinutes / 60) * 10) / 10;

    // 2. Tính tổng số lượng giường thực tế từ XML3
    const xml3Group = record.groups?.find(g => g.type === 'XML3');
    const xml3Items = getXmlDataList(xml3Group);

    let sThucTe = 0;
    let totalBedCost = 0;
    let bedServicesCount = 0;
    let hasGiuongNoiTru = false;
    let averageBedUnitPrice = 0;
    const chiDinhKhoaSet = new Set<string>();

    if (Array.isArray(xml3Items)) {
        xml3Items.forEach(item => {
            const itemMaNhom = String(item.MA_NHOM || '').trim();
            if (allowedMaNhom.includes(itemMaNhom)) {
                bedServicesCount++;
                const qty = Number(item.SO_LUONG) || 0;
                const cost = Number(item.THANH_TIEN) || (qty * (Number(item.DON_GIA) || 0));
                sThucTe += qty;
                totalBedCost += cost;
                if (itemMaNhom === '14') {
                    hasGiuongNoiTru = true;
                }
                if (item.MA_KHOA) {
                    const k = String(item.MA_KHOA).trim();
                    if (k) chiDinhKhoaSet.add(k);
                }
            }
        });
        if (sThucTe > 0 && totalBedCost > 0) {
            averageBedUnitPrice = totalBedCost / sThucTe;
        }
    }

    const maKhoaChiDinhList = Array.from(chiDinhKhoaSet);
    const tenKhoaChiDinhList = maKhoaChiDinhList.map(k => {
        const name = departmentsMap[k];
        return name ? `${k} - ${name}` : k;
    });
    const tenKhoaChiDinhStr = tenKhoaChiDinhList.join('; ');

    // Khoa chính của hồ sơ: Ưu tiên Khoa ra viện (XML7/XML1), sau đó đến Khoa chỉ định (XML3)
    const maKhoa = maKhoaRv || (maKhoaChiDinhList[0] || String(summary.MA_KHOA || 'UNKNOWN').trim());
    const tenKhoa = departmentsMap[maKhoa] || summary.TEN_KHOA || (maKhoaRv ? tenKhoaRv : maKhoa);

    // Làm tròn 2 chữ số thập phân cho số lượng thực tế
    sThucTe = Math.round(sThucTe * 100) / 100;

    // 3. Phân loại 4 Nhóm Ca và tính S_chuẩn
    let caseGroup: BedDaysCaseGroup = 0;
    let caseGroupDesc = 'Chưa xác định';
    let sChuan = 0;
    let warn09 = false;
    let warnNgoaiTruGiuong = false;

    // Trường hợp kiểm tra đặc biệt: Ngoại trú thông thường kê giường nội trú
    const isNgoaiTru = ['01', '02', '05', '06', '07', '08'].includes(maLoaiKcb);
    if (isNgoaiTru && hasGiuongNoiTru) {
        warnNgoaiTruGiuong = true;
    }

    if (maLoaiKcb === '09') {
        // Mã 09: Điều trị nội trú dưới 04 giờ -> Bắt buộc S_chuẩn = 0
        caseGroup = 1;
        caseGroupDesc = 'Mã 09: Nội trú < 4 giờ (Không được thu giường)';
        sChuan = 0;
    } else if (durationMinutes <= 240) {
        // Nhóm 1: Nằm <= 4 giờ (<= 240 phút) dù trong ngày hay qua đêm
        caseGroup = 1;
        caseGroupDesc = 'Nhóm 1: Nằm ≤ 4 giờ (Không được thu tiền giường)';
        sChuan = 0;
        if (maLoaiKcb === '03') {
            warn09 = true; // Hồ sơ điều trị nội trú dưới 4h nên đổi sang mã 09
        }
    } else if (diffCalendarDays === 0 && durationMinutes > 240) {
        // Nhóm 2: Vào và Ra trong cùng 1 ngày (> 4 giờ)
        caseGroup = 2;
        caseGroupDesc = 'Nhóm 2: Vào ra trong ngày (> 4 giờ) - Tính 1 ngày giường';
        sChuan = 1;
    } else if (diffCalendarDays > 0 && durationMinutes > 240) {
        // Khác ngày (> 4 giờ)
        const isDeathOrTransfer = ['5', '6', '8'].includes(ketQuaDtri) || maLoaiRv === '2';
        if (isDeathOrTransfer) {
            // Nhóm 4: Tử vong, Nặng xin về, Chuyển cơ sở KBCB theo yêu cầu chuyên môn
            caseGroup = 4;
            caseGroupDesc = `Nhóm 4: Nằm khác ngày - Tử vong/Chuyển tuyến (${tenKetQuaDtri || 'Tử vong'} / ${tenLoaiRv || 'Chuyển tuyến'}) - Tính ngày ra trừ ngày vào + 1`;
            sChuan = diffCalendarDays + 1;
        } else {
            // Nhóm 3: Ra viện thông thường
            caseGroup = 3;
            caseGroupDesc = 'Nhóm 3: Nằm khác ngày - Ra viện thông thường - Tính ngày ra trừ ngày vào';
            sChuan = diffCalendarDays;
        }
    }

    // Nếu là ngoại trú thông thường và không phải ban ngày (04), chuẩn giường nội trú là 0
    if (isNgoaiTru) {
        sChuan = 0;
    }

    // Kiểm tra trẻ sơ sinh nằm cùng mẹ theo cấu hình loại trừ mã bệnh chính (Z38)
    const isNewbornMatched = excludedMaBenhList.some(ex => {
        const cleanEx = ex.trim().toUpperCase();
        return maBenhChinh === cleanEx || maBenhChinh.startsWith(cleanEx);
    });
    // Trẻ sơ sinh nằm cùng mẹ: không kê ngày giường ở XML3 (sThucTe === 0)
    const isExemptNewborn = isNewbornMatched && sThucTe === 0;

    // 4. Đánh giá trạng thái
    const diffDays = Math.round((sThucTe - sChuan) * 100) / 100;
    let status: BedDaysAuditStatus = 'CORRECT';
    let statusDesc = 'Đúng chuẩn số ngày giường';
    let estimatedOverCost = 0;

    if (warnNgoaiTruGiuong) {
        status = 'INVALID_KCB';
        statusDesc = `Sai loại hình KCB: Hồ sơ ${tenLoaiKcb} nhưng kê giường nội trú (${sThucTe} ngày)`;
        estimatedOverCost = totalBedCost;
    } else if (isExemptNewborn) {
        status = 'CORRECT';
        statusDesc = `Khớp chuẩn: Trẻ sơ sinh nằm cùng mẹ (Mã bệnh: ${maBenhChinh}) - Miễn thu tiền giường`;
    } else if (diffDays === 0) {
        status = 'CORRECT';
        statusDesc = `Khớp chuẩn: Kê ${sThucTe} ngày / Chuẩn ${sChuan} ngày`;
    } else if (diffDays > 0) {
        status = 'OVER_BED';
        statusDesc = `Kê THỪA ${diffDays} ngày giường (XML3 kê: ${sThucTe}, Chuẩn: ${sChuan}) -> Xuất toán BHYT`;
        estimatedOverCost = Math.round(diffDays * averageBedUnitPrice);
    } else {
        status = 'UNDER_BED';
        statusDesc = `Kê THIẾU ${Math.abs(diffDays)} ngày giường (XML3 kê: ${sThucTe}, Chuẩn: ${sChuan}) -> Thất thu`;
    }

    // 5. Tạo dòng Lý do & Căn cứ chi tiết
    let detailedReason = '';
    const ngayVaoNgay = ngayVaoStr ? formatXmlDateDisplay(ngayVaoStr).split(' ')[0] : '';
    const ngayRaNgay = ngayRaStr ? formatXmlDateDisplay(ngayRaStr).split(' ')[0] : '';

    if (warnNgoaiTruGiuong) {
        detailedReason = `Căn cứ: MA_LOAI_KCB = ${maLoaiKcb} (${tenLoaiKcb}) là loại hình khám/ngoại trú -> Không được phép thanh toán giường nội trú nhóm 14. Thực tế XML3 kê ${sThucTe} ngày giường -> Sai loại hình KCB (Xuất toán 100%).`;
    } else if (isExemptNewborn) {
        detailedReason = `Căn cứ: MA_BENH_CHINH = ${maBenhChinh} (${tenBenhChinh || 'Trẻ sinh ra sống'}) là trẻ sơ sinh sinh tại viện nằm ghép cùng mẹ -> Không kê tiền giường riêng ở XML3 theo quy định BHYT (Hồ sơ hợp lệ được loại trừ theo Rules).`;
    } else if (maLoaiKcb === '09') {
        detailedReason = `Căn cứ: MA_LOAI_KCB = 09 (${tenLoaiKcb}), thời gian nằm ${durationHours}h (${durationMinutes} phút ≤ 240 phút) -> Thuộc Nhóm 1, Giường chuẩn = 0 ngày. Thực tế XML3 kê ${sThucTe} ngày -> ${diffDays > 0 ? `Kê THỪA ${diffDays} ngày giường (Xuất toán 100%)` : 'Đúng chuẩn không thu tiền giường'}.`;
    } else if (caseGroup === 1) {
        detailedReason = `Căn cứ: Tổng thời gian nằm T = ${durationHours}h (${durationMinutes} phút ≤ 240 phút = 4h) -> Thuộc Nhóm 1, theo quy định BHYT không được thu tiền giường (Giường chuẩn = 0 ngày). Thực tế XML3 kê ${sThucTe} ngày -> ${diffDays > 0 ? `Kê THỪA ${diffDays} ngày giường (Xuất toán BHYT 100%).` : 'Đúng chuẩn không thu tiền giường.'}${warn09 ? ' (Lưu ý: Ca điều trị nội trú dưới 4h nên đổi MA_LOAI_KCB sang mã 09).' : ''}`;
    } else if (caseGroup === 2) {
        detailedReason = `Căn cứ: MA_LOAI_KCB = ${maLoaiKcb}, vào và ra trong cùng ngày (${ngayVaoNgay}), thời gian nằm ${durationHours}h (> 4h) -> Thuộc Nhóm 2, theo quy định chỉ tính tròn 1 ngày giường (Giường chuẩn = 1). Thực tế XML3 kê ${sThucTe} ngày -> ${diffDays === 0 ? 'Đúng chuẩn 1 ngày giường.' : diffDays > 0 ? `Kê THỪA ${diffDays} ngày giường (Xuất toán do cộng dồn sai).` : `Kê THIẾU ${Math.abs(diffDays)} ngày giường (Thất thu viện phí).`}`;
    } else if (caseGroup === 4) {
        const lyDoNhom4 = ['5', '6', '8'].includes(ketQuaDtri)
            ? `KET_QUA_DTRI = ${ketQuaDtri} (${tenKetQuaDtri})`
            : `MA_LOAI_RV = ${maLoaiRv} (${tenLoaiRv})`;
        detailedReason = `Căn cứ: MA_LOAI_KCB = ${maLoaiKcb}, thời gian nằm ${durationHours}h (> 4h, lệch ${diffCalendarDays} ngày lịch), ${lyDoNhom4} -> Thuộc Nhóm 4 (${tenKetQuaDtri || tenLoaiRv || 'Tử vong/Chuyển tuyến'}), được tính thêm ngày ra viện: Giường chuẩn = (Ngày ra - Ngày vào) + 1 = ${diffCalendarDays} + 1 = ${sChuan} ngày. Thực tế XML3 kê ${sThucTe} ngày -> ${diffDays === 0 ? 'Đúng chuẩn được cộng ngày ra viện.' : diffDays > 0 ? `Kê THỪA ${diffDays} ngày giường (Xuất toán BHYT).` : `Kê THIẾU ${Math.abs(diffDays)} ngày giường (Khoa chưa cộng thêm ngày ra viện theo chế độ).`}`;
    } else {
        // Nhóm 3: Ra viện thông thường
        detailedReason = `Căn cứ: MA_LOAI_KCB = ${maLoaiKcb}, thời gian nằm ${durationHours}h (> 4h, lệch ${diffCalendarDays} ngày lịch: ${ngayVaoNgay} -> ${ngayRaNgay}), KET_QUA_DTRI = ${ketQuaDtri || 'chưa ghi'} (${tenKetQuaDtri || 'thông thường'}), MA_LOAI_RV = ${maLoaiRv || '1'} (${tenLoaiRv || 'Ra viện'}) -> Thuộc Nhóm 3 (Ra viện thông thường), công thức Giường chuẩn = Ngày ra - Ngày vào = ${sChuan} ngày. Thực tế XML3 kê ${sThucTe} ngày -> ${diffDays === 0 ? 'Đúng chuẩn số ngày giường.' : diffDays > 0 ? `Kê THỪA ${diffDays} ngày giường (Xuất toán BHYT).` : `Kê THIẾU ${Math.abs(diffDays)} ngày giường (Thất thu viện phí).`}`;
    }

    return {
        maLk,
        maBn,
        hoTen,
        maKhoa,
        tenKhoa,
        maKhoaRv,
        tenKhoaRv,
        maKhoaChiDinhList,
        tenKhoaChiDinhList,
        tenKhoaChiDinhStr,
        maLoaiKcb,
        tenLoaiKcb,
        ngayVaoStr,
        ngayRaStr,
        ketQuaDtri,
        tenKetQuaDtri,
        maLoaiRv,
        tenLoaiRv,
        durationMinutes,
        durationHours,
        diffCalendarDays,
        caseGroup,
        caseGroupDesc,
        sChuan,
        sThucTe,
        diffDays,
        status,
        statusDesc,
        detailedReason,
        maBenhChinh,
        tenBenhChinh,
        isExemptNewborn,
        warn09,
        warnNgoaiTruGiuong,
        estimatedOverCost,
        totalBedCost,
        bedServicesCount,
        rawRecord: record
    };
}

/**
 * Gom nhóm và tổng hợp đối soát theo từng Khoa/Phòng
 */
export function aggregateDepartmentBedAudit(audits: BedDaysRecordAudit[]): DepartmentBedSummary[] {
    const map = new Map<string, DepartmentBedSummary>();

    audits.forEach(item => {
        const key = item.maKhoa || 'UNKNOWN';
        let dept = map.get(key);
        if (!dept) {
            dept = {
                maKhoa: key,
                tenKhoa: item.tenKhoa || key,
                totalRecords: 0,
                correctCount: 0,
                overCount: 0,
                underCount: 0,
                warn09Count: 0,
                totalOverBedDays: 0,
                totalUnderBedDays: 0,
                complianceRate: 100,
                estimatedOverCost: 0,
                totalBedCost: 0
            };
            map.set(key, dept);
        }

        // Chỉ tổng hợp những hồ sơ có phát sinh giường hoặc là hồ sơ nội trú
        dept.totalRecords++;
        dept.totalBedCost += item.totalBedCost;

        if (item.warn09) {
            dept.warn09Count++;
        }

        if (item.status === 'CORRECT') {
            dept.correctCount++;
        } else if (item.status === 'OVER_BED' || item.status === 'INVALID_KCB') {
            dept.overCount++;
            dept.totalOverBedDays += Math.max(0, item.diffDays);
            dept.estimatedOverCost += item.estimatedOverCost;
        } else if (item.status === 'UNDER_BED') {
            dept.underCount++;
            dept.totalUnderBedDays += Math.abs(item.diffDays);
        }
    });

    const result = Array.from(map.values()).map(dept => {
        dept.complianceRate = dept.totalRecords > 0
            ? Math.round((dept.correctCount / dept.totalRecords) * 1000) / 10
            : 100;
        dept.totalOverBedDays = Math.round(dept.totalOverBedDays * 10) / 10;
        dept.totalUnderBedDays = Math.round(dept.totalUnderBedDays * 10) / 10;
        dept.estimatedOverCost = Math.round(dept.estimatedOverCost);
        dept.totalBedCost = Math.round(dept.totalBedCost);
        return dept;
    });

    // Sắp xếp: Khoa có nhiều ca sai / tiền xuất toán nhiều nhất lên đầu
    return result.sort((a, b) => (b.overCount + b.underCount) - (a.overCount + a.underCount) || b.estimatedOverCost - a.estimatedOverCost);
}

