import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

export async function GET(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        const whereClause: any = {};
        
        // Các vai trò quản trị hoặc hỗ trợ kỹ thuật toàn viện (ADMIN, CNTT, VTYT, HCQT)
        // được phép xem danh sách nhân sự toàn viện để tiếp nhận & nhập sự cố thay khoa phòng.
        const isSupportOrAdmin = ['ADMIN', 'CNTT', 'VTYT', 'HCQT'].includes(user?.role);

        if (user && !isSupportOrAdmin) {
            if (user.role === 'KHOA_PHONG' && user.staffId) {
                whereClause.id = user.staffId;
            } else if (user.ma_khoa) {
                whereClause.ma_khoa = user.ma_khoa;
            }
        }

        const staff = await prisma.staff.findMany({
            where: whereClause,
            include: {
                department: true,
                chuc_danh_ref: true,
                trinh_do_ref: true,
                chuc_vu_ref: true,
                dan_toc_ref: true,
                vi_tri_bhyt_ref: true,
                trang_thai_ref: true,
                certificates: { select: { so_cchn: true, isActive: true } },
                trainings: true
            },
            orderBy: {
                ma_nv: 'asc'
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
                if (!item.ho_ten || !item.ma_nv || !item.ma_khoa) continue;

                await prisma.staff.upsert({
                    where: { ma_nv: item.ma_nv },
                    update: {
                        ho_ten: item.ho_ten,
                        so_dien_thoai: item.so_dien_thoai || null,
                        ma_khoa: item.ma_khoa
                    },
                    create: {
                        ma_nv: item.ma_nv,
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
        const { 
            id, ho_ten, ma_nv, so_dien_thoai, dia_chi, ma_khoa, 
            trinh_do_id, chuc_danh_id, cccd, gioi_tinh_id, 
            vi_tri_viec_lam_id, chuc_vu_id, loai_hop_dong_id, ngay_sinh,
            ma_bhxh, dan_toc_id, ma_chuc_danh_bhyt, ma_vi_tri_bhyt, vi_tri_bhyt_id, trang_thai_id,
            ma_ho_gia_dinh, ngay_cap_cccd, noi_cap_cccd,
            noi_sinh_ward_id, noi_sinh_thon,
            que_quan_ward_id, que_quan_thon,
            noi_o_ward_id, noi_o_thon,
            so_qd_tuyen_dung, ngay_tuyen_dung, thoi_diem_nang_luong,
            ma_ngach_id, he_so_luong_id, bac_luong_id, phu_cap_tnvk_id,
            trainings
        } = body;

        if (!ho_ten || !ma_nv || !ma_khoa) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (id) {
            // Kiểm tra xem khoa phòng có thay đổi không
            const existingStaff = await prisma.staff.findUnique({
                where: { id },
                select: { ma_khoa: true, chuc_vu_id: true }
            });

            // Update existing
            const updated = await prisma.staff.update({
                where: { id },
                data: { 
                    ho_ten, ma_nv, so_dien_thoai, dia_chi, ma_khoa, 
                    trinh_do_id, chuc_danh_id, cccd, gioi_tinh_id, 
                    vi_tri_viec_lam_id, chuc_vu_id, loai_hop_dong_id, ngay_sinh,
                    ma_bhxh, dan_toc_id, ma_chuc_danh_bhyt, ma_vi_tri_bhyt, vi_tri_bhyt_id, trang_thai_id,
                    ma_ho_gia_dinh, ngay_cap_cccd, noi_cap_cccd,
                    noi_sinh_ward_id, noi_sinh_thon,
                    que_quan_ward_id, que_quan_thon,
                    noi_o_ward_id, noi_o_thon,
                    so_qd_tuyen_dung, ngay_tuyen_dung, thoi_diem_nang_luong,
                    ma_ngach_id, he_so_luong_id, bac_luong_id, phu_cap_tnvk_id,
                    trainings: {
                        deleteMany: {},
                        create: trainings || []
                    }
                }
            });

            // Nếu mã khoa thay đổi, tự động ghi nhận lịch sử công tác và sync User
            if (existingStaff && existingStaff.ma_khoa !== ma_khoa) {
                try {
                    // Chốt mốc hiện tại cũ
                    await prisma.staffWorkHistory.updateMany({
                        where: { staffId: id, isCurrent: true },
                        data: { isCurrent: false, den_ngay: new Date() }
                    });

                    // Tạo mốc mới
                    await prisma.staffWorkHistory.create({
                        data: {
                            staffId: id,
                            ma_khoa,
                            chuc_vu_id: chuc_vu_id || existingStaff.chuc_vu_id || null,
                            tu_ngay: new Date(),
                            isCurrent: true,
                            ghi_chu: 'Điều chuyển từ Quản lý nhân sự'
                        }
                    });

                    // Đồng bộ sang bảng User
                    await prisma.user.updateMany({
                        where: { staffId: id },
                        data: { ma_khoa }
                    });
                } catch (errHist) {
                    console.error('Lỗi tự động lưu lịch sử chuyển khoa:', errHist);
                }
            }

            return NextResponse.json(updated);
        } else {
            // Create new
            const created = await prisma.staff.create({
                data: { 
                    ho_ten, ma_nv, so_dien_thoai, dia_chi, ma_khoa, 
                    trinh_do_id, chuc_danh_id, cccd, gioi_tinh_id, 
                    vi_tri_viec_lam_id, chuc_vu_id, loai_hop_dong_id, ngay_sinh,
                    ma_bhxh, dan_toc_id, ma_chuc_danh_bhyt, ma_vi_tri_bhyt, vi_tri_bhyt_id, trang_thai_id,
                    ma_ho_gia_dinh, ngay_cap_cccd, noi_cap_cccd,
                    noi_sinh_ward_id, noi_sinh_thon,
                    que_quan_ward_id, que_quan_thon,
                    noi_o_ward_id, noi_o_thon,
                    so_qd_tuyen_dung, ngay_tuyen_dung, thoi_diem_nang_luong,
                    ma_ngach_id, he_so_luong_id, bac_luong_id, phu_cap_tnvk_id,
                    trainings: {
                        create: trainings || []
                    }
                }
            });

            // Tự động tạo mốc lịch sử ban đầu cho nhân sự mới
            try {
                await prisma.staffWorkHistory.create({
                    data: {
                        staffId: created.id,
                        ma_khoa,
                        chuc_vu_id: chuc_vu_id || null,
                        tu_ngay: ngay_tuyen_dung ? new Date(ngay_tuyen_dung) : new Date(),
                        isCurrent: true,
                        ghi_chu: 'Tiếp nhận công tác ban đầu'
                    }
                });
            } catch (errNewHist) {
                console.error('Lỗi tạo lịch sử cho nhân sự mới:', errNewHist);
            }

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
                await prisma.staff.deleteMany({
                    where: { id: { in: ids } }
                });
            }
            return NextResponse.json({ success: true, deletedCount: ids.length });
        }

        if (!id && !idsParam) {
            // Delete ALL staff
            // First delete dependent tables like PracticingCertificate
            await prisma.practicingCertificate.deleteMany();
            
            // Delete all staff
            const deleted = await prisma.staff.deleteMany();
            return NextResponse.json({ success: true, count: deleted.count });
        }

        if (!id) {
            return NextResponse.json({ error: 'Missing staff ID or IDs' }, { status: 400 });
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
