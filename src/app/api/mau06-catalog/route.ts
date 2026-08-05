import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

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

        // Bulk insert
        if (Array.isArray(body)) {
            const validBody = body.filter(row => Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== ''));
            
            // Deduplicate validBody to only keep the last occurrence of each MA_MAY
            const deduplicatedMap = new Map();
            const rowsWithoutMaMay = [];
            for (const row of validBody) {
                if (row.MA_MAY) {
                    deduplicatedMap.set(row.MA_MAY, row);
                } else {
                    rowsWithoutMaMay.push(row);
                }
            }
            const finalBody = [...Array.from(deduplicatedMap.values()), ...rowsWithoutMaMay];
            
            const maMayList = Array.from(deduplicatedMap.keys());
            
            // Only compare with ACTIVE records as requested by user
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
            
            await prisma.$transaction(async (tx) => {
                for (const row of finalBody) {
                    const createData = {
                        STT: row.STT ? Number(row.STT) : null,
                        TEN_TB: row.TEN_TB ? String(row.TEN_TB) : null,
                        KY_HIEU: row.KY_HIEU ? String(row.KY_HIEU) : null,
                        CONGTY_SX: row.CONGTY_SX ? String(row.CONGTY_SX) : null,
                        NUOC_SX: row.NUOC_SX ? String(row.NUOC_SX).substring(0, 100) : null,
                        NAM_SX: row.NAM_SX ? Number(row.NAM_SX) : null,
                        NAM_SD: row.NAM_SD ? Number(row.NAM_SD) : null,
                        MA_MAY: row.MA_MAY ? String(row.MA_MAY) : null,
                        TEN_BV: row.TEN_BV ? String(row.TEN_BV) : null,
                        SO_LUU_HANH: row.SO_LUU_HANH ? String(row.SO_LUU_HANH).substring(0, 20) : null,
                        HD_TU: row.HD_TU ? String(row.HD_TU).substring(0, 8) : null,
                        HD_DEN: row.HD_DEN ? String(row.HD_DEN).substring(0, 8) : null,
                        TU_NGAY: row.TU_NGAY ? String(row.TU_NGAY).substring(0, 8) : null,
                        DEN_NGAY: row.DEN_NGAY ? String(row.DEN_NGAY).substring(0, 8) : null,
                        MA_CSKCB: row.MA_CSKCB ? String(row.MA_CSKCB).substring(0, 5) : null,
                        loai_may_code: row.loai_may_code ? String(row.loai_may_code) : null,
                        isActive: true,
                    };

                    if (!createData.MA_MAY) {
                        await tx.mau06Catalog.create({ data: createData });
                        insertedCount++;
                        continue;
                    }

                    const existing = existingMap.get(createData.MA_MAY);
                    
                    if (existing) {
                        const isIdentical = 
                            existing.TEN_TB === createData.TEN_TB &&
                            existing.KY_HIEU === createData.KY_HIEU &&
                            existing.CONGTY_SX === createData.CONGTY_SX &&
                            existing.NUOC_SX === createData.NUOC_SX &&
                            existing.NAM_SX === createData.NAM_SX &&
                            existing.NAM_SD === createData.NAM_SD &&
                            existing.TEN_BV === createData.TEN_BV &&
                            existing.SO_LUU_HANH === createData.SO_LUU_HANH &&
                            existing.HD_TU === createData.HD_TU &&
                            existing.HD_DEN === createData.HD_DEN &&
                            existing.TU_NGAY === createData.TU_NGAY &&
                            existing.DEN_NGAY === createData.DEN_NGAY &&
                            existing.MA_CSKCB === createData.MA_CSKCB &&
                            existing.loai_may_code === createData.loai_may_code;

                        if (isIdentical) {
                            continue; // Skip because active record is identical
                        } else {
                            // Different -> deactivate current active one
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

            return NextResponse.json({ success: true, count: insertedCount, updatedCount });
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
                isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
            }
        });

        return NextResponse.json(newRecord);
    } catch (error) {
        console.error('Error creating mau06 catalog record:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
