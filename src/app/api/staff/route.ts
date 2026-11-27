import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';
import { decryptStaffList, decryptStaff, prepareStaffForSave, DEFAULT_ENCRYPTED_FIELDS } from '@/lib/staffCrypto';
import { getSystemConfig } from '@/lib/systemConfig';
import { createDeleteSnapshot, parseDeleteIdsFromRequest, SnapshotLimitError } from '@/lib/deleteProtection';

export async function GET(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        const whereClause: any = {};

        // Các vai trò quản trị, TCCB hoặc hỗ trợ kỹ thuật toàn viện (ADMIN, PTCCB, TCCB, CNTT, VTYT, HCQT)
        // được phép xem danh sách nhân sự toàn viện.
        const isSupportOrAdmin = user?.role ? ['ADMIN', 'PTCCB', 'TCCB', 'CNTT', 'VTYT', 'HCQT'].includes(user.role) : false;

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
        const decryptedStaff = decryptStaffList(staff);
        return NextResponse.json(decryptedStaff);
    } catch (error) {
        console.error('Error fetching staff:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const activeFieldsStr = await getSystemConfig('STAFF_PII_ENCRYPTED_FIELDS', DEFAULT_ENCRYPTED_FIELDS.join(','));
        const activeFields = activeFieldsStr.split(',').map(s => s.trim()).filter(Boolean);

        // Handle Array of Staff (For Excel Import)
        if (Array.isArray(body)) {
            let successCount = 0;
            for (const item of body) {
                if (!item.ho_ten || !item.ma_nv || !item.ma_khoa) continue;

                const prepared = prepareStaffForSave({
                    ma_nv: item.ma_nv,
                    ho_ten: item.ho_ten,
                    so_dien_thoai: item.so_dien_thoai || null,
                    ma_khoa: item.ma_khoa
                }, activeFields);

                await prisma.staff.upsert({
                    where: { ma_nv: item.ma_nv },
                    update: prepared,
                    create: prepared
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
            ngay_nghi_viec, so_qd_nghi_viec, ngay_qd_nghi_viec, don_vi_chuyen_den, ly_do_nghi_viec,
            trainings
        } = body;

        let finalHoTen = ho_ten ? String(ho_ten).trim() : '';
        let finalMaNv = ma_nv ? String(ma_nv).trim() : '';
        let finalMaKhoa = ma_khoa ? String(ma_khoa).trim() : '';

        if (id) {
            // Kiểm tra xem nhân sự có tồn tại không
            const existingStaff = await prisma.staff.findUnique({
                where: { id },
                select: { id: true, ma_khoa: true, chuc_vu_id: true, ho_ten: true, ma_nv: true }
            });

            if (existingStaff) {
                if (!finalHoTen) finalHoTen = existingStaff.ho_ten;
                if (!finalMaNv) finalMaNv = existingStaff.ma_nv;
                if (!finalMaKhoa) finalMaKhoa = existingStaff.ma_khoa;
            }

            if (!finalHoTen || !finalMaNv || !finalMaKhoa) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
            }

            // Update existing
            const updatePayload = prepareStaffForSave({
                ho_ten: finalHoTen,
                ma_nv: finalMaNv,
                so_dien_thoai: so_dien_thoai !== undefined ? (so_dien_thoai || null) : undefined,
                dia_chi: dia_chi !== undefined ? (dia_chi || null) : undefined,
                ma_khoa: finalMaKhoa,
                trinh_do_id, chuc_danh_id, cccd, gioi_tinh_id,
                vi_tri_viec_lam_id, chuc_vu_id, loai_hop_dong_id, ngay_sinh,
                ma_bhxh, dan_toc_id, ma_chuc_danh_bhyt, ma_vi_tri_bhyt, vi_tri_bhyt_id, trang_thai_id,
                ma_ho_gia_dinh, ngay_cap_cccd, noi_cap_cccd,
                noi_sinh_ward_id, noi_sinh_thon,
                que_quan_ward_id, que_quan_thon,
                noi_o_ward_id, noi_o_thon,
                so_qd_tuyen_dung, ngay_tuyen_dung, thoi_diem_nang_luong,
                ma_ngach_id, he_so_luong_id, bac_luong_id, phu_cap_tnvk_id,
                ngay_nghi_viec: ngay_nghi_viec ? new Date(ngay_nghi_viec) : null,
                so_qd_nghi_viec: so_qd_nghi_viec || null,
                ngay_qd_nghi_viec: ngay_qd_nghi_viec ? new Date(ngay_qd_nghi_viec) : null,
                don_vi_chuyen_den: don_vi_chuyen_den || null,
                ly_do_nghi_viec: ly_do_nghi_viec || null,
                ...(Array.isArray(trainings) ? {
                    trainings: {
                        deleteMany: {},
                        create: trainings
                    }
                } : {})
            }, activeFields);

            const updated = await prisma.staff.update({
                where: { id },
                data: updatePayload
            });

            // Nếu mã khoa thay đổi, tự động ghi nhận lịch sử công tác và sync User
            if (existingStaff && existingStaff.ma_khoa !== finalMaKhoa) {
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
                            ma_khoa: finalMaKhoa,
                            chuc_vu_id: chuc_vu_id || existingStaff.chuc_vu_id || null,
                            tu_ngay: new Date(),
                            isCurrent: true,
                            ghi_chu: 'Điều chuyển từ Quản lý nhân sự'
                        }
                    });

                    // Đồng bộ sang bảng User
                    await prisma.user.updateMany({
                        where: { staffId: id },
                        data: { ma_khoa: finalMaKhoa }
                    });
                } catch (errHist) {
                    console.error('Lỗi tự động lưu lịch sử chuyển khoa:', errHist);
                }
            }

            return NextResponse.json(decryptStaff(updated));
        } else {
            if (!finalHoTen || !finalMaNv || !finalMaKhoa) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
            }

            // Create new
            const createPayload = prepareStaffForSave({
                ho_ten: finalHoTen, ma_nv: finalMaNv, so_dien_thoai, dia_chi, ma_khoa: finalMaKhoa,
                trinh_do_id, chuc_danh_id, cccd, gioi_tinh_id,
                vi_tri_viec_lam_id, chuc_vu_id, loai_hop_dong_id, ngay_sinh,
                ma_bhxh, dan_toc_id, ma_chuc_danh_bhyt, ma_vi_tri_bhyt, vi_tri_bhyt_id, trang_thai_id,
                ma_ho_gia_dinh, ngay_cap_cccd, noi_cap_cccd,
                noi_sinh_ward_id, noi_sinh_thon,
                que_quan_ward_id, que_quan_thon,
                noi_o_ward_id, noi_o_thon,
                so_qd_tuyen_dung, ngay_tuyen_dung, thoi_diem_nang_luong,
                ma_ngach_id, he_so_luong_id, bac_luong_id, phu_cap_tnvk_id,
                ngay_nghi_viec: ngay_nghi_viec ? new Date(ngay_nghi_viec) : null,
                so_qd_nghi_viec: so_qd_nghi_viec || null,
                ngay_qd_nghi_viec: ngay_qd_nghi_viec ? new Date(ngay_qd_nghi_viec) : null,
                don_vi_chuyen_den: don_vi_chuyen_den || null,
                ly_do_nghi_viec: ly_do_nghi_viec || null,
                trainings: {
                    create: trainings || []
                }
            }, activeFields);

            const created = await prisma.staff.create({
                data: createPayload
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

            return NextResponse.json(decryptStaff(created));
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
    let isDeleteAllRequest = false;
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Vui lòng đăng nhập để thực hiện thao tác xóa.' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const ids = await parseDeleteIdsFromRequest(request);
        const confirmDeleteAll = searchParams.get('confirmDeleteAll');

        if (ids.length > 0) {
            if (!['ADMIN', 'PTCCB', 'TCCB', 'CNTT'].includes(user.role)) {
                return NextResponse.json({ error: 'Bạn không có quyền xóa danh sách nhân sự.' }, { status: 403 });
            }

            const result = await prisma.$transaction(
                async (tx) => {
                    const [staffRows, certRows, trainings, workHistories] = await Promise.all([
                        tx.staff.findMany({ where: { id: { in: ids } } }),
                        tx.practicingCertificate.findMany({ where: { staffId: { in: ids } } }),
                        tx.staffTraining.findMany({ where: { staffId: { in: ids } } }),
                        tx.staffWorkHistory.findMany({ where: { staffId: { in: ids } } }),
                    ]);

                    const certIds = certRows.map((c) => c.id);
                    const cchnScopes =
                        certIds.length > 0
                            ? await tx.cCHNScopeMapping.findMany({ where: { cchn_id: { in: certIds } } })
                            : [];

                    const snap = await createDeleteSnapshot({
                        tx,
                        tableName: 'Staff',
                        displayName: `Nhân sự đã chọn (${staffRows.length} người)`,
                        actionType: 'BULK_DELETE',
                        filterSummary: `${ids.length} nhân sự được chọn`,
                        recordsCount: staffRows.length + certRows.length,
                        data: {
                            staff: staffRows,
                            certificates: certRows,
                            cchnScopeMappings: cchnScopes,
                            trainings,
                            workHistories,
                        },
                        user,
                    });

                    await tx.practicingCertificate.deleteMany({ where: { staffId: { in: ids } } });
                    const deleted = await tx.staff.deleteMany({ where: { id: { in: ids } } });
                    return { count: deleted.count, snapshotId: snap.snapshotId };
                },
                { timeout: 30000 }
            );

            return NextResponse.json({
                success: true,
                deletedCount: result.count,
                count: result.count,
                snapshotId: result.snapshotId,
            });
        }

        if (!id) {
            isDeleteAllRequest = true;
            if (user.role !== 'ADMIN') {
                return NextResponse.json({ error: 'Chỉ ADMIN mới có quyền xóa toàn bộ danh sách nhân sự.' }, { status: 403 });
            }
            if (confirmDeleteAll !== 'true') {
                return NextResponse.json(
                    { error: 'Thiếu xác nhận confirmDeleteAll=true. Đã chặn thao tác xóa toàn bộ để bảo vệ dữ liệu CCHN & nhân sự.' },
                    { status: 400 }
                );
            }

            // Bọc trong transaction: tự động chụp Snapshot JSON trước khi xóa, nếu Staff bị chặn xóa
            // bởi khóa ngoại (chấm công, nghỉ phép...) thì toàn bộ giao dịch rollback (kể cả snapshot).
            const result = await prisma.$transaction(async (tx) => {
                const [staffRows, certRows, cchnScopes, trainings, workHistories] = await Promise.all([
                    tx.staff.findMany(),
                    tx.practicingCertificate.findMany(),
                    tx.cCHNScopeMapping.findMany(),
                    tx.staffTraining.findMany(),
                    tx.staffWorkHistory.findMany(),
                ]);

                const snap = await createDeleteSnapshot({
                    tx,
                    tableName: 'Staff',
                    displayName: 'Toàn bộ Danh sách Nhân sự & CCHN',
                    actionType: 'DELETE_ALL',
                    filterSummary: 'Toàn bệnh viện',
                    recordsCount: staffRows.length + certRows.length,
                    data: {
                        staff: staffRows,
                        certificates: certRows,
                        cchnScopeMappings: cchnScopes,
                        trainings,
                        workHistories,
                    },
                    user,
                });

                await tx.practicingCertificate.deleteMany();
                const deleted = await tx.staff.deleteMany();
                return { count: deleted.count, snapshotId: snap.snapshotId };
            }, { timeout: 30000 });

            return NextResponse.json({ success: true, count: result.count, snapshotId: result.snapshotId });
        }

        if (!['ADMIN', 'PTCCB', 'TCCB', 'CNTT'].includes(user.role)) {
            return NextResponse.json({ error: 'Bạn không có quyền xóa nhân sự.' }, { status: 403 });
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
        if (error instanceof SnapshotLimitError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        const errStr = String(error?.message || '');
        if (error?.code === 'P2003' || errStr.includes('foreign key constraint') || errStr.includes('23001')) {
            return NextResponse.json({
                error: isDeleteAllRequest
                    ? 'Không thể xóa toàn bộ nhân sự vì đang có dữ liệu liên kết (chấm công, nghỉ phép, yêu cầu...). Toàn bộ dữ liệu nhân sự và CCHN đã được giữ nguyên.'
                    : 'Không thể xóa vì Nhân sự này đang được dùng bởi dữ liệu khác!'
            }, { status: 400 });
        }
        return NextResponse.json({ error: 'Lỗi khi xóa: ' + (error?.message || 'Unknown error') }, { status: 500 });
    }
}
