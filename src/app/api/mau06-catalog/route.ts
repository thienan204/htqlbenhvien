import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
        const ma_khoa = searchParams.get('ma_khoa');
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

export async function DELETE() {
    try {
        const result = await prisma.mau06Catalog.deleteMany({});
        return NextResponse.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Error deleting mau06 catalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
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

                    // Nhận diện linh hoạt Tên Bệnh viện
                    const rawTenBv = getRowValue(row, 'TEN_BV', 'Tên Bệnh viện', 'Tên bệnh viện', 'Tên BV', 'Ten BV', 'Ten Benh Vien');
                    // Kế thừa Tên Bệnh viện cũ nếu file mới không có
                    const finalTenBv = (rawTenBv !== null && String(rawTenBv).trim() !== '')
                        ? String(rawTenBv).trim()
                        : (existing && existing.TEN_BV ? existing.TEN_BV : null);

                    // Nhận diện linh hoạt Loại máy
                    const rawLoaiMay = getRowValue(row, 'loai_may_code', 'Loại máy', 'Loại Máy', 'Loai may');
                    const finalLoaiMay = (rawLoaiMay !== null && String(rawLoaiMay).trim() !== '')
                        ? String(rawLoaiMay).trim()
                        : (existing && existing.loai_may_code ? existing.loai_may_code : null);

                    const rawTenTb = getRowValue(row, 'TEN_TB', 'Tên Thiết Bị', 'Tên thiết bị', 'Tên TB', 'Ten TB', 'Tên Thiết bị');
                    const rawKyHieu = getRowValue(row, 'KY_HIEU', 'Model', 'Ký hiệu', 'Ký Hiệu', 'Ky hieu');
                    const rawCongTy = getRowValue(row, 'CONGTY_SX', 'Công ty SX', 'Công ty sản xuất', 'Hãng SX', 'Hãng sản xuất', 'Cong ty SX');
                    const rawNuocSx = getRowValue(row, 'NUOC_SX', 'Nước SX', 'Nước sản xuất', 'Nuoc SX');
                    const rawNamSx = getRowValue(row, 'NAM_SX', 'Năm SX', 'Năm sản xuất', 'Nam SX');
                    const rawNamSd = getRowValue(row, 'NAM_SD', 'Năm SD', 'Năm sử dụng', 'Nam SD');
                    const rawSoLuuHanh = getRowValue(row, 'SO_LUU_HANH', 'Số lưu hành', 'Số Lưu Hành', 'So luu hanh');
                    const rawHdTu = getRowValue(row, 'HD_TU', 'HĐ Từ', 'HD Tu');
                    const rawHdDen = getRowValue(row, 'HD_DEN', 'HĐ Đến', 'HD Den');
                    const rawTuNgay = getRowValue(row, 'TU_NGAY', 'Từ ngày', 'Tu ngay');
                    const rawDenNgay = getRowValue(row, 'DEN_NGAY', 'Đến ngày', 'Den ngay');
                    const rawMaCskcb = getRowValue(row, 'MA_CSKCB', 'Mã CSKCB', 'Ma CSKCB');
                    const rawStt = getRowValue(row, 'STT', 'Số thứ tự', 'So thu tu');

                    const createData = {
                        STT: rawStt ? Number(rawStt) : null,
                        TEN_TB: rawTenTb ? String(rawTenTb).trim() : null,
                        KY_HIEU: rawKyHieu ? String(rawKyHieu).trim() : null,
                        CONGTY_SX: rawCongTy ? String(rawCongTy).trim() : null,
                        NUOC_SX: rawNuocSx ? String(rawNuocSx).trim().substring(0, 100) : null,
                        NAM_SX: rawNamSx ? Number(rawNamSx) : null,
                        NAM_SD: rawNamSd ? Number(rawNamSd) : null,
                        MA_MAY: ma_may,
                        TEN_BV: finalTenBv,
                        SO_LUU_HANH: rawSoLuuHanh ? String(rawSoLuuHanh).trim().substring(0, 20) : null,
                        HD_TU: rawHdTu ? String(rawHdTu).trim().substring(0, 8) : null,
                        HD_DEN: rawHdDen ? String(rawHdDen).trim().substring(0, 8) : null,
                        TU_NGAY: rawTuNgay ? String(rawTuNgay).trim().substring(0, 8) : null,
                        DEN_NGAY: rawDenNgay ? String(rawDenNgay).trim().substring(0, 8) : null,
                        MA_CSKCB: rawMaCskcb ? String(rawMaCskcb).trim().substring(0, 5) : null,
                        loai_may_code: finalLoaiMay,
                        isActive: true,
                    };

                    if (!createData.MA_MAY) {
                        await tx.mau06Catalog.create({ data: createData });
                        insertedCount++;
                        continue;
                    }

                    if (existing) {
                        const isIdentical = 
                            (existing.TEN_TB || null) === (createData.TEN_TB || null) &&
                            (existing.KY_HIEU || null) === (createData.KY_HIEU || null) &&
                            (existing.CONGTY_SX || null) === (createData.CONGTY_SX || null) &&
                            (existing.NUOC_SX || null) === (createData.NUOC_SX || null) &&
                            (existing.NAM_SX || null) === (createData.NAM_SX || null) &&
                            (existing.NAM_SD || null) === (createData.NAM_SD || null) &&
                            (existing.TEN_BV || null) === (createData.TEN_BV || null) &&
                            (existing.SO_LUU_HANH || null) === (createData.SO_LUU_HANH || null) &&
                            (existing.HD_TU || null) === (createData.HD_TU || null) &&
                            (existing.HD_DEN || null) === (createData.HD_DEN || null) &&
                            (existing.TU_NGAY || null) === (createData.TU_NGAY || null) &&
                            (existing.DEN_NGAY || null) === (createData.DEN_NGAY || null) &&
                            (existing.MA_CSKCB || null) === (createData.MA_CSKCB || null) &&
                            (existing.loai_may_code || null) === (createData.loai_may_code || null);

                        if (isIdentical) {
                            skippedCount++;
                            continue; // Bỏ qua vì hoàn toàn trùng khớp
                        } else {
                            // Khác thông số kỹ thuật -> lưu bản cũ vào lịch sử và tạo bản mới có đầy đủ Tên Bệnh viện
                            await tx.mau06Catalog.update({
                                where: { id: existing.id },
                                data: { isActive: false }
                            });
                            const newRec = await tx.mau06Catalog.create({ data: createData });
                            insertedCount++;
                            updatedCount++;
                            existingMap.set(createData.MA_MAY, newRec);
                        }
                    } else {
                        const newRec = await tx.mau06Catalog.create({ data: createData });
                        insertedCount++;
                        existingMap.set(createData.MA_MAY, newRec);
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
                isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
            }
        });

        return NextResponse.json(newRecord);
    } catch (error) {
        console.error('Error creating mau06 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
