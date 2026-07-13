import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const searchParams = new URL(request.url).searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const search = searchParams.get('search') || '';
        const trangThaiHS = searchParams.get('trangThaiHS') || '';
        const trangThaiTT = searchParams.get('trangThaiTT') || '';
        const onlyModified = searchParams.get('onlyModified') === 'true';

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
