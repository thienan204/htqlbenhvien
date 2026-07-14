import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';

const prisma = new PrismaClient();

const norm = (val: any) => {
    if (val === null || val === undefined) return '';
    return String(val).trim();
};

const extractDate = (dateStr: string) => {
    if (!dateStr) return '';
    // usually YYYYMMDDHHmm, extract YYYYMMDD
    if (dateStr.length >= 8) {
        return dateStr.substring(0, 8);
    }
    return dateStr;
};

// Normalize date strings into YYYYMMDDHHmm format
const normalizeTime = (dateStr: string) => {
    let clean = norm(dateStr);
    if (!clean) return '';
    
    // Nếu có dạng DD/MM/YYYY hoặc DD-MM-YYYY (VD: 18/08/1964)
    if (clean.includes('/') || clean.includes('-')) {
        const parts = clean.split(/[^\d]/); // split by non-digits
        // parts[0] is DD, parts[1] is MM, parts[2] is YYYY
        if (parts.length >= 3 && parts[2].length === 4) {
            const dd = parts[0].padStart(2, '0');
            const mm = parts[1].padStart(2, '0');
            const yyyy = parts[2];
            let time = '0000';
            if (parts.length >= 5) {
                time = parts[3].padStart(2, '0') + parts[4].padStart(2, '0');
            }
            return `${yyyy}${mm}${dd}${time.substring(0, 4)}`;
        }
    }

    // Nếu là chuỗi số liền nhau (VD: 196408180000 hoặc 18081964)
    clean = clean.replace(/[^\d]/g, '');
    if (clean.length >= 8) {
        // Kiểm tra xem năm nằm ở đầu hay cuối
        // Nếu 4 số đầu là 19xx hoặc 20xx -> YYYYMMDD
        const first4 = parseInt(clean.substring(0, 4));
        const last4 = parseInt(clean.substring(clean.length >= 12 ? 4 : 4, 8)); // Wait, if 18081964 -> 1964 is at 4..8
        
        // Nếu 4 số cuối (của đoạn 8 ký tự đầu) là năm hợp lý (vd 1964) -> DDMMYYYY
        const yearAtEnd = parseInt(clean.substring(4, 8));
        if (yearAtEnd >= 1900 && yearAtEnd <= 2100 && (first4 > 31 || first4 < 1900)) {
             // It's DDMMYYYY
             const dd = clean.substring(0, 2);
             const mm = clean.substring(2, 4);
             const yyyy = clean.substring(4, 8);
             const time = clean.length >= 12 ? clean.substring(8, 12) : '0000';
             return `${yyyy}${mm}${dd}${time}`;
        }
        
        // Mặc định xem như YYYYMMDD
        return clean.substring(0, 12).padEnd(12, '0');
    }
    return clean;
};

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const files = formData.getAll('file') as File[];
        
        const filterTrangThaiHS = formData.get('trangThaiHS') as string;
        const filterTrangThaiTT = formData.get('trangThaiTT') as string;
        const filterNgayRaTu = formData.get('ngayRaTu') as string;
        const filterNgayRaDen = formData.get('ngayRaDen') as string;

        const columnMappingStr = formData.get('columnMapping') as string;
        let mapping: Record<string, string> = {};
        if (columnMappingStr) {
            try {
                mapping = JSON.parse(columnMappingStr);
            } catch (e) {
                console.error("Lỗi parse columnMapping", e);
            }
        }

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 400 });
        }

        const excelRecords = [];

        for (const file of files) {
            const buffer = await file.arrayBuffer();
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            const rawData: any[] = xlsx.utils.sheet_to_json(sheet, { defval: '' });

            if (!rawData || rawData.length === 0) {
                continue;
            }

            let totalRawRecords = 0;
            for (let i = 0; i < rawData.length; i++) {
                const row = rawData[i];
                
                // Helper to get value from mapped column or fallback to default heuristic
                const getValue = (key: string, fallbacks: string[]) => {
                    if (mapping[key] && row[mapping[key]] !== undefined) {
                        return row[mapping[key]];
                    }
                    for (const fb of fallbacks) {
                        if (row[fb] !== undefined) return row[fb];
                    }
                    return '';
                };

                const maThe = norm(getValue('maThe', ['MA_THE_BHYT', 'Mã thẻ BHYT', 'Mã thẻ', 'Mã Thẻ', 'MA_THE']));
                if (!maThe) continue; // Skip empty rows
                totalRawRecords++;

                excelRecords.push({
                    stt: row['STT'] || getValue('stt', ['STT']),
                    hoTen: norm(getValue('hoTen', ['HO_TEN', 'Họ tên'])),
                    maThe: maThe,
                    ngaySinh: norm(getValue('ngaySinh', ['NGAY_SINH', 'Ngày sinh', 'Năm sinh'])),
                    gioiTinh: norm(getValue('gioiTinh', ['GIOI_TINH', 'Giới tính'])),
                    chanDoan: norm(getValue('chanDoan', ['MA_BENH', 'Mã bệnh', 'Chẩn đoán'])),
                    ngayVao: norm(getValue('ngayVao', ['NGAY_VAO', 'Ngày vào'])),
                    ngayRa: norm(getValue('ngayRa', ['NGAY_RA', 'Ngày ra'])),
                    tongChi: parseFloat(getValue('tongChi', ['T_TONGCHI_BV', 'Tổng chi'])) || 0,
                    tongChiBH: parseFloat(getValue('tongChiBH', ['T_TONGCHI_BH', 'Tổng chi BH'])) || 0,
                    baoHiemTT: parseFloat(getValue('baoHiemTT', ['T_BHTT', 'Bảo hiểm TT'])) || 0,
                    benhNhanCCT: parseFloat(getValue('benhNhanCCT', ['T_BNCCT', 'Bệnh nhân CCT'])) || 0,
                    benhNhanTT: parseFloat(getValue('benhNhanTT', ['T_BNTT', 'Bệnh nhân TT'])) || 0,
                    nguonKhac: parseFloat(getValue('nguonKhac', ['T_NGUONKHAC', 'Nguồn khác'])) || 0,
                });
            }
        }

        if (excelRecords.length === 0) {
            // Kiểm tra xem có phải do bộ lọc loại bỏ hết dữ liệu không, thay vì lỗi file không có cột mã thẻ
            let totalFound = 0;
            for (const file of files) {
                const buffer = await file.arrayBuffer();
                const workbook = xlsx.read(buffer, { type: 'buffer' });
                const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
                for (let i = 0; i < rawData.length; i++) {
                    const row: any = rawData[i];
                    if (norm(row['MA_THE_BHYT'] || row['Mã thẻ BHYT'] || row['Mã thẻ'] || row['Mã Thẻ'] || row['MA_THE'] || '')) {
                        totalFound++;
                    }
                }
            }
            
            if (totalFound > 0) {
                return NextResponse.json({ error: 'Không có hồ sơ nào trong file thỏa mãn các điều kiện lọc bạn đã chọn (Trạng thái HS / Ngày ra viện / Trạng thái TT).' }, { status: 400 });
            }
            return NextResponse.json({ error: 'Không tìm thấy dữ liệu hoặc cột Mã thẻ (MA_THE_BHYT, Mã thẻ BHYT...) hợp lệ trong các file' }, { status: 400 });
        }

        const dbWhere: any = {};

        if (filterTrangThaiTT) {
            dbWhere.trangThaiTT = { in: filterTrangThaiTT.split(',') };
        } else {
            dbWhere.trangThaiTT = { contains: 'Đã đề nghị thanh toán' };
        }

        if (filterTrangThaiHS) {
            dbWhere.trangThaiHS = { in: filterTrangThaiHS.split(',') };
        }

        if (filterNgayRaTu || filterNgayRaDen) {
            dbWhere.ngayRa = {};
            if (filterNgayRaTu) dbWhere.ngayRa.gte = filterNgayRaTu;
            if (filterNgayRaDen) dbWhere.ngayRa.lte = filterNgayRaDen + '235959';
        }

        // Fetch DB records
        // Get the latest version of each maLienKet that has trangThaiTT 'Đã đề nghị thanh toán'
        const existingRecords = await prisma.hoSoDaGui.findMany({
            where: dbWhere,
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Group DB records by maThe
        const dbMap = new Map<string, any[]>();
        // First, get unique by maLienKet
        const uniqueByMaLienKet = new Map<string, any>();
        for (const record of existingRecords) {
            if (!uniqueByMaLienKet.has(record.maLienKet)) {
                uniqueByMaLienKet.set(record.maLienKet, record);
            }
        }
        
        for (const record of uniqueByMaLienKet.values()) {
            if (record.maThe) {
                const the = norm(record.maThe);
                if (!dbMap.has(the)) {
                    dbMap.set(the, []);
                }
                dbMap.get(the)!.push(record);
            }
        }

        const exactMatches = [];
        const diffMatches = [];
        const notInDb = [];
        
        // Track which DB records are matched
        const matchedDbIds = new Set<string>();

        // Compare Excel to DB
        for (const exRec of excelRecords) {
            let matchedDbRec = null;

            // Xử lý trường hợp file Excel có chứa nhiều mã thẻ cách nhau bằng dấu ; hoặc ,
            const excelCards = exRec.maThe.split(/[,;]/).map((c: string) => c.trim()).filter(Boolean);
            
            let potentialDbRecords: any[] = [];
            for (const card of excelCards) {
                if (dbMap.has(card)) {
                    potentialDbRecords = potentialDbRecords.concat(dbMap.get(card)!);
                }
            }

            // Lọc bỏ những hồ sơ trong DB đã được ghép nối trước đó (đảm bảo 1-1)
            potentialDbRecords = potentialDbRecords.filter(db => !matchedDbIds.has(db.id));

            if (potentialDbRecords.length > 0) {
                const dbList = potentialDbRecords;
                // Try to find the best match: by ngayVao + ngayRa, or just ngayVao, or closest money
                
                // 1. Match exact ngayVao & ngayRa
                let bestMatch = dbList.find(db => 
                    normalizeTime(db.ngayVao) === normalizeTime(exRec.ngayVao) && 
                    normalizeTime(db.ngayRa) === normalizeTime(exRec.ngayRa)
                );

                // 2. Match exact ngayVao
                if (!bestMatch) {
                    bestMatch = dbList.find(db => normalizeTime(db.ngayVao) === normalizeTime(exRec.ngayVao));
                }
                
                // 3. Match exact ngayRa
                if (!bestMatch) {
                    bestMatch = dbList.find(db => normalizeTime(db.ngayRa) === normalizeTime(exRec.ngayRa));
                }

                // 4. Just take the first one if only one exists and money matches
                if (!bestMatch && dbList.length === 1) {
                    bestMatch = dbList[0];
                }

                // 5. Fallback: find closest money
                if (!bestMatch && dbList.length > 0) {
                    // Ưu tiên tìm chi phí khớp chính xác trước
                    bestMatch = dbList.find(db => Math.abs((db.tongChi || 0) - exRec.tongChi) <= 2);
                    
                    if (!bestMatch) {
                        bestMatch = dbList.reduce((prev, curr) => {
                            const prevDiff = Math.abs((prev.tongChi || 0) - exRec.tongChi);
                            const currDiff = Math.abs((curr.tongChi || 0) - exRec.tongChi);
                            return (currDiff < prevDiff) ? curr : prev;
                        });
                    }
                }

                if (bestMatch) {
                    matchedDbRec = bestMatch;
                    matchedDbIds.add(bestMatch.id);
                }
            }

            if (matchedDbRec) {
                // Prepare dates for comparison
                const dbNgayVao = normalizeTime(matchedDbRec.ngayVao);
                const exNgayVao = normalizeTime(exRec.ngayVao);
                const dbNgayRa = normalizeTime(matchedDbRec.ngayRa);
                const exNgayRa = normalizeTime(exRec.ngayRa);

                const isDateDiff = (dbNgayVao !== exNgayVao) || (dbNgayRa !== exNgayRa);

                // Helper cho giới tính
                const normalizeGioiTinh = (gt: string) => {
                    const clean = norm(gt).toUpperCase();
                    if (clean === '1' || clean === '01' || clean === 'NAM') return 'NAM';
                    if (clean === '2' || clean === '02' || clean === 'NỮ' || clean === 'NU') return 'NỮ';
                    return clean;
                };

                const dbNgaySinh = normalizeTime(matchedDbRec.ngaySinh).substring(0, 8);
                const exNgaySinh = normalizeTime(exRec.ngaySinh).substring(0, 8);
                const dbGioiTinh = normalizeGioiTinh(matchedDbRec.gioiTinh);
                const exGioiTinh = normalizeGioiTinh(exRec.gioiTinh);

                const hoTenDiff = norm(matchedDbRec.hoTen).toUpperCase() !== norm(exRec.hoTen).toUpperCase();
                const ngaySinhDiff = dbNgaySinh !== exNgaySinh;
                const gioiTinhDiff = dbGioiTinh !== exGioiTinh;
                const chanDoanDiff = !!(norm(exRec.chanDoan) && norm(matchedDbRec.chanDoan) !== norm(exRec.chanDoan));

                const isInfoDiff = hoTenDiff || ngaySinhDiff || gioiTinhDiff || chanDoanDiff;

                const isCostDiff = 
                    Math.abs((matchedDbRec.tongChi || 0) - exRec.tongChi) > 5 ||
                    Math.abs((matchedDbRec.tongChiBH || 0) - exRec.tongChiBH) > 5 ||
                    Math.abs((matchedDbRec.baoHiemTT || 0) - exRec.baoHiemTT) > 5 ||
                    Math.abs((matchedDbRec.benhNhanCCT || 0) - exRec.benhNhanCCT) > 5 ||
                    Math.abs((matchedDbRec.benhNhanTT || 0) - exRec.benhNhanTT) > 5 ||
                    Math.abs((matchedDbRec.nguonKhac || 0) - exRec.nguonKhac) > 5;
                
                if (isCostDiff || isDateDiff || isInfoDiff) {
                    diffMatches.push({
                        excel: exRec,
                        db: matchedDbRec,
                        diff: {
                            isDateDiff,
                            isCostDiff,
                            isInfoDiff,
                            ngayVaoDiff: dbNgayVao !== exNgayVao,
                            ngayRaDiff: dbNgayRa !== exNgayRa,
                            hoTenDiff,
                            ngaySinhDiff,
                            gioiTinhDiff,
                            chanDoanDiff,
                            tongChi: (matchedDbRec.tongChi || 0) - exRec.tongChi,
                            tongChiBH: (matchedDbRec.tongChiBH || 0) - exRec.tongChiBH,
                            baoHiemTT: (matchedDbRec.baoHiemTT || 0) - exRec.baoHiemTT,
                            benhNhanCCT: (matchedDbRec.benhNhanCCT || 0) - exRec.benhNhanCCT,
                            benhNhanTT: (matchedDbRec.benhNhanTT || 0) - exRec.benhNhanTT,
                            nguonKhac: (matchedDbRec.nguonKhac || 0) - exRec.nguonKhac,
                        }
                    });
                } else {
                    exactMatches.push({
                        excel: exRec,
                        db: matchedDbRec
                    });
                }
            } else {
                notInDb.push(exRec);
            }
        }

        // Find records in DB but not in Excel
        const notInExcel = [];
        for (const record of uniqueByMaLienKet.values()) {
            if (!matchedDbIds.has(record.id)) {
                notInExcel.push(record);
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    totalExcel: excelRecords.length,
                    totalDb: uniqueByMaLienKet.size,
                    exactMatches: exactMatches.length,
                    diffMatches: diffMatches.length,
                    notInDb: notInDb.length,
                    notInExcel: notInExcel.length,
                },
                details: {
                    diffMatches,
                    notInDb,
                    notInExcel
                }
            }
        });

    } catch (error: any) {
        console.error('Compare error:', error);
        return NextResponse.json({ error: 'Có lỗi xảy ra: ' + error.message }, { status: 500 });
    }
}
