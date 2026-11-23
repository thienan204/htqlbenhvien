import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

function getExcelMap() {
    const filePath = path.join(process.cwd(), 'mau', 'DANH MỤC DVKT BẮT BUỘC CÓ MÃ MÁY_16_11_7_28_12.xlsx');
    if (!fs.existsSync(filePath)) {
        throw new Error(`File danh mục chuẩn không tồn tại trên máy chủ: ${filePath}`);
    }
    const buffer = fs.readFileSync(filePath);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet) as any[];

    const excelMap = new Map<string, { code: string; name: string }>();
    rows.forEach(r => {
        const code = String(r['Mã'] || r['MA_DICH_VU'] || r['Ma'] || '').trim();
        const name = String(r['Tên DVKT'] || r['TEN_DICH_VU'] || r['Ten DVKT'] || '').trim();
        if (code && !excelMap.has(code)) {
            excelMap.set(code, { code, name });
        }
    });
    return excelMap;
}

export async function GET() {
    try {
        const excelMap = getExcelMap();

        const records: any[] = await prisma.$queryRaw`
            SELECT id, "MA_DICH_VU", "TEN_DICH_VU", "DON_GIA", "bat_buoc_co_ma_may", "nguon_du_lieu", "isActive"
            FROM "Mau05Catalog"
            WHERE "isActive" = true
        `;

        const discrepantOffList: any[] = [];
        let matchedCount = 0;

        records.forEach(r => {
            const code = r.MA_DICH_VU ? String(r.MA_DICH_VU).trim() : '';
            if (code && excelMap.has(code)) {
                if (r.bat_buoc_co_ma_may === true) {
                    matchedCount++;
                } else {
                    discrepantOffList.push({
                        id: r.id,
                        MA_DICH_VU: code,
                        TEN_DICH_VU: r.TEN_DICH_VU,
                        DON_GIA: r.DON_GIA,
                        bat_buoc_co_ma_may: Boolean(r.bat_buoc_co_ma_may),
                        nguon_du_lieu: r.nguon_du_lieu,
                        excelName: excelMap.get(code)?.name
                    });
                }
            }
        });

        return NextResponse.json({
            success: true,
            source: 'SERVER',
            fileName: 'DANH MỤC DVKT BẮT BUỘC CÓ MÃ MÁY_16_11_7_28_12.xlsx (Máy chủ)',
            totalExcelCodes: excelMap.size,
            totalActive: records.length,
            matchedCount,
            discrepantOffCount: discrepantOffList.length,
            discrepantList: discrepantOffList
        });
    } catch (error: any) {
        console.error('Error in audit-bhyt GET:', error);
        return NextResponse.json({ success: false, error: error.message || 'Lỗi hệ thống' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, ids, items, rows, codes, fileName } = body;

        // 1. Đối soát dữ liệu do người dùng upload trực tiếp từ trình duyệt
        if (action === 'AUDIT_UPLOAD') {
            const rawItems = Array.isArray(items) ? items : (Array.isArray(rows) ? rows : []);
            const uploadMap = new Map<string, { code: string; name: string }>();

            rawItems.forEach((r: any) => {
                const code = String(r['Mã'] || r['MA_DICH_VU'] || r['Ma'] || r['code'] || '').trim();
                const name = String(r['Tên DVKT'] || r['TEN_DICH_VU'] || r['Ten DVKT'] || r['name'] || '').trim();
                if (code && !uploadMap.has(code)) {
                    uploadMap.set(code, { code, name });
                }
            });

            if (uploadMap.size === 0) {
                return NextResponse.json({ 
                    success: false, 
                    error: 'Không tìm thấy cột Mã dịch vụ trong file Excel. Vui lòng đảm bảo file có cột "Mã" hoặc "MA_DICH_VU".' 
                }, { status: 400 });
            }

            const records: any[] = await prisma.$queryRaw`
                SELECT id, "MA_DICH_VU", "TEN_DICH_VU", "DON_GIA", "bat_buoc_co_ma_may", "nguon_du_lieu", "isActive"
                FROM "Mau05Catalog"
                WHERE "isActive" = true
            `;

            const discrepantOffList: any[] = [];
            let matchedCount = 0;
            const hospitalCodeSet = new Set<string>();

            records.forEach(r => {
                const code = r.MA_DICH_VU ? String(r.MA_DICH_VU).trim() : '';
                if (code) hospitalCodeSet.add(code);
                if (code && uploadMap.has(code)) {
                    if (r.bat_buoc_co_ma_may === true) {
                        matchedCount++;
                    } else {
                        discrepantOffList.push({
                            id: r.id,
                            MA_DICH_VU: code,
                            TEN_DICH_VU: r.TEN_DICH_VU,
                            DON_GIA: r.DON_GIA,
                            bat_buoc_co_ma_may: Boolean(r.bat_buoc_co_ma_may),
                            nguon_du_lieu: r.nguon_du_lieu,
                            excelName: uploadMap.get(code)?.name
                        });
                    }
                }
            });

            let newInExcelCount = 0;
            uploadMap.forEach((_, code) => {
                if (!hospitalCodeSet.has(code)) {
                    newInExcelCount++;
                }
            });

            return NextResponse.json({
                success: true,
                source: 'UPLOAD',
                fileName: fileName || 'File Excel tải lên',
                totalExcelCodes: uploadMap.size,
                totalActive: records.length,
                matchedCount,
                discrepantOffCount: discrepantOffList.length,
                newInExcelCount,
                discrepantList: discrepantOffList
            });
        }

        // 2. Khôi phục theo file upload
        if (action === 'RESTORE_FROM_UPLOAD') {
            let idsToUpdate: string[] = Array.isArray(ids) ? [...ids] : [];

            if (Array.isArray(codes) && codes.length > 0) {
                const records: any[] = await prisma.$queryRaw`
                    SELECT id, "MA_DICH_VU", "bat_buoc_co_ma_may"
                    FROM "Mau05Catalog"
                    WHERE "isActive" = true
                `;
                const codeSet = new Set(codes.map(c => String(c).trim()));
                records.forEach(r => {
                    const c = r.MA_DICH_VU ? String(r.MA_DICH_VU).trim() : '';
                    if (c && codeSet.has(c) && r.bat_buoc_co_ma_may !== true) {
                        if (!idsToUpdate.includes(r.id)) {
                            idsToUpdate.push(r.id);
                        }
                    }
                });
            }

            if (idsToUpdate.length > 0) {
                for (let i = 0; i < idsToUpdate.length; i += 100) {
                    const chunk = idsToUpdate.slice(i, i + 100);
                    await prisma.mau05Catalog.updateMany({
                        where: { id: { in: chunk } },
                        data: { bat_buoc_co_ma_may: true }
                    });
                }
            }

            return NextResponse.json({
                success: true,
                updatedCount: idsToUpdate.length,
                message: `Đã bật lại yêu cầu mã máy cho ${idsToUpdate.length} dịch vụ theo file Excel tải lên.`
            });
        }

        // 3. Khôi phục theo ID được chọn hoặc toàn bộ file máy chủ
        let idsToUpdate: string[] = [];

        if (action === 'RESTORE_SELECTED' && Array.isArray(ids) && ids.length > 0) {
            idsToUpdate = ids;
        } else {
            // RESTORE_ALL: tìm tất cả các ID active đang bị tắt mã máy nhưng thuộc file BHYT máy chủ
            const excelMap = getExcelMap();
            const records: any[] = await prisma.$queryRaw`
                SELECT id, "MA_DICH_VU", "bat_buoc_co_ma_may"
                FROM "Mau05Catalog"
                WHERE "isActive" = true
            `;

            records.forEach(r => {
                const code = r.MA_DICH_VU ? String(r.MA_DICH_VU).trim() : '';
                if (code && excelMap.has(code) && r.bat_buoc_co_ma_may !== true) {
                    idsToUpdate.push(r.id);
                }
            });
        }

        if (idsToUpdate.length > 0) {
            // Update in chunks
            for (let i = 0; i < idsToUpdate.length; i += 100) {
                const chunk = idsToUpdate.slice(i, i + 100);
                await prisma.mau05Catalog.updateMany({
                    where: { id: { in: chunk } },
                    data: { bat_buoc_co_ma_may: true }
                });
            }
        }

        return NextResponse.json({
            success: true,
            updatedCount: idsToUpdate.length,
            message: `Đã bật lại yêu cầu mã máy cho ${idsToUpdate.length} dịch vụ theo chuẩn Cổng BHYT.`
        });
    } catch (error: any) {
        console.error('Error in audit-bhyt POST:', error);
        return NextResponse.json({ success: false, error: error.message || 'Lỗi hệ thống' }, { status: 500 });
    }
}
