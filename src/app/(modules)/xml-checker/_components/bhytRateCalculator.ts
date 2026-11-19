import { HosoRecord, getXmlDataList } from '@/lib/xml';

export interface BhytCardItem {
    cardCode: string;
    standardRate: number; // 80, 95, 100
    tu: string; // YYYYMMDD
    den: string; // YYYYMMDD
}

export type BhytRateErrorType =
    | 'OUT_OF_CARD_DATE'          // Chỉ định dịch vụ ngoài hạn thẻ BHYT
    | 'MISSING_MIEN_CCT'          // Kê khai 100% nhưng thiếu NGAY_MIEN_CCT trên XML1
    | 'NOT_UPGRADED_100'          // Chưa nâng lên 100% sau thời điểm miễn cùng chi trả
    | 'EARLY_100'                 // Tính sớm 100% trước thời điểm miễn cùng chi trả
    | 'WRONG_CARD_RATE'           // Áp sai mức hưởng theo ký tự thứ 3 của thẻ
    | 'WRONG_DOITUONG_113_RATE'   // Áp sai mức hưởng đối tượng 1.13 (chuẩn 50%, kê khai >= 80%)
    | 'INCONSISTENT_CARD_RATE'     // Không đồng nhất mức hưởng trên cùng một thẻ
    | 'SPLIT_DATE_INCONSISTENT';   // Nhảy tỷ lệ trong ngày chuyển giao gối 2 thẻ

export interface BhytRateErrorItem {
    type: BhytRateErrorType;
    xmlType: 'XML1' | 'XML2' | 'XML3';
    code?: string;
    name?: string;
    ngayYl?: string;
    actualRate?: number;
    expectedRate?: number;
    cardCode?: string;
    message: string;
    index?: number; // Chỉ số dòng gốc (0-indexed) trong bảng XML2 hoặc XML3
    field?: string; // Tên trường vi phạm, mặc định là TYLE_TT_BH
}

export interface BhytRateAuditResult {
    isError: boolean;
    errors: BhytRateErrorItem[];
    summaryMessage: string;
    detailedReason: string;
    cards: BhytCardItem[];
    ngayMienCct: string;
    linesAudited: number;
    linesError: number;
}

/**
 * Quy đổi ký tự thứ 3 của mã thẻ BHYT ra tỷ lệ thanh toán chuẩn:
 * - Ký tự là 1, 2, 5 -> 100%
 * - Ký tự là 3 -> 95%
 * - Ký tự là 4 -> 80%
 */
export function getStandardRateFromCard(cardCode: string): number | null {
    if (!cardCode || typeof cardCode !== 'string') return null;
    const clean = cardCode.trim();
    if (clean.length < 3) return null;
    const char3 = clean.charAt(2);
    if (char3 === '1' || char3 === '2' || char3 === '5') return 100;
    if (char3 === '3') return 95;
    if (char3 === '4') return 80;
    return null;
}

/**
 * Phân tích danh sách thẻ BHYT và hạn sử dụng từ XML1 (hỗ trợ phân tách dấu ;)
 */
export function parseBhytCards(summary: any): BhytCardItem[] {
    const rawCard = String(summary?.MA_THE_BHYT || summary?.MA_THE || '').trim();
    const rawTu = String(summary?.GT_THE_TU || '').trim();
    const rawDen = String(summary?.GT_THE_DEN || '').trim();

    if (!rawCard) return [];

    const cardList = rawCard.split(';').map(s => s.trim()).filter(Boolean);
    const tuList = rawTu.split(';').map(s => s.trim()).filter(Boolean);
    const denList = rawDen.split(';').map(s => s.trim()).filter(Boolean);

    const maDoiTuongKcb = String(summary?.MA_DOITUONG_KCB || summary?.MA_DOITUONG || '').trim();
    const isDoiTuong113 = maDoiTuongKcb === '1.13';

    return cardList.map((cardCode, idx) => {
        const tu = tuList[idx] || tuList[0] || '';
        const den = denList[idx] || denList[0] || '';
        const standardRate = isDoiTuong113 ? 50 : (getStandardRateFromCard(cardCode) ?? 80);
        return {
            cardCode,
            standardRate,
            tu: tu.substring(0, 8),
            den: den.substring(0, 8)
        };
    });
}

/**
 * Kiểm tra mốc thời gian chỉ định (NGAY_YL) có từ thời điểm miễn cùng chi trả (NGAY_MIEN_CCT) trở đi hay không:
 * - Nếu NGAY_MIEN_CCT có 8 ký tự (YYYYMMDD): So sánh phần ngày (8 ký tự).
 * - Nếu NGAY_MIEN_CCT có 12 ký tự (YYYYMMDDHHmm): So sánh đủ đến cả giờ, phút (12 ký tự).
 */
export function isAfterOrEqualMienCct(ngayYl: string, ngayMienCct: string): boolean {
    if (!ngayYl || !ngayMienCct) return false;
    const cleanYl = String(ngayYl).trim();
    const cleanMien = String(ngayMienCct).trim();

    if (cleanMien.length <= 8) {
        const ylDate = cleanYl.substring(0, 8);
        const mienDate = cleanMien.substring(0, 8);
        return ylDate >= mienDate;
    }

    const ylDateTime = cleanYl.length >= 12 ? cleanYl.substring(0, 12) : cleanYl.padEnd(12, '0');
    const mienDateTime = cleanMien.length >= 12 ? cleanMien.substring(0, 12) : cleanMien.padEnd(12, '0');
    return ylDateTime >= mienDateTime;
}

/**
 * Định dạng ngày giờ XML để hiển thị thân thiện (dd/MM/yyyy hoặc dd/MM/yyyy HH:mm)
 */
export function formatXmlDateTime(dateStr: string): string {
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

interface AuditableLine {
    xmlType: 'XML2' | 'XML3';
    index: number; // Chỉ số dòng gốc (0-indexed) trong bảng XML2 hoặc XML3
    code: string;
    name: string;
    ngayYl: string;
    ngayYlDate: string; // 8 ký tự
    actualRate: number; // TYLE_TT_BH
    rawItem: any;
}

/**
 * Thực hiện kiểm toán toàn diện tỷ lệ thanh toán BHYT (XML1 vs XML2, XML3)
 */
export function auditBhytRatesForRecord(record: HosoRecord): BhytRateAuditResult {
    const summary = record.summary || {};
    const cards = parseBhytCards(summary);
    const ngayMienCct = String(summary.NGAY_MIEN_CCT || '').trim();

    const errors: BhytRateErrorItem[] = [];

    // Nếu hồ sơ không có thẻ BHYT nào
    if (cards.length === 0) {
        return {
            isError: false,
            errors: [],
            summaryMessage: 'Không có thông tin thẻ BHYT để kiểm toán',
            detailedReason: '',
            cards: [],
            ngayMienCct,
            linesAudited: 0,
            linesError: 0
        };
    }

    // 1. Trích xuất toàn bộ dòng ở XML2 (Thuốc) và XML3 (DVKT & Vật tư)
    const rawLines: AuditableLine[] = [];

    // XML2 (Thuốc)
    const xml2Group = record.groups?.find(g => g.type === 'XML2');
    const xml2Items = getXmlDataList(xml2Group);
    if (Array.isArray(xml2Items)) {
        xml2Items.forEach((item, idx) => {
            const rawTyleBh = item.TYLE_TT_BH !== undefined && item.TYLE_TT_BH !== null && String(item.TYLE_TT_BH).trim() !== ''
                ? Number(item.TYLE_TT_BH)
                : null;
            const rawTyleDv = item.TYLE_TT_DV !== undefined && item.TYLE_TT_DV !== null && String(item.TYLE_TT_DV).trim() !== ''
                ? Number(item.TYLE_TT_DV)
                : 100;

            // Bộ lọc loại trừ: Bỏ qua dòng tự túc (TYLE_TT_BH = 0) và dịch vụ có tỷ lệ riêng (TYLE_TT_DV < 100)
            if (rawTyleBh === null || isNaN(rawTyleBh) || rawTyleBh === 0) return;
            if (!isNaN(rawTyleDv) && rawTyleDv < 100) return;

            const ngayYl = String(item.NGAY_YL || '').trim();
            rawLines.push({
                xmlType: 'XML2',
                index: idx,
                code: String(item.MA_THUOC || '').trim(),
                name: String(item.TEN_THUOC || '').trim(),
                ngayYl,
                ngayYlDate: ngayYl.substring(0, 8),
                actualRate: rawTyleBh,
                rawItem: item
            });
        });
    }

    // XML3 (DVKT & Vật tư)
    const xml3Group = record.groups?.find(g => g.type === 'XML3');
    const xml3Items = getXmlDataList(xml3Group);
    if (Array.isArray(xml3Items)) {
        xml3Items.forEach((item, idx) => {
            const rawTyleBh = item.TYLE_TT_BH !== undefined && item.TYLE_TT_BH !== null && String(item.TYLE_TT_BH).trim() !== ''
                ? Number(item.TYLE_TT_BH)
                : null;
            const rawTyleDv = item.TYLE_TT_DV !== undefined && item.TYLE_TT_DV !== null && String(item.TYLE_TT_DV).trim() !== ''
                ? Number(item.TYLE_TT_DV)
                : 100;

            // Bộ lọc loại trừ: Bỏ qua dòng tự túc (TYLE_TT_BH = 0) và dịch vụ có tỷ lệ riêng (TYLE_TT_DV < 100)
            if (rawTyleBh === null || isNaN(rawTyleBh) || rawTyleBh === 0) return;
            if (!isNaN(rawTyleDv) && rawTyleDv < 100) return;

            const ngayYl = String(item.NGAY_YL || '').trim();
            rawLines.push({
                xmlType: 'XML3',
                index: idx,
                code: String(item.MA_DICH_VU || item.MA_VAT_TU || '').trim(),
                name: String(item.TEN_DICH_VU || item.TEN_VAT_TU || '').trim(),
                ngayYl,
                ngayYlDate: ngayYl.substring(0, 8),
                actualRate: rawTyleBh,
                rawItem: item
            });
        });
    }

    // 2. Ràng buộc ngược trên XML1:
    // Nếu bệnh nhân thẻ mã 3 (95%) hoặc mã 4 (80%), mà XML2/XML3 có dòng tính TYLE_TT_BH = 100%,
    // nhưng trường NGAY_MIEN_CCT trên XML1 lại bỏ trống -> Báo lỗi thiếu NGAY_MIEN_CCT
    const hasReducedRateCard = cards.some(c => c.standardRate < 100);
    const hasAny100PercentLine = rawLines.some(l => l.actualRate === 100);

    if (hasReducedRateCard && hasAny100PercentLine && !ngayMienCct) {
        const reducedCards = cards.filter(c => c.standardRate < 100).map(c => `${c.cardCode} (${c.standardRate}%)`).join(', ');
        errors.push({
            type: 'MISSING_MIEN_CCT',
            xmlType: 'XML1',
            message: `Thiếu thông tin ngày miễn cùng chi trả (NGAY_MIEN_CCT) trên XML1: Bệnh nhân mang thẻ mức hưởng ${reducedCards} nhưng chi tiết XML2/XML3 kê khai mức 100%.`
        });
    }

    // 3. Đối chiếu chi tiết từng dòng:
    if (cards.length === 1) {
        // === TRƯỜNG HỢP 1 THẺ DUY NHẤT ===
        const card = cards[0];

        rawLines.forEach(line => {
            // Kiểm tra ngoài hạn thẻ (nếu thẻ có khai báo hạn)
            if (card.tu && card.den && line.ngayYlDate) {
                if (line.ngayYlDate < card.tu || line.ngayYlDate > card.den) {
                    errors.push({
                        type: 'OUT_OF_CARD_DATE',
                        xmlType: line.xmlType,
                        index: line.index,
                        field: 'TYLE_TT_BH',
                        code: line.code,
                        name: line.name,
                        ngayYl: line.ngayYl,
                        actualRate: line.actualRate,
                        cardCode: card.cardCode,
                        message: `Chỉ định ngoài hạn thẻ: [${line.xmlType}] ${line.code} (${line.name || 'Dịch vụ'}) ngày ${formatXmlDateTime(line.ngayYl)} ngoài hạn thẻ [${formatXmlDateTime(card.tu)} - ${formatXmlDateTime(card.den)}].`
                    });
                }
            }

            // Xác định tỷ lệ chuẩn cho dòng này
            let expectedRate = card.standardRate;
            let isMienCctEffective = false;

            if (ngayMienCct && line.ngayYl && isAfterOrEqualMienCct(line.ngayYl, ngayMienCct)) {
                expectedRate = 100;
                isMienCctEffective = true;
            }

            // So sánh thực tế với chuẩn
            if (line.actualRate !== expectedRate) {
                if (isMienCctEffective && line.actualRate < 100) {
                    errors.push({
                        type: 'NOT_UPGRADED_100',
                        xmlType: line.xmlType,
                        index: line.index,
                        field: 'TYLE_TT_BH',
                        code: line.code,
                        name: line.name,
                        ngayYl: line.ngayYl,
                        actualRate: line.actualRate,
                        expectedRate: 100,
                        cardCode: card.cardCode,
                        message: `Chưa nâng mức hưởng lên 100% cho [${line.xmlType}] ${line.code} (${line.name || 'Dịch vụ'}) ngày ${formatXmlDateTime(line.ngayYl)} (sau mốc miễn CCT ${formatXmlDateTime(ngayMienCct)}). Thực tế tính ${line.actualRate}%.`
                    });
                } else if (!isMienCctEffective && line.actualRate === 100 && card.standardRate < 100) {
                    errors.push({
                        type: 'EARLY_100',
                        xmlType: line.xmlType,
                        index: line.index,
                        field: 'TYLE_TT_BH',
                        code: line.code,
                        name: line.name,
                        ngayYl: line.ngayYl,
                        actualRate: line.actualRate,
                        expectedRate: card.standardRate,
                        cardCode: card.cardCode,
                        message: `Tính sớm 100% cho [${line.xmlType}] ${line.code} (${line.name || 'Dịch vụ'}) ngày ${formatXmlDateTime(line.ngayYl)} trước thời điểm miễn CCT (Mức chuẩn thẻ ${card.cardCode}: ${card.standardRate}%).`
                    });
                } else if (card.standardRate === 50 || String(summary?.MA_DOITUONG_KCB || '').trim() === '1.13') {
                    errors.push({
                        type: 'WRONG_DOITUONG_113_RATE',
                        xmlType: line.xmlType,
                        index: line.index,
                        field: 'TYLE_TT_BH',
                        code: line.code,
                        name: line.name,
                        ngayYl: line.ngayYl,
                        actualRate: line.actualRate,
                        expectedRate: 50,
                        cardCode: card.cardCode,
                        message: `Áp sai mức hưởng đối tượng 1.13: [${line.xmlType}] ${line.code} (${line.name || 'Dịch vụ'}) tính ${line.actualRate}% (sai quy định khi >= 80%), đối tượng 1.13 chỉ được thanh toán BHYT 50%.`
                    });
                } else {
                    errors.push({
                        type: 'WRONG_CARD_RATE',
                        xmlType: line.xmlType,
                        index: line.index,
                        field: 'TYLE_TT_BH',
                        code: line.code,
                        name: line.name,
                        ngayYl: line.ngayYl,
                        actualRate: line.actualRate,
                        expectedRate,
                        cardCode: card.cardCode,
                        message: `Áp sai mức hưởng thẻ: [${line.xmlType}] ${line.code} (${line.name || 'Dịch vụ'}) tính ${line.actualRate}%, mức chuẩn thẻ ${card.cardCode} là ${expectedRate}%.`
                    });
                }
            }
        });

        // Kiểm tra tính đồng nhất nếu không có miễn CCT
        if (!ngayMienCct && rawLines.length > 0) {
            const distinctRates = Array.from(new Set(rawLines.map(l => l.actualRate)));
            if (distinctRates.length > 1) {
                errors.push({
                    type: 'INCONSISTENT_CARD_RATE',
                    xmlType: 'XML1',
                    message: `Không đồng nhất tỷ lệ thanh toán: Hồ sơ 1 thẻ BHYT không có miễn CCT nhưng xuất hiện ${distinctRates.length} mức tỷ lệ (${distinctRates.join('%, ')}%).`
                });
            }
        }

    } else {
        // === TRƯỜNG HỢP TỪ 2 THẺ BHYT TRỞ LÊN ===
        // Tìm ngày gối thẻ chuyển giao (nếu có: GT_THE_DEN_1 === GT_THE_TU_2)
        const splitDateSet = new Set<string>();
        for (let i = 0; i < cards.length - 1; i++) {
            if (cards[i].den && cards[i + 1].tu && cards[i].den === cards[i + 1].tu) {
                splitDateSet.add(cards[i].den);
            }
        }

        // Nhóm các dòng theo ngày gối thẻ để kiểm tra tính duy nhất
        const linesOnSplitDate = new Map<string, AuditableLine[]>();

        rawLines.forEach(line => {
            const ngayYlDate = line.ngayYlDate;

            // Bước 1: Kiểm tra ngoài hạn thẻ của toàn bộ các thẻ
            const isInsideAnyCard = cards.some(c => {
                if (!c.tu || !c.den) return false;
                return c.tu <= ngayYlDate && ngayYlDate <= c.den;
            });

            if (ngayYlDate && !isInsideAnyCard && cards.every(c => Boolean(c.tu && c.den))) {
                const cardIntervals = cards.map(c => `[${formatXmlDateTime(c.tu)} - ${formatXmlDateTime(c.den)}]`).join('; ');
                errors.push({
                    type: 'OUT_OF_CARD_DATE',
                    xmlType: line.xmlType,
                    index: line.index,
                    field: 'TYLE_TT_BH',
                    code: line.code,
                    name: line.name,
                    ngayYl: line.ngayYl,
                    actualRate: line.actualRate,
                    message: `Chỉ định ngoài hạn thẻ: [${line.xmlType}] ${line.code} (${line.name || 'Dịch vụ'}) ngày ${formatXmlDateTime(line.ngayYl)} không nằm trong hạn sử dụng của bất kỳ thẻ BHYT nào (${cardIntervals}).`
                });
            }

            // Bước 3: Thu thập các dòng trong ngày gối thẻ
            if (ngayYlDate && splitDateSet.has(ngayYlDate)) {
                const list = linesOnSplitDate.get(ngayYlDate) || [];
                list.push(line);
                linesOnSplitDate.set(ngayYlDate, list);
            }

            // Bước 2: Kiểm tra tỷ lệ đối chiếu theo thẻ tương ứng
            // Tìm thẻ khớp với ngày chỉ định
            const matchingCard = cards.find(c => c.tu <= ngayYlDate && ngayYlDate <= c.den) || cards[0];

            let expectedRate = matchingCard.standardRate;
            let isMienCctEffective = false;

            if (ngayMienCct && line.ngayYl && isAfterOrEqualMienCct(line.ngayYl, ngayMienCct)) {
                expectedRate = 100;
                isMienCctEffective = true;
            }

            // Nếu không nằm trong ngày gối thẻ, kiểm tra sai lệch tỷ lệ so với thẻ tương ứng
            if (!splitDateSet.has(ngayYlDate)) {
                if (line.actualRate !== expectedRate) {
                    if (isMienCctEffective && line.actualRate < 100) {
                        errors.push({
                            type: 'NOT_UPGRADED_100',
                            xmlType: line.xmlType,
                            index: line.index,
                            field: 'TYLE_TT_BH',
                            code: line.code,
                            name: line.name,
                            ngayYl: line.ngayYl,
                            actualRate: line.actualRate,
                            expectedRate: 100,
                            cardCode: matchingCard.cardCode,
                            message: `Chưa nâng mức hưởng lên 100% cho [${line.xmlType}] ${line.code} (${line.name || 'Dịch vụ'}) ngày ${formatXmlDateTime(line.ngayYl)} (sau mốc miễn CCT ${formatXmlDateTime(ngayMienCct)}). Thực tế tính ${line.actualRate}%.`
                        });
                    } else if (!isMienCctEffective && line.actualRate === 100 && matchingCard.standardRate < 100) {
                        errors.push({
                            type: 'EARLY_100',
                            xmlType: line.xmlType,
                            index: line.index,
                            field: 'TYLE_TT_BH',
                            code: line.code,
                            name: line.name,
                            ngayYl: line.ngayYl,
                            actualRate: line.actualRate,
                            expectedRate: matchingCard.standardRate,
                            cardCode: matchingCard.cardCode,
                            message: `Tính sớm 100% cho [${line.xmlType}] ${line.code} (${line.name || 'Dịch vụ'}) ngày ${formatXmlDateTime(line.ngayYl)} trước thời điểm miễn CCT (Mức chuẩn thẻ ${matchingCard.cardCode}: ${matchingCard.standardRate}%).`
                        });
                    } else if (matchingCard.standardRate === 50 || String(summary?.MA_DOITUONG_KCB || '').trim() === '1.13') {
                        errors.push({
                            type: 'WRONG_DOITUONG_113_RATE',
                            xmlType: line.xmlType,
                            index: line.index,
                            field: 'TYLE_TT_BH',
                            code: line.code,
                            name: line.name,
                            ngayYl: line.ngayYl,
                            actualRate: line.actualRate,
                            expectedRate: 50,
                            cardCode: matchingCard.cardCode,
                            message: `Áp sai mức hưởng đối tượng 1.13: [${line.xmlType}] ${line.code} (${line.name || 'Dịch vụ'}) tính ${line.actualRate}% (sai quy định khi >= 80%), đối tượng 1.13 chỉ được thanh toán BHYT 50%.`
                        });
                    } else {
                        errors.push({
                            type: 'WRONG_CARD_RATE',
                            xmlType: line.xmlType,
                            index: line.index,
                            field: 'TYLE_TT_BH',
                            code: line.code,
                            name: line.name,
                            ngayYl: line.ngayYl,
                            actualRate: line.actualRate,
                            expectedRate,
                            cardCode: matchingCard.cardCode,
                            message: `Áp sai mức hưởng: [${line.xmlType}] ${line.code} (${line.name || 'Dịch vụ'}) tính ${line.actualRate}%, mức chuẩn thẻ ${matchingCard.cardCode} là ${expectedRate}%.`
                        });
                    }
                }
            }
        });

        // Bước 3: Kiểm tra ngày gối thẻ (chỉ được phép nhận 1 tỷ lệ duy nhất trong ngày trùng)
        linesOnSplitDate.forEach((splitLines, splitDate) => {
            const distinctRatesOnSplitDate = Array.from(new Set(splitLines.map(l => l.actualRate)));
            if (distinctRatesOnSplitDate.length > 1) {
                errors.push({
                    type: 'SPLIT_DATE_INCONSISTENT',
                    xmlType: 'XML1',
                    message: `Nhảy tỷ lệ trong ngày chuyển giao gối 2 thẻ BHYT (${formatXmlDateTime(splitDate)}): Xuất hiện cả ${distinctRatesOnSplitDate.map(r => r + '%').join(' và ')} trên cùng một ngày.`
                });
            }
        });
    }

    const isError = errors.length > 0;
    const linesError = errors.filter(e => e.xmlType === 'XML2' || e.xmlType === 'XML3').length;

    // Tạo câu tóm tắt lỗi
    let summaryMessage = 'Khớp chuẩn tỷ lệ thanh toán BHYT';
    let detailedReason = '';

    if (isError) {
        const errorTypes = Array.from(new Set(errors.map(e => e.type)));
        const typeLabels: Record<BhytRateErrorType, string> = {
            'OUT_OF_CARD_DATE': 'Ngoài hạn thẻ',
            'MISSING_MIEN_CCT': 'Thiếu NGAY_MIEN_CCT trên XML1',
            'NOT_UPGRADED_100': 'Chưa nâng lên 100% miễn CCT',
            'EARLY_100': 'Tính sớm 100% trước miễn CCT',
            'WRONG_CARD_RATE': 'Áp sai mức hưởng thẻ',
            'WRONG_DOITUONG_113_RATE': 'Áp sai mức hưởng ĐT 1.13 (≥ 80%)',
            'INCONSISTENT_CARD_RATE': 'Không đồng nhất tỷ lệ',
            'SPLIT_DATE_INCONSISTENT': 'Nhảy tỷ lệ ngày gối thẻ'
        };

        const errorLabelList = errorTypes.map(t => typeLabels[t] || t);
        summaryMessage = `Sai lệch tỷ lệ BHYT (${errorLabelList.join(', ')}) - ${errors.length} cảnh báo`;

        // Lấy tối đa 3 lỗi chi tiết tiêu biểu đưa vào detailedReason
        const sampleErrors = errors.slice(0, 3).map(e => e.message);
        detailedReason = sampleErrors.join(' | ') + (errors.length > 3 ? ` (+${errors.length - 3} dòng khác)` : '');
    }

    return {
        isError,
        errors,
        summaryMessage,
        detailedReason,
        cards,
        ngayMienCct,
        linesAudited: rawLines.length,
        linesError
    };
}

export interface NhanThuocTheoHenAuditResult {
    isError: boolean;
    summaryMessage: string;
    detailedReason: string;
    nonDrugCost: number;
    xml3Violations: Array<{
        index: number;
        code: string;
        name: string;
        maNhom: string;
        message: string;
    }>;
}

/**
 * Kiểm toán hồ sơ Nhận thuốc theo hẹn (MA_LOAI_KCB = 07)
 * Căn cứ: Phụ lục 01 QĐ 824/QĐ-BYT, QĐ 1804/QĐ-BYT (chỉ tiêu 7):
 * Loại hình KCB nhận thuốc theo hẹn "không thuộc trường hợp người bệnh đi khám bệnh, chữa bệnh",
 * nghiêm cấm phát sinh chi phí ngoài chi phí thuốc (tiền khám, xét nghiệm, CĐHA, PTTT, giường, v.v.).
 */
export function auditNhanThuocTheoHenForRecord(record: HosoRecord): NhanThuocTheoHenAuditResult {
    const summary = record.summary || {};
    const maLoaiKcb = String(summary.MA_LOAI_KCB || '').trim();
    if (maLoaiKcb !== '07' && maLoaiKcb !== '7') {
        return {
            isError: false,
            summaryMessage: '',
            detailedReason: '',
            nonDrugCost: 0,
            xml3Violations: []
        };
    }

    // 1. Quét XML3 (DVKT & Vật tư y tế)
    const xml3Group = record.groups?.find(g => g.type === 'XML3');
    const xml3Items = getXmlDataList(xml3Group);
    const xml3Violations: Array<{
        index: number;
        code: string;
        name: string;
        maNhom: string;
        message: string;
    }> = [];

    let totalXml3Cost = 0;
    if (Array.isArray(xml3Items)) {
        xml3Items.forEach((item, idx) => {
            const maDv = String(item.MA_DICH_VU || item.MA_VAT_TU || '').trim();
            const tenDv = String(item.TEN_DICH_VU || item.TEN_VAT_TU || 'Dịch vụ kỹ thuật').trim();
            const maNhom = String(item.MA_NHOM || '').trim();
            const thanhTien = Number(item.THANH_TIEN || item.T_TONGCHI || 0);
            totalXml3Cost += isNaN(thanhTien) ? 0 : thanhTien;

            xml3Violations.push({
                index: idx,
                code: maDv,
                name: tenDv,
                maNhom,
                message: `Loại KCB 07 (Nhận thuốc theo hẹn) không được chỉ định DVKT: [${maDv}] ${tenDv}${maNhom ? ` (Nhóm ${maNhom})` : ''} theo QĐ 824/QĐ-BYT.`
            });
        });
    }

    // 2. Quét các trường chi phí ngoài thuốc trên XML1
    const costFields: Array<{ field: string; label: string; value: number }> = [
        { field: 'T_KHAM', label: 'Tiền khám', value: Number(summary.T_KHAM || 0) },
        { field: 'T_XN', label: 'Tiền xét nghiệm', value: Number(summary.T_XN || 0) },
        { field: 'T_CDHA', label: 'Tiền CĐHA', value: Number(summary.T_CDHA || 0) },
        { field: 'T_PTTT', label: 'Tiền PTTT', value: Number(summary.T_PTTT || 0) },
        { field: 'T_GIUONG', label: 'Tiền giường', value: Number(summary.T_GIUONG || 0) },
        { field: 'T_VTYT', label: 'Tiền VTYT', value: Number(summary.T_VTYT || 0) },
        { field: 'T_DVKT_TYLE', label: 'Tiền DVKT tỷ lệ', value: Number(summary.T_DVKT_TYLE || 0) },
        { field: 'T_MAU', label: 'Tiền máu', value: Number(summary.T_MAU || 0) },
        { field: 'T_VANCHUYEN', label: 'Tiền vận chuyển', value: Number(summary.T_VANCHUYEN || 0) }
    ];

    const activeNonDrugCosts = costFields.filter(c => !isNaN(c.value) && c.value > 0);
    const nonDrugCostXml1 = activeNonDrugCosts.reduce((sum, c) => sum + c.value, 0);

    const isError = xml3Violations.length > 0 || nonDrugCostXml1 > 0;
    if (!isError) {
        return {
            isError: false,
            summaryMessage: '',
            detailedReason: '',
            nonDrugCost: 0,
            xml3Violations: []
        };
    }

    const reasonParts: string[] = [];
    if (xml3Violations.length > 0) {
        reasonParts.push(`phát sinh ${xml3Violations.length} dịch vụ trong XML3 (tổng ${totalXml3Cost.toLocaleString('vi-VN')} đ)`);
    }
    if (activeNonDrugCosts.length > 0) {
        const details = activeNonDrugCosts.map(c => `${c.label}: ${c.value.toLocaleString('vi-VN')} đ`).join(', ');
        reasonParts.push(`chi phí ngoài thuốc kê khai trên XML1: ${details}`);
    }

    const detailedReason = `Căn cứ Phụ lục 01 QĐ 824/QĐ-BYT & QĐ 1804/QĐ-BYT (chỉ tiêu 7): Loại hình KCB nhận thuốc theo hẹn không thuộc trường hợp đi KCB, không được phát sinh chi phí ngoài thuốc. Thực tế hồ sơ ${reasonParts.join('; ')}.`;
    const summaryMessage = `Hồ sơ có MA_LOAI_KCB = 07 (Nhận thuốc theo hẹn) nhưng phát sinh chi phí ngoài thuốc`;

    return {
        isError: true,
        summaryMessage,
        detailedReason,
        nonDrugCost: nonDrugCostXml1 + totalXml3Cost,
        xml3Violations
    };
}

export interface DoiTuong113AuditResult {
    isError: boolean;
    summaryMessage: string;
    detailedReason: string;
    violationCount: number;
    violations: Array<{
        xmlType: 'XML2' | 'XML3';
        index: number;
        code: string;
        name: string;
        actualRate: number;
        message: string;
    }>;
}

/**
 * Kiểm toán tỷ lệ thanh toán BHYT của đối tượng 1.13
 * Căn cứ: Quy định phân nhóm đối tượng KCB BHYT:
 * Đối tượng MA_DOITUONG_KCB = 1.13 chỉ được quỹ BHYT thanh toán 50% (TYLE_TT_BH = 50).
 * Bắt lỗi xuất toán khi có dòng kê khai TYLE_TT_BH >= 80% (hoặc khác 50%).
 */
export function auditDoiTuong113RateForRecord(record: HosoRecord): DoiTuong113AuditResult {
    const summary = record.summary || {};
    const maDoiTuongKcb = String(summary.MA_DOITUONG_KCB || summary.MA_DOITUONG || '').trim();
    const isRecordDoiTuong113 = maDoiTuongKcb === '1.13';

    const violations: Array<{
        xmlType: 'XML2' | 'XML3';
        index: number;
        code: string;
        name: string;
        actualRate: number;
        message: string;
    }> = [];

    // 1. Quét XML2 (Thuốc)
    const xml2Group = record.groups?.find(g => g.type === 'XML2');
    const xml2Items = getXmlDataList(xml2Group);
    if (Array.isArray(xml2Items)) {
        xml2Items.forEach((item, idx) => {
            const itemDoiTuong = String(item.MA_DOITUONG_KCB || item.MA_DOITUONG || '').trim();
            const applies = isRecordDoiTuong113 || itemDoiTuong === '1.13';
            if (!applies) return;

            const rawTyleBh = item.TYLE_TT_BH !== undefined && item.TYLE_TT_BH !== null && String(item.TYLE_TT_BH).trim() !== ''
                ? Number(item.TYLE_TT_BH)
                : null;
            const rawTyleDv = item.TYLE_TT_DV !== undefined && item.TYLE_TT_DV !== null && String(item.TYLE_TT_DV).trim() !== ''
                ? Number(item.TYLE_TT_DV)
                : 100;

            if (rawTyleBh === null || isNaN(rawTyleBh) || rawTyleBh === 0) return;
            if (!isNaN(rawTyleDv) && rawTyleDv < 100) return;

            if (rawTyleBh >= 80 || rawTyleBh > 50) {
                const code = String(item.MA_THUOC || '').trim();
                const name = String(item.TEN_THUOC || 'Thuốc').trim();
                violations.push({
                    xmlType: 'XML2',
                    index: idx,
                    code,
                    name,
                    actualRate: rawTyleBh,
                    message: `Đối tượng KCB 1.13 chỉ được thanh toán BHYT 50%: Thuốc [${code}] ${name} đang kê khai TYLE_TT_BH = ${rawTyleBh}% (sai quy định khi >= 80%).`
                });
            }
        });
    }

    // 2. Quét XML3 (DVKT & Vật tư)
    const xml3Group = record.groups?.find(g => g.type === 'XML3');
    const xml3Items = getXmlDataList(xml3Group);
    if (Array.isArray(xml3Items)) {
        xml3Items.forEach((item, idx) => {
            const itemDoiTuong = String(item.MA_DOITUONG_KCB || item.MA_DOITUONG || '').trim();
            const applies = isRecordDoiTuong113 || itemDoiTuong === '1.13';
            if (!applies) return;

            const rawTyleBh = item.TYLE_TT_BH !== undefined && item.TYLE_TT_BH !== null && String(item.TYLE_TT_BH).trim() !== ''
                ? Number(item.TYLE_TT_BH)
                : null;
            const rawTyleDv = item.TYLE_TT_DV !== undefined && item.TYLE_TT_DV !== null && String(item.TYLE_TT_DV).trim() !== ''
                ? Number(item.TYLE_TT_DV)
                : 100;

            if (rawTyleBh === null || isNaN(rawTyleBh) || rawTyleBh === 0) return;
            if (!isNaN(rawTyleDv) && rawTyleDv < 100) return;

            if (rawTyleBh >= 80 || rawTyleBh > 50) {
                const code = String(item.MA_DICH_VU || item.MA_VAT_TU || '').trim();
                const name = String(item.TEN_DICH_VU || item.TEN_VAT_TU || 'Dịch vụ').trim();
                violations.push({
                    xmlType: 'XML3',
                    index: idx,
                    code,
                    name,
                    actualRate: rawTyleBh,
                    message: `Đối tượng KCB 1.13 chỉ được thanh toán BHYT 50%: Dịch vụ [${code}] ${name} đang kê khai TYLE_TT_BH = ${rawTyleBh}% (sai quy định khi >= 80%).`
                });
            }
        });
    }

    if (violations.length === 0) {
        return {
            isError: false,
            summaryMessage: '',
            detailedReason: '',
            violationCount: 0,
            violations: []
        };
    }

    const rates = Array.from(new Set(violations.map(v => v.actualRate))).sort((a, b) => a - b);
    const rateStr = rates.map(r => `${r}%`).join(', ');
    const summaryMessage = `Đối tượng KCB 1.13 chỉ được thanh toán BHYT 50%, nhưng có ${violations.length} dòng kê khai tỷ lệ >= 80%`;
    const detailedReason = `Căn cứ quy định mức hưởng đối tượng KCB 1.13: Quỹ BHYT thanh toán tối đa 50%. Thực tế hồ sơ kê khai ${violations.length} dòng thuốc/DVKT với tỷ lệ ${rateStr} (≥ 80%) là sai mức hưởng.`;

    return {
        isError: true,
        summaryMessage,
        detailedReason,
        violationCount: violations.length,
        violations
    };
}


