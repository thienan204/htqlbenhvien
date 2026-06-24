import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const staff = await prisma.staff.findMany({
            include: {
                department: true,
                chuc_danh_ref: true,
                trinh_do_ref: true,
                chuc_vu_ref: true
            },
            orderBy: {
                ma_bac_si: 'asc'
            }
        });
        return NextResponse.json(staff);
    } catch (error) {
        console.error('Error fetching staff:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Handle Array of Staff (For Excel Import)
        if (Array.isArray(body)) {
            let successCount = 0;
            for (const item of body) {
                if (!item.ho_ten || !item.ma_bac_si || !item.ma_khoa) continue;

                await prisma.staff.upsert({
                    where: { ma_bac_si: item.ma_bac_si },
                    update: {
                        ho_ten: item.ho_ten,
                        so_dien_thoai: item.so_dien_thoai || null,
                        ma_khoa: item.ma_khoa
                    },
                    create: {
                        ma_bac_si: item.ma_bac_si,
                        ho_ten: item.ho_ten,
                        so_dien_thoai: item.so_dien_thoai || null,
                        ma_khoa: item.ma_khoa
                    }
                });
                successCount++;
            }
            return NextResponse.json({ success: true, count: successCount });
        }

        // Handle Single Object (For Form Add/Update)
        const { id, ho_ten, ma_bac_si, so_dien_thoai, dia_chi, ma_khoa, trinh_do_id, chuc_danh_id } = body;

        if (!ho_ten || !ma_bac_si || !ma_khoa) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (id) {
            // Update existing
            const updated = await prisma.staff.update({
                where: { id },
                data: { ho_ten, ma_bac_si, so_dien_thoai, dia_chi, ma_khoa, trinh_do_id, chuc_danh_id }
            });
            return NextResponse.json(updated);
        } else {
            // Create new
            const created = await prisma.staff.create({
                data: { ho_ten, ma_bac_si, so_dien_thoai, dia_chi, ma_khoa, trinh_do_id, chuc_danh_id }
            });
            return NextResponse.json(created);
        }

    } catch (error: any) {
        console.error('Error saving staff:', error);
        if (error?.code === 'P2002' || String(error?.message || '').includes('Unique constraint failed')) {
            return NextResponse.json({ error: 'Mã nhân viên (Mã Bác sĩ) này đã tồn tại trong hệ thống. Vui lòng nhập mã khác!' }, { status: 400 });
        }
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const idsParam = searchParams.get('ids');

        if (idsParam) {
            // Bulk delete
            const ids = idsParam.split(',').filter(Boolean);
            if (ids.length > 0) {
                const userCount = await prisma.user.count({ where: { staffId: { in: ids } } });
                const warehouseCount = await prisma.warehouse.count({ where: { storekeeper_id: { in: ids } } });

                if (userCount > 0 || warehouseCount > 0) {
                    return NextResponse.json({ 
                        error: `Không thể xóa hàng loạt vì có Nhân sự đang liên kết với Tài khoản hoặc Kho vật tư.` 
                    }, { status: 400 });
                }

                await prisma.staff.deleteMany({
                    where: { id: { in: ids } }
                });
            }
            return NextResponse.json({ success: true, deletedCount: ids.length });
        }

        if (!id) {
            return NextResponse.json({ error: 'Missing staff ID or IDs' }, { status: 400 });
        }

        const userCount = await prisma.user.count({ where: { staffId: id } });
        const warehouseCount = await prisma.warehouse.count({ where: { storekeeper_id: id } });

        if (userCount > 0 || warehouseCount > 0) {
            let msgParts = [];
            if (userCount > 0) msgParts.push(`${userCount} Tài khoản`);
            if (warehouseCount > 0) msgParts.push(`${warehouseCount} Kho vật tư`);
            return NextResponse.json({ 
                error: `Không thể xóa vì Nhân sự này đang liên kết với ${msgParts.join(' và ')}. Vui lòng hủy liên kết trước.` 
            }, { status: 400 });
        }

        await prisma.staff.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting staff:', error);
        const errStr = String(error?.message || '');
        if (error?.code === 'P2003' || errStr.includes('foreign key constraint') || errStr.includes('23001')) {
            return NextResponse.json({ error: 'Không thể xóa vì Nhân sự này đang được dùng bởi dữ liệu khác!' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Lỗi khi xóa: ' + (error?.message || 'Unknown error') }, { status: 500 });
    }
}
