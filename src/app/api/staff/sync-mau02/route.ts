import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import moment from 'moment'; // Ensure moment is available or use native Date formatting

export const dynamic = 'force-dynamic';

function formatDate(date: Date | null | undefined): string | null {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

export async function POST(request: Request) {
    try {
        // 1. Delete all existing Mau02 records
        await prisma.mau02Catalog.deleteMany();

        const body = await request.json().catch(() => ({}));
        const staffIds: string[] = body.staffIds || [];

        // 2. Fetch Staff with their active CCHNs and related refs
        const whereClause = staffIds.length > 0 ? { id: { in: staffIds } } : {};

        const staffList = await prisma.staff.findMany({
            where: whereClause,
            include: {
                department: true,
                gioi_tinh_ref: true,
                chuc_danh_ref: true,
                vi_tri_ref: true,
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

        const syncData = [];
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
                        SO_DINH_DANH: staff.cccd || staff.ma_nv || '',
                        CHUCDANH_NN: staff.chuc_danh_ref?.code || '',
                        VI_TRI: staff.vi_tri_ref?.code || '',
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
                    SO_DINH_DANH: staff.cccd || staff.ma_nv || '',
                    CHUCDANH_NN: staff.chuc_danh_ref?.code || '',
                    VI_TRI: staff.vi_tri_ref?.code || ''
                });
            }
        }

        if (syncData.length > 0) {
            await prisma.mau02Catalog.createMany({
                data: syncData
            });
        }

        return NextResponse.json({ success: true, count: syncData.length });
    } catch (error: any) {
        console.error("Sync Mau02 Error:", error);
        return NextResponse.json({ error: 'Lỗi đồng bộ: ' + error.message }, { status: 500 });
    }
}
