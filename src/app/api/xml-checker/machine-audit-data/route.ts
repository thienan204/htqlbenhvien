import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export interface MachineCatalogItem {
    id: string;
    MA_MAY: string;
    TEN_TB: string;
    KY_HIEU: string;
    CONGTY_SX?: string | null;
    NUOC_SX?: string | null;
    NAM_SX?: number | null;
    NAM_SD?: number | null;
    HD_TU?: string | null;
    HD_DEN?: string | null;
    TU_NGAY?: string | null;
    DEN_NGAY?: string | null;
    isActive: boolean;
    ma_khoa_su_dung?: string | null;
    ten_khoa_su_dung?: string | null;
    loai_may_code?: string | null;
    ma_dich_vu_thuc_hien?: string | null;
}

export interface RequiredServiceItem {
    MA_DICH_VU: string;
    TEN_DICH_VU: string;
    yeu_cau_may_moc?: string | null;
}

export async function GET() {
    try {
        // 1. Lấy danh sách Mẫu 06 (thiết bị y tế)
        const mau06Raw = await prisma.mau06Catalog.findMany({
            where: { isActive: true },
            select: {
                id: true,
                MA_MAY: true,
                TEN_TB: true,
                KY_HIEU: true,
                CONGTY_SX: true,
                NUOC_SX: true,
                NAM_SX: true,
                NAM_SD: true,
                HD_TU: true,
                HD_DEN: true,
                TU_NGAY: true,
                DEN_NGAY: true,
                isActive: true,
                loai_may_code: true,
                ma_dich_vu_thuc_hien: true
            },
            orderBy: { MA_MAY: 'asc' }
        });

        // 2. Lấy vị trí khoa phòng hiện tại của các máy
        const activeLocations = await prisma.machineLocationHistory.findMany({
            where: {
                ma_may: { in: mau06Raw.map(r => r.MA_MAY).filter(Boolean) as string[] },
                den_ngay: null
            },
            select: {
                ma_may: true,
                ma_khoa: true
            }
        });

        const activeDepts = await prisma.department.findMany({
            where: {
                ma_khoa: { in: activeLocations.map(l => l.ma_khoa) }
            },
            select: {
                ma_khoa: true,
                ten_khoa: true
            }
        });

        const deptMap = new Map(activeDepts.map(d => [d.ma_khoa, d.ten_khoa]));
        const locMap = new Map(activeLocations.map(l => [l.ma_may, l.ma_khoa]));

        const mau06List: MachineCatalogItem[] = mau06Raw.map(r => {
            const ma_khoa = r.MA_MAY ? locMap.get(r.MA_MAY) : null;
            const ten_khoa = ma_khoa ? deptMap.get(ma_khoa) : null;
            return {
                id: r.id,
                MA_MAY: r.MA_MAY ? String(r.MA_MAY).trim() : '',
                TEN_TB: r.TEN_TB ? String(r.TEN_TB).trim() : '',
                KY_HIEU: r.KY_HIEU ? String(r.KY_HIEU).trim() : '',
                CONGTY_SX: r.CONGTY_SX,
                NUOC_SX: r.NUOC_SX,
                NAM_SX: r.NAM_SX,
                NAM_SD: r.NAM_SD,
                HD_TU: r.HD_TU,
                HD_DEN: r.HD_DEN,
                TU_NGAY: r.TU_NGAY,
                DEN_NGAY: r.DEN_NGAY,
                isActive: r.isActive,
                ma_khoa_su_dung: ma_khoa || null,
                ten_khoa_su_dung: ten_khoa || null,
                loai_may_code: r.loai_may_code || null,
                ma_dich_vu_thuc_hien: r.ma_dich_vu_thuc_hien || null
            };
        });

        // 3. Lấy danh sách dịch vụ Mẫu 05 yêu cầu bắt buộc mã máy (kèm tên & loại máy yêu cầu nếu có)
        const requiredServicesRaw: any[] = await prisma.$queryRaw`
            SELECT DISTINCT ON ("MA_DICH_VU") "MA_DICH_VU", "TEN_DICH_VU", "yeu_cau_may_moc"
            FROM "Mau05Catalog"
            WHERE "isActive" = true AND "bat_buoc_co_ma_may" = true AND "MA_DICH_VU" IS NOT NULL
            ORDER BY "MA_DICH_VU" ASC, "createdAt" DESC
        `;

        const requiredServices: RequiredServiceItem[] = [];
        const requiredServiceCodes: string[] = [];
        for (const s of requiredServicesRaw) {
            const code = s.MA_DICH_VU ? String(s.MA_DICH_VU).trim() : '';
            if (!code) continue;
            requiredServiceCodes.push(code);
            requiredServices.push({
                MA_DICH_VU: code,
                TEN_DICH_VU: s.TEN_DICH_VU ? String(s.TEN_DICH_VU).trim() : '',
                yeu_cau_may_moc: s.yeu_cau_may_moc ? String(s.yeu_cau_may_moc).trim() : null
            });
        }

        return NextResponse.json({
            success: true,
            mau06List,
            requiredServiceCodes,
            requiredServices
        });
    } catch (error: any) {
        console.error('Error fetching machine audit data:', error);
        return NextResponse.json(
            { success: false, message: 'Internal Server Error', error: String(error) },
            { status: 500 }
        );
    }
}

