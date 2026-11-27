import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    authorizeApiRequest,
    createDeleteSnapshot,
    SnapshotLimitError,
} from '@/lib/deleteProtection';

export async function GET(request: Request) {
    try {
        const searchParams = new URL(request.url).searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const search = searchParams.get('search') || '';
        const trangThaiHS = searchParams.get('trangThaiHS') || '';
        const trangThaiTT = searchParams.get('trangThaiTT') || '';
        const onlyModified = searchParams.get('onlyModified') === 'true';
        const ngayRaTu = searchParams.get('ngayRaTu') || '';
        const ngayRaDen = searchParams.get('ngayRaDen') || '';

        const skip = (page - 1) * limit;

        // Xử lý tìm kiếm theo chữ cái đầu (VD: nta -> nguyen thien an)
        let matchingIds: string[] = [];
        if (search && !search.includes(' ') && /^[a-zA-Z]+$/.test(search) && search.length >= 2) {
            try {
                // Tạo regex pattern cho Postgres, VD: "nta" -> "\yn[^\s]*\s+t[^\s]*\s+a[^\s]*"
                const letters = search.split('');
                const regexStr = '\\y' + letters.join('[^\\s]*\\s+') + '[^\\s]*';
                
                const rawResults = await prisma.$queryRawUnsafe<{id: string}[]>(
                    `SELECT id FROM "HoSoDaGui" WHERE "hoTen" ~* $1 OR "chanDoan" ~* $1 OR "mieuTa" ~* $1 LIMIT 300`, 
                    regexStr
                );
                matchingIds = rawResults.map((r: any) => r.id);
            } catch (err) {
                console.error("Lỗi khi tìm kiếm theo chữ cái đầu:", err);
            }
        }

        // Build where clause
        const where: any = {};
        if (search) {
            where.OR = [
                { maLienKet: { contains: search, mode: 'insensitive' } },
                { maBN: { contains: search, mode: 'insensitive' } },
                { maThe: { contains: search, mode: 'insensitive' } },
                { hoTen: { contains: search, mode: 'insensitive' } },
                { ngaySinh: { contains: search, mode: 'insensitive' } },
                { gioiTinh: { contains: search, mode: 'insensitive' } },
                { ngayVao: { contains: search, mode: 'insensitive' } },
                { ngayRa: { contains: search, mode: 'insensitive' } },
                { chanDoan: { contains: search, mode: 'insensitive' } },
                { ngayTT: { contains: search, mode: 'insensitive' } },
                { ngayGuiHS: { contains: search, mode: 'insensitive' } },
                { ngayDeNghiTT: { contains: search, mode: 'insensitive' } },
                { loaiHS: { contains: search, mode: 'insensitive' } },
                { maLoi: { contains: search, mode: 'insensitive' } },
                { mieuTa: { contains: search, mode: 'insensitive' } },
            ];
            
            if (matchingIds.length > 0) {
                where.OR.push({ id: { in: matchingIds } });
            }
        }
        
        if (trangThaiHS) {
            where.trangThaiHS = { contains: trangThaiHS, mode: 'insensitive' };
        }
        
        if (trangThaiTT) {
            where.trangThaiTT = { contains: trangThaiTT, mode: 'insensitive' };
        }

        if (ngayRaTu || ngayRaDen) {
            try {
                let sql = `SELECT id FROM "HoSoDaGui" WHERE "ngayRa" IS NOT NULL AND "ngayRa" != ''`;
                const params: any[] = [];
                let paramIdx = 1;
                
                const extractDateSql = `
                    CASE 
                        WHEN "ngayRa" LIKE '%/%/%' THEN SUBSTRING("ngayRa" FROM 7 FOR 4) || SUBSTRING("ngayRa" FROM 4 FOR 2) || SUBSTRING("ngayRa" FROM 1 FOR 2)
                        ELSE SUBSTRING("ngayRa" FROM 1 FOR 8)
                    END
                `;

                if (ngayRaTu) {
                    sql += ` AND ${extractDateSql} >= $${paramIdx++}`;
                    params.push(ngayRaTu);
                }
                if (ngayRaDen) {
                    sql += ` AND ${extractDateSql} <= $${paramIdx++}`;
                    params.push(ngayRaDen);
                }
                
                // Limit to prevent huge IN clauses
                sql += ` LIMIT 60000`;
                
                const rawDateResults = await prisma.$queryRawUnsafe<{id: string}[]>(sql, ...params);
                const dateIds = rawDateResults.map(r => r.id);
                
                // Add an impossible ID if array is empty so Prisma returns no results safely
                if (dateIds.length === 0) dateIds.push('__NO_MATCH__');
                
                where.id = { in: dateIds };
            } catch (err) {
                console.error("Lỗi khi lọc theo ngày ra:", err);
                where.id = { in: ['__ERROR__'] };
            }
        }

        // Lọc những hồ sơ có lịch sử chỉnh sửa
        if (onlyModified) {
            const modifiedGroups = await prisma.hoSoDaGui.groupBy({
                by: ['maLienKet'],
                having: {
                    maLienKet: { _count: { gt: 1 } }
                }
            });
            where.maLienKet = { in: modifiedGroups.map(g => g.maLienKet) };
        }

        let orderBy: any = { createdAt: 'desc' };
        if (onlyModified) {
            // Khi xem hồ sơ thay đổi, xếp 2 hồ sơ cùng mã cạnh nhau (theo mã trước, sau đó theo ngày)
            orderBy = [
                { maLienKet: 'asc' },
                { createdAt: 'desc' }
            ];
        }

        // Fetch records
        const total = await prisma.hoSoDaGui.count({ where });
        const records = await prisma.hoSoDaGui.findMany({
            where,
            orderBy,
            skip,
            take: limit,
        });

        // Tính toán hasHistory và versionType cho từng bản ghi
        const maLienKets = records.map((r: any) => r.maLienKet);
        let historyMap = new Map();
        
        if (maLienKets.length > 0) {
            const grouped = await prisma.hoSoDaGui.groupBy({
                by: ['maLienKet'],
                where: { maLienKet: { in: maLienKets } },
                _count: { maLienKet: true },
                _min: { createdAt: true },
                _max: { createdAt: true }
            });

            grouped.forEach((g: any) => {
                historyMap.set(g.maLienKet, {
                    count: g._count.maLienKet,
                    minDate: g._min.createdAt?.getTime(),
                    maxDate: g._max.createdAt?.getTime()
                });
            });
        }

        const dataWithHistory = records.map((r: any) => {
            const history = historyMap.get(r.maLienKet);
            let versionType = null;
            
            if (history && history.count > 1) {
                const rTime = new Date(r.createdAt).getTime();
                if (rTime === history.minDate) {
                    versionType = 'Bản gốc';
                } else if (rTime === history.maxDate) {
                    versionType = 'Bản mới nhất';
                } else {
                    versionType = 'Bản thay đổi';
                }
            }

            return {
                ...r,
                hasHistory: history ? history.count > 1 : false,
                versionType
            };
        });

        return NextResponse.json({
            success: true,
            data: dataWithHistory,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        console.error('Lỗi API lấy danh sách hồ sơ:', error);
        return NextResponse.json(
            { error: 'Có lỗi xảy ra khi lấy dữ liệu: ' + error.message },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { ids, deleteAll, confirmDeleteAll, search, trangThaiHS, trangThaiTT, ngayRaTu, ngayRaDen } = body;

        if (deleteAll) {
            const auth = await authorizeApiRequest(request, { requireAdmin: true });
            if (auth.errorResponse) return auth.errorResponse;

            if (confirmDeleteAll !== true) {
                return NextResponse.json(
                    { error: 'Thiếu xác nhận confirmDeleteAll=true khi xóa toàn bộ Hồ sơ đã gửi.' },
                    { status: 400 }
                );
            }

            // Build where clause to delete only filtered items
            const where: any = {};
            
            if (search) {
                where.OR = [
                    { maLienKet: { contains: search, mode: 'insensitive' } },
                    { maBN: { contains: search, mode: 'insensitive' } },
                    { maThe: { contains: search, mode: 'insensitive' } },
                    { hoTen: { contains: search, mode: 'insensitive' } },
                ];
            }
            
            if (trangThaiHS) where.trangThaiHS = { contains: trangThaiHS, mode: 'insensitive' };
            if (trangThaiTT) where.trangThaiTT = { contains: trangThaiTT, mode: 'insensitive' };
            
            if (ngayRaTu || ngayRaDen) {
                where.ngayRa = {};
                if (ngayRaTu) where.ngayRa.gte = ngayRaTu;
                if (ngayRaDen) where.ngayRa.lte = ngayRaDen + '235959';
            }

            const filterDesc = [
                search ? `Tìm: ${search}` : null,
                trangThaiHS ? `HS: ${trangThaiHS}` : null,
                trangThaiTT ? `TT: ${trangThaiTT}` : null,
                ngayRaTu || ngayRaDen ? `Ngày ra: ${ngayRaTu || '*'}..${ngayRaDen || '*'}` : null,
            ].filter(Boolean).join('; ') || 'Toàn bộ bảng HoSoDaGui (không lọc)';

            const result = await prisma.$transaction(
                async (tx) => {
                    const targetCount = await tx.hoSoDaGui.count({ where });
                    let snapshotId: string | undefined;
                    if (targetCount > 0) {
                        const rows = await tx.hoSoDaGui.findMany({ where });
                        const snap = await createDeleteSnapshot({
                            tx,
                            tableName: 'HoSoDaGui',
                            displayName: 'Hồ sơ đã gửi BHXH (trước khi xóa hàng loạt)',
                            actionType: 'DELETE_ALL',
                            filterSummary: filterDesc,
                            recordsCount: rows.length,
                            data: rows,
                            user: auth.user,
                        });
                        snapshotId = snap.snapshotId;
                    }
                    const deleted = await tx.hoSoDaGui.deleteMany({ where });
                    return { count: deleted.count, snapshotId };
                },
                { timeout: 30000 }
            );

            return NextResponse.json({
                success: true,
                count: result.count,
                snapshotId: result.snapshotId,
                message: result.snapshotId
                    ? `Đã xóa ${result.count} hồ sơ (đã lưu Snapshot dự phòng)`
                    : `Đã xóa ${result.count} hồ sơ`,
            });
        } else if (ids && Array.isArray(ids) && ids.length > 0) {
            const auth = await authorizeApiRequest(request, {
                allowedRoles: ['ADMIN', 'CNTT'],
                menuKeys: ['MENU_ERROR_HSDA', 'MENU_CHUYEN_DE'],
                action: 'DELETE',
            });
            if (auth.errorResponse) return auth.errorResponse;

            const result = await prisma.$transaction(
                async (tx) => {
                    const targetRows = await tx.hoSoDaGui.findMany({
                        where: { id: { in: ids } },
                    });
                    const snap = await createDeleteSnapshot({
                        tx,
                        tableName: 'HoSoDaGui',
                        displayName: `Hồ sơ đã gửi BHXH (Xóa ${targetRows.length} dòng đã chọn)`,
                        actionType: 'BULK_DELETE',
                        filterSummary: `${ids.length} dòng đã chọn`,
                        recordsCount: targetRows.length,
                        data: targetRows,
                        user: auth.user,
                    });
                    const deleted = await tx.hoSoDaGui.deleteMany({
                        where: { id: { in: ids } },
                    });
                    return { count: deleted.count, snapshotId: snap.snapshotId };
                },
                { timeout: 30000 }
            );

            return NextResponse.json({
                success: true,
                count: result.count,
                snapshotId: result.snapshotId,
                message: result.snapshotId
                    ? `Đã xóa ${result.count} hồ sơ (đã lưu Snapshot dự phòng)`
                    : `Đã xóa ${result.count} hồ sơ`,
            });
        } else {
            return NextResponse.json({ error: 'Không có dữ liệu để xóa' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Lỗi API xóa hồ sơ:', error);
        if (error instanceof SnapshotLimitError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Có lỗi xảy ra khi xóa dữ liệu: ' + error.message }, { status: 500 });
    }
}
