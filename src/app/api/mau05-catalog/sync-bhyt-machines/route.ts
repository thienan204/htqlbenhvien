import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

export async function POST() {
    try {
        const filePath = path.join(process.cwd(), 'mau', 'DANH MỤC DVKT BẮT BUỘC CÓ MÃ MÁY_16_11_7_28_12.xlsx');

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({
                success: false,
                error: 'Không tìm thấy file danh mục trên máy chủ. Bạn vui lòng sử dụng nút "Import Excel" để tải file danh mục từ máy tính lên hệ thống.'
            }, { status: 404 });
        }

        const wb = XLSX.readFile(filePath);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        if (!rows || rows.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'File danh mục không có dữ liệu'
            }, { status: 400 });
        }

        // 1. Chuẩn hóa & gom nhóm mã duy nhất
        const uniqueMap = new Map<string, {
            MA_DICH_VU: string;
            TEN_DICH_VU: string;
            ngay_hieu_luc_bhyt: string;
            GHI_CHU: string;
            variants: string[];
        }>();

        rows.forEach((r) => {
            const code = String(r['Mã'] || r['MA_DICH_VU'] || r['Ma'] || '').trim();
            const name = String(r['Tên DVKT'] || r['TEN_DICH_VU'] || r['Ten DVKT'] || '').trim();
            const effectDate = r['Ngày hiệu lực'] ? String(r['Ngày hiệu lực']).trim() : '10/02/2026';
            const note = r['Trả kết quả sau'] ? `Trả kết quả sau: ${r['Trả kết quả sau']}` : '';

            if (!code) return;

            if (!uniqueMap.has(code)) {
                uniqueMap.set(code, {
                    MA_DICH_VU: code,
                    TEN_DICH_VU: name,
                    ngay_hieu_luc_bhyt: effectDate,
                    GHI_CHU: note,
                    variants: name ? [name] : []
                });
            } else {
                const existing = uniqueMap.get(code)!;
                if (name && !existing.variants.includes(name)) {
                    existing.variants.push(name);
                }
            }
        });

        // 2. Lấy dữ liệu hiện có trong Database
        const existingRecords = await prisma.mau05Catalog.findMany({
            orderBy: { createdAt: 'desc' }
        });

        const activeDbMap = new Map<string, any>();
        existingRecords.forEach(r => {
            if (r.MA_DICH_VU) {
                const c = r.MA_DICH_VU.trim();
                if (!activeDbMap.has(c) || (r.isActive && !activeDbMap.get(c).isActive)) {
                    activeDbMap.set(c, r);
                }
            }
        });

        let countSkip = 0;
        let countDisableOldAndAddNew = 0;
        let countInsertBrandNew = 0;

        const toDisableIds: string[] = [];
        const toInsertNew: any[] = [];

        for (const [code, item] of uniqueMap.entries()) {
            const existing = activeDbMap.get(code);

            if (existing) {
                if (existing.isActive && existing.bat_buoc_co_ma_may === true) {
                    countSkip++;
                } else {
                    if (existing.isActive) {
                        toDisableIds.push(existing.id);
                    }
                    toInsertNew.push({
                        STT: existing.STT,
                        MA_DICH_VU: existing.MA_DICH_VU,
                        TEN_DICH_VU: existing.TEN_DICH_VU || item.TEN_DICH_VU,
                        TEN_DVKT_GIA: existing.TEN_DVKT_GIA || item.TEN_DICH_VU,
                        DON_GIA: existing.DON_GIA,
                        QUY_TRINH: existing.QUY_TRINH,
                        SO_LUONG_CGKT: existing.SO_LUONG_CGKT,
                        CSKCB_CGKT: existing.CSKCB_CGKT,
                        CSKCB_CLS: existing.CSKCB_CLS,
                        QD_DVKT: existing.QD_DVKT,
                        QD_PD_GIA: existing.QD_PD_GIA,
                        GHI_CHU: existing.GHI_CHU || (item.variants.length > 1 ? `Biến thể BHYT: ${item.variants.join('; ')}` : null),
                        MA_THUOC: existing.MA_THUOC,
                        TEN_THUOC: existing.TEN_THUOC,
                        SO_DANG_KY: existing.SO_DANG_KY,
                        DON_VI_TINH: existing.DON_VI_TINH,
                        TT_THAU: existing.TT_THAU,
                        DON_GIA_THUOC: existing.DON_GIA_THUOC,
                        DM_NSX_CDD: existing.DM_NSX_CDD,
                        DM_THUCTE_CDD: existing.DM_THUCTE_CDD,
                        LIEU_BQ_PX: existing.LIEU_BQ_PX,
                        TL_THUCTE_BQ_PX: existing.TL_THUCTE_BQ_PX,
                        THANH_TIEN_THUOC: existing.THANH_TIEN_THUOC,
                        GIA_THANH_TOAN: existing.GIA_THANH_TOAN,
                        TU_NGAY: existing.TU_NGAY,
                        DEN_NGAY: existing.DEN_NGAY,
                        MA_CSKCB: existing.MA_CSKCB,
                        isActive: true,
                        bat_buoc_co_ma_may: true,
                        nguon_du_lieu: existing.nguon_du_lieu || 'BENH_VIEN',
                        ngay_hieu_luc_bhyt: item.ngay_hieu_luc_bhyt
                    });
                    countDisableOldAndAddNew++;
                }
            } else {
                toInsertNew.push({
                    MA_DICH_VU: item.MA_DICH_VU,
                    TEN_DICH_VU: item.TEN_DICH_VU,
                    TEN_DVKT_GIA: item.TEN_DICH_VU,
                    GHI_CHU: item.variants.length > 1 ? `Biến thể BHYT: ${item.variants.join('; ')}` : null,
                    isActive: true,
                    bat_buoc_co_ma_may: true,
                    nguon_du_lieu: 'BHYT_PORTAL',
                    ngay_hieu_luc_bhyt: item.ngay_hieu_luc_bhyt
                });
                countInsertBrandNew++;
            }
        }

        if (toDisableIds.length > 0) {
            for (let i = 0; i < toDisableIds.length; i += 100) {
                const chunk = toDisableIds.slice(i, i + 100);
                await prisma.mau05Catalog.updateMany({
                    where: { id: { in: chunk } },
                    data: { isActive: false }
                });
            }
        }

        if (toInsertNew.length > 0) {
            for (let i = 0; i < toInsertNew.length; i += 500) {
                const chunk = toInsertNew.slice(i, i + 500);
                await prisma.mau05Catalog.createMany({
                    data: chunk,
                    skipDuplicates: true
                });
            }
        }

        const finalActive = await prisma.mau05Catalog.count({ where: { isActive: true } });
        const finalBatBuoc = await prisma.mau05Catalog.count({ where: { isActive: true, bat_buoc_co_ma_may: true } });

        const result = {
            totalFileRows: rows.length,
            uniqueCodes: uniqueMap.size,
            skipped: countSkip,
            updatedOldDisabled: countDisableOldAndAddNew,
            insertedNew: countInsertBrandNew,
            totalActive: finalActive,
            totalBatBuocMaMay: finalBatBuoc
        };

        return NextResponse.json({
            success: true,
            message: 'Đồng bộ danh mục DVKT bắt buộc có mã máy thành công',
            data: result
        });
    } catch (error: any) {
        console.error('Lỗi khi đồng bộ danh mục DVKT bắt buộc có mã máy:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Lỗi hệ thống'
        }, { status: 500 });
    }
}
