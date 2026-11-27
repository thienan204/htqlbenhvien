import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { decryptField } from '@/lib/staffCrypto';
import {
    authorizeApiRequest,
    createDeleteSnapshot,
    SnapshotLimitError,
} from '@/lib/deleteProtection';

export const dynamic = 'force-dynamic';

function formatDate(date: Date | null | undefined): string | null {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function mapToBhytCode(codeStr: string | null | undefined): string {
    if (!codeStr) return '';
    const c = codeStr.toUpperCase();
    if (c.includes('BAC_SI') || c.includes('BAC_SY')) return '1';
    if (c.includes('Y_SI') || c.includes('Y_SY')) return '2';
    if (c.includes('DIEU_DUONG')) return '3';
    if (c.includes('HO_SINH')) return '4';
    if (c.includes('KY_THUAT') || c.includes('KTY') || c.includes('KTV')) return '5';
    if (c.includes('DUOC_SI') || c.includes('DUOC_SY')) return '6';
    if (c.includes('LUONG_Y')) return '8';
    return codeStr; // Return original if unknown
}

export async function POST(request: Request) {
    try {
        const auth = await authorizeApiRequest(request, {
            allowedRoles: ['ADMIN', 'PTCCB', 'TCCB', 'CNTT'],
            menuKeys: ['MENU_STAFF', 'MENU_CATALOG_02'],
            action: 'EDIT',
        });
        if (auth.errorResponse) return auth.errorResponse;

        const body = await request.json().catch(() => ({}));
        const staffIds: string[] = body.staffIds || [];

        // 1. Fetch Staff with their active CCHNs and related refs FIRST (before touching Mau02Catalog)
        const whereClause = staffIds.length > 0 ? { id: { in: staffIds } } : {};

        const staffList = await prisma.staff.findMany({
            where: whereClause,
            include: {
                department: true,
                gioi_tinh_ref: true,
                chuc_danh_ref: true,
                vi_tri_ref: true,
                chuc_vu_ref: true,
                vi_tri_bhyt_ref: true,
                certificates: {
                    where: { isActive: true },
                    include: {
                        noi_cap_cchn_ref: true,
                        scopes: {
                            include: { scope: true }
                        }
                    }
                }
            }
        });

        const syncData: Prisma.Mau02CatalogCreateManyInput[] = [];
        let stt = 1;

        // 3. Map Data
        for (const staff of staffList) {
            // Determine Gender (1: Nam, 2: Nữ)
            let gioi_tinh = 1; // Default to Nam
            if (staff.gioi_tinh_ref?.code) {
                const codeUpper = staff.gioi_tinh_ref.code.toUpperCase();
                if (codeUpper === 'NU' || codeUpper === 'NỮ' || codeUpper === '2') {
                    gioi_tinh = 2;
                }
            }

            // If a staff doesn't have an active CCHN, do we sync them?
            // Mau 02 usually requires MACCHN. But let's create a row anyway if they have no CCHN?
            // Actually, Mau 02 is specifically for "Danh sách nhân viên y tế có CCHN".
            // Let's only sync staff who have at least one active certificate, OR we sync everyone and leave CCHN blank.
            // Usually it's better to sync everyone, because non-clinical staff might be needed too.
            // But if they have multiple CCHNs, we create multiple rows.

            if (staff.certificates.length > 0) {
                for (const cert of staff.certificates) {
                    const scopes = cert.scopes.map(s => s.ma_pham_vi).filter(Boolean);
                    const phamViCm = scopes.join(';');

                    syncData.push({
                        STT: stt++,
                        MA_KHOA: staff.department?.ma_khoa_bhyt || staff.department?.ma_khoa || '',
                        TEN_KHOA: staff.department?.ten_khoa || '',
                        HO_TEN: staff.ho_ten,
                        GIOI_TINH: gioi_tinh,
                        SO_DINH_DANH: (decryptField(staff.cccd) || staff.cccd) || staff.ma_nv || '',
                        CHUCDANH_NN: staff.ma_chuc_danh_bhyt || staff.chuc_danh_ref?.bhyt_code || mapToBhytCode(staff.chuc_danh_ref?.code),
                        VI_TRI: staff.ma_vi_tri_bhyt || staff.vi_tri_bhyt_ref?.code || staff.chuc_vu_ref?.bhyt_code || '',
                        MACCHN: cert.so_cchn,
                        NGAYCAP_CCHN: formatDate(cert.ngay_cap),
                        NOICAP_CCHN: cert.noi_cap_cchn_ref?.name || '',
                        PHAMVI_CM: phamViCm,
                        PHAMVI_CMBS: cert.pham_vi_bo_sung || '',
                        DVKT_KHAC: cert.dich_vu_ky_thuat || '',
                        VB_PHANCONG: cert.vb_phan_cong || '',
                        THOIGIAN_DK: cert.thoi_gian_dang_ky ? parseInt(cert.thoi_gian_dang_ky) : null,
                        THOIGIAN_NGAY: cert.thoi_gian_ngay || '',
                        THOIGIAN_TUAN: cert.thoi_gian_tuan || '',
                        CSKCB_KHAC: cert.cskcb_khac || '',
                        CSKCB_CGKT: cert.cskcb_cgkt || '',
                        QD_CGKT: cert.qd_cgkt || '',
                        TU_NGAY: formatDate(cert.tu_ngay),
                        DEN_NGAY: formatDate(cert.den_ngay)
                    });
                }
            } else {
                // Staff without CCHN
                syncData.push({
                    STT: stt++,
                    MA_KHOA: staff.department?.ma_khoa_bhyt || staff.department?.ma_khoa || '',
                    TEN_KHOA: staff.department?.ten_khoa || '',
                    HO_TEN: staff.ho_ten,
                    GIOI_TINH: gioi_tinh,
                    SO_DINH_DANH: (decryptField(staff.cccd) || staff.cccd) || staff.ma_nv || '',
                    CHUCDANH_NN: staff.ma_chuc_danh_bhyt || staff.chuc_danh_ref?.bhyt_code || mapToBhytCode(staff.chuc_danh_ref?.code),
                    VI_TRI: staff.ma_vi_tri_bhyt || staff.vi_tri_bhyt_ref?.code || staff.chuc_vu_ref?.bhyt_code || ''
                });
            }
        }

        // 3. Wrap Snapshot + Delete old Mau02 + Insert new Mau02 atomically in transaction
        const result = await prisma.$transaction(
            async (tx) => {
                const oldRows = await tx.mau02Catalog.findMany();
                const snap = await createDeleteSnapshot({
                    tx,
                    tableName: 'Mau02Catalog',
                    displayName: 'Danh mục Mẫu 02 (trước khi Đồng bộ)',
                    actionType: 'SYNC_OVERWRITE',
                    filterSummary: staffIds.length > 0 ? `Đồng bộ ${staffIds.length} nhân sự` : 'Đồng bộ toàn viện',
                    recordsCount: oldRows.length,
                    data: oldRows,
                    user: auth.user,
                });

                await tx.mau02Catalog.deleteMany();
                if (syncData.length > 0) {
                    await tx.mau02Catalog.createMany({
                        data: syncData,
                    });
                }

                return { count: syncData.length, snapshotId: snap.snapshotId };
            },
            { timeout: 30000 }
        );

        return NextResponse.json({ success: true, ...result });
    } catch (error: any) {
        console.error("Sync Mau02 Error:", error);
        if (error instanceof SnapshotLimitError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Lỗi đồng bộ: ' + error.message }, { status: 500 });
    }
}
