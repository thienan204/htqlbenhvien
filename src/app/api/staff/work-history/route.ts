import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

// 1. GET: Lấy lịch sử công tác/khoa phòng của nhân viên
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const staffId = searchParams.get('staffId');

        if (!staffId) {
            return NextResponse.json({ error: 'Thiếu staffId' }, { status: 400 });
        }

        // 1. Ưu tiên dùng Prisma model delegate nếu có
        if ((prisma as any).staffWorkHistory?.findMany) {
            const histories = await (prisma as any).staffWorkHistory.findMany({
                where: { staffId },
                include: {
                    department: true,
                    chuc_vu_ref: true
                },
                orderBy: [
                    { isCurrent: 'desc' },
                    { tu_ngay: 'desc' }
                ]
            });
            return NextResponse.json(histories);
        }

        // 2. Fallback dùng Raw SQL (trong trường hợp dev server chưa restart lại node process)
        const rawHistories: any[] = await prisma.$queryRawUnsafe(`
            SELECT 
                w.id,
                w."staffId",
                w.ma_khoa,
                w.chuc_vu_id,
                w.tu_ngay,
                w.den_ngay,
                w.so_quyet_dinh,
                w.ngay_quyet_dinh,
                w.ghi_chu,
                w."isCurrent",
                w."createdAt",
                w."updatedAt",
                CASE 
                    WHEN d.ma_khoa IS NOT NULL THEN json_build_object('ma_khoa', d.ma_khoa, 'ten_khoa', d.ten_khoa) 
                    ELSE NULL 
                END as department,
                CASE 
                    WHEN sc.id IS NOT NULL THEN json_build_object('id', sc.id, 'name', sc.name) 
                    ELSE NULL 
                END as chuc_vu_ref
            FROM "StaffWorkHistory" w
            LEFT JOIN "Department" d ON w.ma_khoa = d.ma_khoa
            LEFT JOIN "SystemCategory" sc ON w.chuc_vu_id = sc.id
            WHERE w."staffId" = $1
            ORDER BY w."isCurrent" DESC, w.tu_ngay DESC
        `, staffId);

        return NextResponse.json(rawHistories);
    } catch (error: any) {
        console.error('Error fetching staff work histories:', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}

// 2. POST: Thêm mốc lịch sử hoặc Thực hiện điều chuyển khoa phòng mới
export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { 
            staffId, 
            ma_khoa, 
            chuc_vu_id, 
            tu_ngay, 
            den_ngay, 
            so_quyet_dinh, 
            ngay_quyet_dinh, 
            ghi_chu, 
            isCurrent 
        } = body;

        if (!staffId || !ma_khoa || !tu_ngay) {
            return NextResponse.json({ error: 'Vui lòng điền đầy đủ Nhân sự, Khoa/Phòng và Ngày bắt đầu' }, { status: 400 });
        }

        const startDate = new Date(tu_ngay);
        const endDate = den_ngay ? new Date(den_ngay) : null;
        const decisionDate = ngay_quyet_dinh ? new Date(ngay_quyet_dinh) : null;

        // Nếu đây là khoa hiện tại (Điều chuyển khoa)
        if (isCurrent) {
            // 1. Chốt các mốc hiện tại cũ
            if ((prisma as any).staffWorkHistory?.updateMany) {
                await (prisma as any).staffWorkHistory.updateMany({
                    where: { staffId, isCurrent: true },
                    data: { isCurrent: false, den_ngay: startDate }
                });
            } else {
                await prisma.$executeRawUnsafe(
                    `UPDATE "StaffWorkHistory" SET "isCurrent" = false, den_ngay = $1 WHERE "staffId" = $2 AND "isCurrent" = true`,
                    startDate, staffId
                );
            }

            // 2. Tạo mốc mới với isCurrent = true
            let newId = 'cwh_' + Date.now() + Math.random().toString(36).substring(2, 7);
            if ((prisma as any).staffWorkHistory?.create) {
                await (prisma as any).staffWorkHistory.create({
                    data: {
                        staffId,
                        ma_khoa,
                        chuc_vu_id: chuc_vu_id || null,
                        tu_ngay: startDate,
                        den_ngay: null,
                        so_quyet_dinh: so_quyet_dinh || null,
                        ngay_quyet_dinh: decisionDate,
                        ghi_chu: ghi_chu || null,
                        isCurrent: true
                    }
                });
            } else {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "StaffWorkHistory" (id, "staffId", ma_khoa, chuc_vu_id, tu_ngay, den_ngay, so_quyet_dinh, ngay_quyet_dinh, ghi_chu, "isCurrent", "createdAt", "updatedAt") 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
                    newId, staffId, ma_khoa, chuc_vu_id || null, startDate, null, so_quyet_dinh || null, decisionDate, ghi_chu || null, true
                );
            }

            // 3. Tự động cập nhật ma_khoa trong hồ sơ Staff
            await prisma.staff.update({
                where: { id: staffId },
                data: { 
                    ma_khoa,
                    ...(chuc_vu_id ? { chuc_vu_id } : {})
                }
            });

            // 4. Tự động đồng bộ sang tài khoản User
            await prisma.user.updateMany({
                where: { staffId },
                data: { ma_khoa }
            });

            return NextResponse.json({ success: true, message: 'Điều chuyển thành công' });
        } else {
            // Thêm mốc lịch sử quá khứ
            let newId = 'cwh_' + Date.now() + Math.random().toString(36).substring(2, 7);
            if ((prisma as any).staffWorkHistory?.create) {
                await (prisma as any).staffWorkHistory.create({
                    data: {
                        staffId,
                        ma_khoa,
                        chuc_vu_id: chuc_vu_id || null,
                        tu_ngay: startDate,
                        den_ngay: endDate,
                        so_quyet_dinh: so_quyet_dinh || null,
                        ngay_quyet_dinh: decisionDate,
                        ghi_chu: ghi_chu || null,
                        isCurrent: false
                    }
                });
            } else {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "StaffWorkHistory" (id, "staffId", ma_khoa, chuc_vu_id, tu_ngay, den_ngay, so_quyet_dinh, ngay_quyet_dinh, ghi_chu, "isCurrent", "createdAt", "updatedAt") 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
                    newId, staffId, ma_khoa, chuc_vu_id || null, startDate, endDate, so_quyet_dinh || null, decisionDate, ghi_chu || null, false
                );
            }

            return NextResponse.json({ success: true, message: 'Thêm mốc lịch sử thành công' });
        }
    } catch (error: any) {
        console.error('Error creating staff work history:', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}

// 3. PUT: Chỉnh sửa thông tin mốc lịch sử
export async function PUT(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { 
            id, 
            ma_khoa, 
            chuc_vu_id, 
            tu_ngay, 
            den_ngay, 
            so_quyet_dinh, 
            ngay_quyet_dinh, 
            ghi_chu, 
            isCurrent 
        } = body;

        if (!id) {
            return NextResponse.json({ error: 'Thiếu ID mốc lịch sử' }, { status: 400 });
        }

        // Lấy thông tin mốc hiện tại
        let existing: any = null;
        if ((prisma as any).staffWorkHistory?.findUnique) {
            existing = await (prisma as any).staffWorkHistory.findUnique({ where: { id } });
        } else {
            const list: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "StaffWorkHistory" WHERE id = $1`, id);
            existing = list?.[0];
        }

        if (!existing) {
            return NextResponse.json({ error: 'Không tìm thấy mốc lịch sử' }, { status: 404 });
        }

        const startDate = tu_ngay ? new Date(tu_ngay) : new Date(existing.tu_ngay);
        const endDate = den_ngay ? new Date(den_ngay) : (isCurrent ? null : (existing.den_ngay ? new Date(existing.den_ngay) : null));
        const decisionDate = ngay_quyet_dinh ? new Date(ngay_quyet_dinh) : (existing.ngay_quyet_dinh ? new Date(existing.ngay_quyet_dinh) : null);

        if (isCurrent && !existing.isCurrent) {
            // Chuyển mốc này thành mốc hiện tại -> Chốt các mốc khác
            await prisma.$executeRawUnsafe(
                `UPDATE "StaffWorkHistory" SET "isCurrent" = false, den_ngay = $1 WHERE "staffId" = $2 AND id <> $3`,
                startDate, existing.staffId, id
            );

            // Cập nhật Staff và User
            await prisma.staff.update({
                where: { id: existing.staffId },
                data: { ma_khoa: ma_khoa || existing.ma_khoa }
            });
            await prisma.user.updateMany({
                where: { staffId: existing.staffId },
                data: { ma_khoa: ma_khoa || existing.ma_khoa }
            });
        }

        await prisma.$executeRawUnsafe(`
            UPDATE "StaffWorkHistory" 
            SET ma_khoa = $1, chuc_vu_id = $2, tu_ngay = $3, den_ngay = $4, so_quyet_dinh = $5, ngay_quyet_dinh = $6, ghi_chu = $7, "isCurrent" = $8, "updatedAt" = NOW()
            WHERE id = $9
        `, ma_khoa || existing.ma_khoa, chuc_vu_id !== undefined ? chuc_vu_id : existing.chuc_vu_id, startDate, isCurrent ? null : endDate, so_quyet_dinh !== undefined ? so_quyet_dinh : existing.so_quyet_dinh, decisionDate, ghi_chu !== undefined ? ghi_chu : existing.ghi_chu, isCurrent !== undefined ? isCurrent : existing.isCurrent, id);

        return NextResponse.json({ success: true, message: 'Cập nhật thành công' });
    } catch (error: any) {
        console.error('Error updating staff work history:', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}

// 4. DELETE: Xóa mốc lịch sử
export async function DELETE(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Thiếu ID' }, { status: 400 });
        }

        const list: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "StaffWorkHistory" WHERE id = $1`, id);
        const existing = list?.[0];

        if (!existing) {
            return NextResponse.json({ error: 'Không tìm thấy mốc lịch sử' }, { status: 404 });
        }

        if (existing.isCurrent) {
            return NextResponse.json({ 
                error: 'Không thể xóa mốc khoa đang làm việc hiện tại. Vui lòng điều chuyển sang khoa khác trước khi xóa!' 
            }, { status: 400 });
        }

        await prisma.$executeRawUnsafe(`DELETE FROM "StaffWorkHistory" WHERE id = $1`, id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting staff work history:', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
