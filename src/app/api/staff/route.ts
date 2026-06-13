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
                await prisma.staff.deleteMany({
                    where: { id: { in: ids } }
                });
            }
            return NextResponse.json({ success: true, deletedCount: ids.length });
        }

        if (!id) {
            return NextResponse.json({ error: 'Missing staff ID or IDs' }, { status: 400 });
        }

        await prisma.staff.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting staff:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
