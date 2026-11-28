import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';
import { getSystemConfig } from '@/lib/systemConfig';
import { authorizeMau06Action, hasMau06MenuPermission, normalizeMaDichVuList } from './_auth';
import { createDeleteSnapshot, SnapshotLimitError } from '@/lib/deleteProtection';

export const dynamic = 'force-dynamic';

function getRowValue(row: any, ...keys: string[]): any {
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) {
            const val = String(row[key]).trim();
            if (val !== '') return row[key];
        }
    }
    return null;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        let ma_khoa = searchParams.get('ma_khoa');

        // Bảo vệ phân quyền xem theo khoa ngay tại Backend (Defense in Depth)
        const currentUser = await getCurrentUserFromRequest(request);
        if (currentUser && currentUser.role !== 'ADMIN' && !hasMau06MenuPermission(currentUser, 'EDIT')) {
            const filterRaw = await getSystemConfig('MAU06_FILTER_BY_DEPARTMENT', 'true');
            const filterByDept = filterRaw === 'true' || filterRaw === '1';
            if (filterByDept) {
                const rolesRaw = await getSystemConfig('MAU06_VIEW_ALL_ROLES', 'ADMIN,CNTT,VTYT');
                const viewAllRoles = rolesRaw.split(',').map(s => s.trim()).filter(Boolean);
                if (!viewAllRoles.includes(currentUser.role) && currentUser.ma_khoa) {
                    ma_khoa = currentUser.ma_khoa;
                }
            }
        }

        let whereClause = {};

        if (ma_khoa) {
            const locations = await prisma.machineLocationHistory.findMany({
                where: { ma_khoa },
                select: { ma_may: true }
            });
            const maMayList = locations.map(l => l.ma_may);
            whereClause = {
                MA_MAY: { in: maMayList }
            };
        }

        const records = await prisma.mau06Catalog.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });

        // Fetch current active locations for these machines
        const activeLocations = await prisma.machineLocationHistory.findMany({
            where: {
                ma_may: { in: records.map(r => r.MA_MAY).filter(Boolean) as string[] },
                den_ngay: null
            }
        });

        // Fetch department names
        const departments = await prisma.department.findMany({
            where: {
                ma_khoa: { in: activeLocations.map(l => l.ma_khoa) }
            }
        });

        const deptMap = new Map(departments.map(d => [d.ma_khoa, d.ten_khoa]));
        const locMap = new Map(activeLocations.map(l => [l.ma_may, l.ma_khoa]));

        const recordsWithDept = records.map(r => {
            const ma_khoa = r.MA_MAY ? locMap.get(r.MA_MAY) : null;
            const ten_khoa = ma_khoa ? deptMap.get(ma_khoa) : null;
            return {
                ...r,
                ma_khoa_su_dung: ma_khoa,
                ten_khoa_su_dung: ten_khoa
            };
        });

        return NextResponse.json(recordsWithDept);
    } catch (error) {
        console.error('Error fetching mau06 catalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        let ids: string[] | null = null;
        let deleteAllBody = false;
        let confirmBody = false;
        try {
            const body = await request.json();
            if (body && Array.isArray(body.ids)) {
                ids = body.ids;
            }
            if (body?.deleteAll === true) deleteAllBody = true;
            if (body?.confirmDeleteAll === true) confirmBody = true;
        } catch {
            // Body rỗng
        }

        const { searchParams } = new URL(request.url);
        const deleteAllQuery = searchParams.get('deleteAll') === 'true';
        const confirmQuery = searchParams.get('confirmDeleteAll') === 'true';

        const isDeleteAll = (!ids || ids.length === 0);
        const auth = await authorizeMau06Action(request, 'DELETE', isDeleteAll);
        if (auth.errorResponse) return auth.errorResponse;

        if (isDeleteAll) {
            // Chặn trường hợp client gửi nhầm ids: [] hoặc gọi DELETE rỗng không xác nhận
            if (Array.isArray(ids) && ids.length === 0 && !deleteAllBody && !deleteAllQuery) {
                return NextResponse.json({ error: 'Chưa chọn thiết bị nào để xóa.' }, { status: 400 });
            }
            if (!confirmBody && !confirmQuery) {
                return NextResponse.json(
                    { error: 'Thiếu xác nhận confirmDeleteAll=true khi xóa toàn bộ Danh mục Mẫu 06.' },
                    { status: 400 }
                );
            }
        }

        const whereClause = ids && ids.length > 0 ? { id: { in: ids } } : {};
        const result = await prisma.$transaction(
            async (tx) => {
                const targetRows = await tx.mau06Catalog.findMany({ where: whereClause });
                const snap = await createDeleteSnapshot({
                    tx,
                    tableName: 'Mau06Catalog',
                    displayName: isDeleteAll ? 'Toàn bộ Danh mục Mẫu 06 (Thiết bị y tế)' : `Mẫu 06 (${targetRows.length} thiết bị)`,
                    actionType: isDeleteAll ? 'DELETE_ALL' : 'BULK_DELETE',
                    filterSummary: isDeleteAll ? 'Toàn bệnh viện' : `${targetRows.length} ID đã chọn`,
                    recordsCount: targetRows.length,
                    data: targetRows,
                    user: auth.user,
                });
                const deleted = await tx.mau06Catalog.deleteMany({ where: whereClause });
                return { count: deleted.count, snapshotId: snap.snapshotId };
            },
            { timeout: 30000 }
        );

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error('Error deleting mau06 catalog:', error);
        if (error instanceof SnapshotLimitError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await authorizeMau06Action(request, 'EDIT');
        if (auth.errorResponse) return auth.errorResponse;

        const body = await request.json();

        // 1. Chức năng khôi phục Tên Bệnh viện từ lịch sử cho các máy đang bị null
        if (body && body.action === 'RECOVER_HOSPITAL_NAMES') {
            const activeEmpty = await prisma.mau06Catalog.findMany({
                where: {
                    isActive: true,
                    OR: [
                        { TEN_BV: null },
                        { TEN_BV: '' }
                    ]
                }
            });

            let recoveredCount = 0;
            for (const active of activeEmpty) {
                if (!active.MA_MAY) continue;
                const previousRecord = await prisma.mau06Catalog.findFirst({
                    where: {
                        MA_MAY: active.MA_MAY,
                        isActive: false,
                        TEN_BV: { not: null },
                        NOT: { TEN_BV: '' }
                    },
                    orderBy: { createdAt: 'desc' }
                });

                if (previousRecord && previousRecord.TEN_BV) {
                    await prisma.mau06Catalog.update({
                        where: { id: active.id },
                        data: { TEN_BV: previousRecord.TEN_BV }
                    });
                    recoveredCount++;
                }
            }

            return NextResponse.json({
                success: true,
                recoveredCount,
                message: `Đã khôi phục Tên bệnh viện cho ${recoveredCount} thiết bị từ lịch sử.`
            });
        }

        // 2. Bulk insert / Import Excel
        if (Array.isArray(body)) {
            const validBody = body.filter(row => Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== ''));

            // Deduplicate validBody theo MA_MAY (lấy dòng xuất hiện cuối cùng trong file)
            const deduplicatedMap = new Map();
            const rowsWithoutMaMay: any[] = [];
            for (const row of validBody) {
                const maMay = getRowValue(row, 'MA_MAY', 'Mã máy', 'Mã Máy', 'Ma may', 'Ma May', 'Mã');
                if (maMay) {
                    deduplicatedMap.set(String(maMay).trim(), row);
                } else {
                    rowsWithoutMaMay.push(row);
                }
            }
            const finalBody = [...Array.from(deduplicatedMap.values()), ...rowsWithoutMaMay];
            const maMayList = Array.from(deduplicatedMap.keys());

            // Chỉ so sánh với các bản ghi đang ACTIVE
            const existingActiveRecords = await prisma.mau06Catalog.findMany({
                where: { MA_MAY: { in: maMayList }, isActive: true }
            });

            const existingMap = new Map();
            for (const r of existingActiveRecords) {
                if (r.MA_MAY) {
                    existingMap.set(r.MA_MAY, r);
                }
            }

            let insertedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;

            await prisma.$transaction(async (tx) => {
                for (const row of finalBody) {
                    const rawMaMay = getRowValue(row, 'MA_MAY', 'Mã máy', 'Mã Máy', 'Ma may', 'Ma May', 'Mã');
                    const ma_may = rawMaMay ? String(rawMaMay).trim() : null;
                    const existing = ma_may ? existingMap.get(ma_may) : null;

                    // Đọc các trường từ file Excel mới
                    const rawTenTb = getRowValue(row, 'TEN_TB', 'Tên Thiết Bị', 'Tên thiết bị', 'Tên TB', 'Ten TB', 'Tên Thiết bị');
                    const rawKyHieu = getRowValue(row, 'KY_HIEU', 'Model', 'Ký hiệu', 'Ký Hiệu', 'Ky hieu');
                    const rawCongTy = getRowValue(row, 'CONGTY_SX', 'Công ty SX', 'Công ty sản xuất', 'Hãng SX', 'Hãng sản xuất', 'Cong ty SX');
                    const rawNuocSx = getRowValue(row, 'NUOC_SX', 'Nước SX', 'Nước sản xuất', 'Nuoc SX');
                    const rawNamSx = getRowValue(row, 'NAM_SX', 'Năm SX', 'Năm sản xuất', 'Nam SX');
                    const rawNamSd = getRowValue(row, 'NAM_SD', 'Năm SD', 'Năm sử dụng', 'Nam SD');
                    const rawTenBv = getRowValue(row, 'TEN_BV', 'Tên Bệnh viện', 'Tên bệnh viện', 'Tên BV', 'Ten BV', 'Ten Benh Vien');
                    const rawSoLuuHanh = getRowValue(row, 'SO_LUU_HANH', 'Số lưu hành', 'Số Lưu Hành', 'So luu hanh');
                    const rawHdTu = getRowValue(row, 'HD_TU', 'HĐ Từ', 'HD Tu');
                    const rawHdDen = getRowValue(row, 'HD_DEN', 'HĐ Đến', 'HD Den');
                    const rawTuNgay = getRowValue(row, 'TU_NGAY', 'Từ ngày', 'Tu ngay');
                    const rawDenNgay = getRowValue(row, 'DEN_NGAY', 'Đến ngày', 'Den ngay');
                    const rawMaCskcb = getRowValue(row, 'MA_CSKCB', 'Mã CSKCB', 'Ma CSKCB');
                    const rawLoaiMay = getRowValue(row, 'loai_may_code', 'Loại máy', 'Loại Máy', 'Loai may', 'Phân loại', 'Phân loại máy', 'PHAN_LOAI_MAY', 'Phân loại (Loại máy)');
                    const rawMaDichVuThucHien = getRowValue(row, 'ma_dich_vu_thuc_hien', 'MA_DICH_VU_THUC_HIEN', 'Mã DV thực hiện', 'Mã dịch vụ thực hiện', 'MA_DICH_VU', 'Mã DV');
                    const rawStt = getRowValue(row, 'STT', 'Số thứ tự', 'So thu tu');

                    // Helper so sánh & kế thừa thông minh: chỉ coi là thay đổi khi người dùng có cung cấp giá trị mới khác với giá trị cũ
                    let hasFieldChange = false;

                    const checkStr = (rawVal: any, oldVal: string | null | undefined, maxLen?: number): string | null => {
                        if (rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '') {
                            let strVal = String(rawVal).trim();
                            if (maxLen && strVal.length > maxLen) strVal = strVal.substring(0, maxLen);
                            if ((oldVal || null) !== (strVal || null)) {
                                hasFieldChange = true;
                            }
                            return strVal;
                        }
                        // File mới không có trường này -> kế thừa bản cũ nếu có
                        return oldVal || null;
                    };

                    const checkNum = (rawVal: any, oldVal: number | null | undefined): number | null => {
                        if (rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '') {
                            const num = Number(rawVal);
                            const parsedNum = isNaN(num) ? null : num;
                            if ((oldVal ?? null) !== (parsedNum ?? null)) {
                                hasFieldChange = true;
                            }
                            return parsedNum;
                        }
                        return oldVal ?? null;
                    };

                    if (!existing) {
                        // Thiết bị hoàn toàn mới
                        const createData = {
                            STT: rawStt ? Number(rawStt) : null,
                            TEN_TB: rawTenTb ? String(rawTenTb).trim() : null,
                            KY_HIEU: rawKyHieu ? String(rawKyHieu).trim() : null,
                            CONGTY_SX: rawCongTy ? String(rawCongTy).trim() : null,
                            NUOC_SX: rawNuocSx ? String(rawNuocSx).trim().substring(0, 100) : null,
                            NAM_SX: rawNamSx ? Number(rawNamSx) : null,
                            NAM_SD: rawNamSd ? Number(rawNamSd) : null,
                            MA_MAY: ma_may,
                            TEN_BV: rawTenBv ? String(rawTenBv).trim() : null,
                            SO_LUU_HANH: rawSoLuuHanh ? String(rawSoLuuHanh).trim().substring(0, 20) : null,
                            HD_TU: rawHdTu ? String(rawHdTu).trim().substring(0, 8) : null,
                            HD_DEN: rawHdDen ? String(rawHdDen).trim().substring(0, 8) : null,
                            TU_NGAY: rawTuNgay ? String(rawTuNgay).trim().substring(0, 8) : null,
                            DEN_NGAY: rawDenNgay ? String(rawDenNgay).trim().substring(0, 8) : null,
                            MA_CSKCB: rawMaCskcb ? String(rawMaCskcb).trim().substring(0, 5) : null,
                            loai_may_code: rawLoaiMay ? String(rawLoaiMay).trim() : null,
                            ma_dich_vu_thuc_hien: normalizeMaDichVuList(rawMaDichVuThucHien),
                            isActive: true,
                        };
                        const newRec = await tx.mau06Catalog.create({ data: createData });
                        insertedCount++;
                        if (ma_may) existingMap.set(ma_may, newRec);
                    } else {
                        // Đã có bản ghi ACTIVE trong DB -> Kiểm tra từng field
                        const finalTenTb = checkStr(rawTenTb, existing.TEN_TB);
                        const finalKyHieu = checkStr(rawKyHieu, existing.KY_HIEU);
                        const finalCongTy = checkStr(rawCongTy, existing.CONGTY_SX);
                        const finalNuocSx = checkStr(rawNuocSx, existing.NUOC_SX, 100);
                        const finalNamSx = checkNum(rawNamSx, existing.NAM_SX);
                        const finalNamSd = checkNum(rawNamSd, existing.NAM_SD);
                        const finalTenBv = checkStr(rawTenBv, existing.TEN_BV);
                        const finalSoLuuHanh = checkStr(rawSoLuuHanh, existing.SO_LUU_HANH, 20);
                        const finalHdTu = checkStr(rawHdTu, existing.HD_TU, 8);
                        const finalHdDen = checkStr(rawHdDen, existing.HD_DEN, 8);
                        const finalTuNgay = checkStr(rawTuNgay, existing.TU_NGAY, 8);
                        const finalDenNgay = checkStr(rawDenNgay, existing.DEN_NGAY, 8);
                        const finalMaCskcb = checkStr(rawMaCskcb, existing.MA_CSKCB, 5);
                        const finalLoaiMay = checkStr(rawLoaiMay, existing.loai_may_code);
                        const normalizedNewDv = rawMaDichVuThucHien ? normalizeMaDichVuList(rawMaDichVuThucHien) : null;
                        const finalMaDichVuThucHien = checkStr(normalizedNewDv, existing.ma_dich_vu_thuc_hien);
                        const finalStt = checkNum(rawStt, existing.STT);

                        if (!hasFieldChange) {
                            // Không có field nào thay đổi -> Giữ nguyên, bỏ qua
                            skippedCount++;
                            continue;
                        }

                        // Có field thay đổi -> Disable bản cũ (isActive: false) và Tạo bản mới (isActive: true)
                        await tx.mau06Catalog.update({
                            where: { id: existing.id },
                            data: { isActive: false }
                        });

                        const newRec = await tx.mau06Catalog.create({
                            data: {
                                STT: finalStt,
                                TEN_TB: finalTenTb,
                                KY_HIEU: finalKyHieu,
                                CONGTY_SX: finalCongTy,
                                NUOC_SX: finalNuocSx,
                                NAM_SX: finalNamSx,
                                NAM_SD: finalNamSd,
                                MA_MAY: ma_may,
                                TEN_BV: finalTenBv,
                                SO_LUU_HANH: finalSoLuuHanh,
                                HD_TU: finalHdTu,
                                HD_DEN: finalHdDen,
                                TU_NGAY: finalTuNgay,
                                DEN_NGAY: finalDenNgay,
                                MA_CSKCB: finalMaCskcb,
                                loai_may_code: finalLoaiMay,
                                ma_dich_vu_thuc_hien: finalMaDichVuThucHien,
                                isActive: true,
                            }
                        });

                        insertedCount++;
                        updatedCount++;
                        if (ma_may) existingMap.set(ma_may, newRec);
                    }
                }
            });

            return NextResponse.json({ 
                success: true, 
                count: insertedCount, 
                updatedCount,
                skipped: skippedCount 
            });
        }

        // Single insert
        const newRecord = await prisma.mau06Catalog.create({
            data: {
                STT: body.STT ? Number(body.STT) : null,
                TEN_TB: body.TEN_TB ? String(body.TEN_TB) : null,
                KY_HIEU: body.KY_HIEU ? String(body.KY_HIEU) : null,
                CONGTY_SX: body.CONGTY_SX ? String(body.CONGTY_SX) : null,
                NUOC_SX: body.NUOC_SX ? String(body.NUOC_SX).substring(0, 100) : null,
                NAM_SX: body.NAM_SX ? Number(body.NAM_SX) : null,
                NAM_SD: body.NAM_SD ? Number(body.NAM_SD) : null,
                MA_MAY: body.MA_MAY ? String(body.MA_MAY) : null,
                TEN_BV: body.TEN_BV ? String(body.TEN_BV) : null,
                SO_LUU_HANH: body.SO_LUU_HANH ? String(body.SO_LUU_HANH).substring(0, 20) : null,
                HD_TU: body.HD_TU ? String(body.HD_TU).substring(0, 8) : null,
                HD_DEN: body.HD_DEN ? String(body.HD_DEN).substring(0, 8) : null,
                TU_NGAY: body.TU_NGAY ? String(body.TU_NGAY).substring(0, 8) : null,
                DEN_NGAY: body.DEN_NGAY ? String(body.DEN_NGAY).substring(0, 8) : null,
                MA_CSKCB: body.MA_CSKCB ? String(body.MA_CSKCB).substring(0, 5) : null,
                loai_may_code: body.loai_may_code ? String(body.loai_may_code) : null,
                ma_dich_vu_thuc_hien: normalizeMaDichVuList(body.ma_dich_vu_thuc_hien),
                isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
            }
        });

        return NextResponse.json(newRecord);
    } catch (error) {
        console.error('Error creating mau06 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
