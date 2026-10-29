import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userData = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                telegram_id: true,
                isAvailable: true,
                autoAssignDisabled: true,
                focusReason: true,
                staffId: true,
                staff: {
                    select: {
                        id: true,
                        ho_ten: true,
                        so_dien_thoai: true,
                        dia_chi: true,
                        ma_nv: true,
                        cccd: true,
                        ngay_sinh: true,
                        gioi_tinh_id: true,
                        ma_khoa: true,
                        loai_hop_dong_id: true,
                        chuc_vu_id: true,
                        vi_tri_viec_lam_id: true,
                        chuc_danh_id: true,
                        trinh_do_id: true,
                    }
                }
            }
        });

        if (!userData) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        let avatar: string | null = null;
        try {
            const avatarRes: any = await prisma.$queryRawUnsafe('SELECT avatar FROM "User" WHERE id = $1', user.id);
            avatar = avatarRes?.[0]?.avatar || null;
        } catch (e) {
            console.warn('Lỗi đọc avatar:', e);
        }

        return NextResponse.json({ ...userData, avatar });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { 
            name, telegram_id, isAvailable, autoAssignDisabled, focusReason, avatar,
            ho_ten, so_dien_thoai, dia_chi,
            ma_nv, ngay_sinh, gioi_tinh_id, ma_khoa,
            loai_hop_dong_id, chuc_vu_id, vi_tri_viec_lam_id, chuc_danh_id, trinh_do_id
        } = body;

        const currentUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { staffId: true, role: true }
        });

        const updateData: any = { name, telegram_id };
        if (isAvailable !== undefined) {
            updateData.isAvailable = isAvailable;
        }
        if (autoAssignDisabled !== undefined) {
            updateData.autoAssignDisabled = autoAssignDisabled;
        }
        if (focusReason !== undefined) {
            updateData.focusReason = focusReason;
        }

        if (avatar !== undefined) {
            try {
                await prisma.$executeRawUnsafe('UPDATE "User" SET avatar = $1 WHERE id = $2', avatar, user.id);
            } catch (errAv) {
                console.error('Update avatar raw error:', errAv);
            }
        }

        const updatedUser = await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: user.id },
                data: updateData,
            });

            if (currentUser?.staffId) {
                await tx.staff.update({
                    where: { id: currentUser.staffId },
                    data: {
                        ho_ten: ho_ten !== undefined ? ho_ten : undefined,
                        so_dien_thoai: so_dien_thoai !== undefined ? so_dien_thoai : undefined,
                        dia_chi: dia_chi !== undefined ? dia_chi : undefined,
                        ma_nv: ma_nv !== undefined ? ma_nv : undefined,
                        ngay_sinh: ngay_sinh !== undefined && ngay_sinh !== null ? new Date(ngay_sinh) : (ngay_sinh === null ? null : undefined),
                        gioi_tinh_id: gioi_tinh_id !== undefined ? gioi_tinh_id : undefined,
                        ma_khoa: ma_khoa !== undefined ? ma_khoa : undefined,
                        loai_hop_dong_id: loai_hop_dong_id !== undefined ? loai_hop_dong_id : undefined,
                        chuc_vu_id: chuc_vu_id !== undefined ? chuc_vu_id : undefined,
                        vi_tri_viec_lam_id: vi_tri_viec_lam_id !== undefined ? vi_tri_viec_lam_id : undefined,
                        chuc_danh_id: chuc_danh_id !== undefined ? chuc_danh_id : undefined,
                        trinh_do_id: trinh_do_id !== undefined ? trinh_do_id : undefined,
                    }
                });
            }

            return tx.user.findUnique({
                where: { id: user.id },
                select: {
                    id: true,
                    username: true,
                    name: true,
                    role: true,
                    telegram_id: true,
                    isAvailable: true,
                    staff: {
                        select: {
                            ho_ten: true,
                            so_dien_thoai: true,
                            dia_chi: true,
                        }
                    }
                }
            });
        });

        return NextResponse.json({ message: 'Cập nhật thông tin thành công', user: { ...updatedUser, avatar } });
    } catch (error: any) {
        console.error('Update profile error:', error);
        return NextResponse.json({ error: 'Lỗi cập nhật hồ sơ' }, { status: 500 });
    }
}
