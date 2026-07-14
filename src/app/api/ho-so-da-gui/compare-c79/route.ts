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

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const files = formData.getAll('file') as File[];
        
        const filterTrangThaiHS = formData.get('trangThaiHS') as string;
        const filterTrangThaiTT = formData.get('trangThaiTT') as string;
        const filterNgayRaTu = formData.get('ngayRaTu') as string;
        const filterNgayRaDen = formData.get('ngayRaDen') as string;

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
                const maThe = norm(row['MA_THE_BHYT'] || row['Mã thẻ BHYT'] || row['Mã thẻ'] || row['Mã Thẻ'] || row['MA_THE'] || '');
                if (!maThe) continue; // Skip empty rows
                totalRawRecords++;

                excelRecords.push({
                    stt: row['STT'],
                    hoTen: norm(row['HO_TEN'] || row['Họ tên']),
                    maThe: maThe,
                    ngaySinh: norm(row['NGAY_SINH'] || row['Ngày sinh'] || row['Năm sinh']),
                    gioiTinh: norm(row['GIOI_TINH'] || row['Giới tính']),
                    chanDoan: norm(row['MA_BENH'] || row['Mã bệnh'] || row['Chẩn đoán']),
                    ngayVao: norm(row['NGAY_VAO'] || row['Ngày vào']),
                    ngayRa: norm(row['NGAY_RA'] || row['Ngày ra']),
                    tongChi: parseFloat(row['T_TONGCHI_BV'] || row['Tổng chi']) || 0,
                    tongChiBH: parseFloat(row['T_TONGCHI_BH']) || parseFloat(row['Tổng chi BH']) || 0,
                    baoHiemTT: parseFloat(row['T_BHTT'] || row['Bảo hiểm TT']) || 0,
                    benhNhanCCT: parseFloat(row['T_BNCCT'] || row['Bệnh nhân CCT']) || 0,
                    benhNhanTT: parseFloat(row['T_BNTT'] || row['Bệnh nhân TT']) || 0,
                    nguonKhac: parseFloat(row['T_NGUONKHAC'] || row['Nguồn khác']) || 0,
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
                    extractDate(norm(db.ngayVao)) === extractDate(exRec.ngayVao) && 
                    extractDate(norm(db.ngayRa)) === extractDate(exRec.ngayRa)
                );

                // 2. Match exact ngayVao
                if (!bestMatch) {
                    bestMatch = dbList.find(db => extractDate(norm(db.ngayVao)) === extractDate(exRec.ngayVao));
                }
                
                // 3. Match exact ngayRa
                if (!bestMatch) {
                    bestMatch = dbList.find(db => extractDate(norm(db.ngayRa)) === extractDate(exRec.ngayRa));
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
                // Normalize "25/05/2026 08:00" to "202605250800"
                const normalizeTime = (dateStr: string) => {
                    const clean = norm(dateStr).replace(/[^\d]/g, '');
                    // Nếu đã là YYYYMMDD... thì giữ nguyên
                    if (clean.length >= 8 && clean.startsWith('20')) {
                        return clean.substring(0, 12); // Lấy tối đa 12 số (YYYYMMDDHHmm)
                    }
                    // Nếu là DDMMYYYY...
                    if (clean.length >= 8) {
                        const dd = clean.substring(0, 2);
                        const mm = clean.substring(2, 4);
                        const yyyy = clean.substring(4, 8);
                        const time = clean.substring(8, 12);
                        return `${yyyy}${mm}${dd}${time}`;
                    }
                    return clean;
                };

                const dbNgayVao = normalizeTime(matchedDbRec.ngayVao);
                const exNgayVao = normalizeTime(exRec.ngayVao);
                const dbNgayRa = normalizeTime(matchedDbRec.ngayRa);
                const exNgayRa = normalizeTime(exRec.ngayRa);

                const isDateDiff = (dbNgayVao !== exNgayVao) || (dbNgayRa !== exNgayRa);

                const isInfoDiff = 
                    norm(matchedDbRec.hoTen).toUpperCase() !== norm(exRec.hoTen).toUpperCase() ||
                    norm(matchedDbRec.ngaySinh) !== norm(exRec.ngaySinh) ||
                    norm(matchedDbRec.gioiTinh) !== norm(exRec.gioiTinh) ||
                    (norm(exRec.chanDoan) && norm(matchedDbRec.chanDoan) !== norm(exRec.chanDoan)); // Only compare chanDoan if Excel has it

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
