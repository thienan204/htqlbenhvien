import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';
import * as xlsx from 'xlsx';
import dayjs from 'dayjs';

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await request.json();
        const { fields = [] } = body;

        if (!Array.isArray(fields) || fields.length === 0) {
            return NextResponse.json({ error: 'Vui lòng chọn ít nhất một trường dữ liệu' }, { status: 400 });
        }

        // Lấy toàn bộ danh sách nhân sự kèm tất cả các danh mục liên quan
        const staffList = await prisma.staff.findMany({
            include: {
                department: true,
                trang_thai_ref: true,
                chuc_vu_ref: true,
                chuc_danh_ref: true,
                trinh_do_ref: true,
                vi_tri_ref: true,
                gioi_tinh_ref: true,
                dan_toc_ref: true,
                loai_hop_dong_ref: true,
                vi_tri_bhyt_ref: true,
                noi_sinh_ward: true,
                que_quan_ward: true,
                noi_o_ward: true,
                ma_ngach_ref: true,
                he_so_luong_ref: true,
                bac_luong_ref: true,
                phu_cap_tnvk_ref: true
            },
            orderBy: {
                ma_nv: 'asc'
            }
        });

        // Xây dựng danh sách cột: luôn có 'ma_nv' và 'ho_ten' ở đầu để tra cứu
        const columnKeys: string[] = ['ma_nv'];
        if (!fields.includes('ho_ten')) {
            columnKeys.push('ho_ten');
        }

        // Thêm các trường được người dùng chọn
        fields.forEach((f: string) => {
            if (!columnKeys.includes(f)) {
                columnKeys.push(f);
            }
        });

        const rows: any[][] = [];
        // Hàng tiêu đề Header
        rows.push(columnKeys);

        // Hàm đọc giá trị của từng field cho một cán bộ
        const getFieldValue = (staff: any, key: string): string => {
            switch (key) {
                case 'ma_nv':
                    return staff.ma_nv || '';
                case 'ho_ten':
                    return staff.ho_ten || '';
                case 'ma_khoa':
                    return staff.ma_khoa || '';
                case 'cccd':
                    return staff.cccd || '';
                case 'so_dien_thoai':
                    return staff.so_dien_thoai || '';
                case 'ngay_sinh':
                    return staff.ngay_sinh ? dayjs(staff.ngay_sinh).format('YYYY-MM-DD') : '';
                case 'dia_chi':
                    return staff.dia_chi || '';
                case 'ma_bhxh':
                    return staff.ma_bhxh || '';
                case 'gioi_tinh':
                    return staff.gioi_tinh_ref?.name || '';
                case 'dan_toc':
                    return staff.dan_toc_ref?.name || '';
                case 'chuc_danh':
                    return staff.chuc_danh_ref?.name || '';
                case 'chuc_vu':
                    return staff.chuc_vu_ref?.name || '';
                case 'vi_tri_bhyt':
                    return staff.vi_tri_bhyt_ref?.name || '';
                case 'trinh_do':
                    return staff.trinh_do_ref?.name || '';
                case 'vi_tri_viec_lam':
                    return staff.vi_tri_ref?.name || '';
                case 'loai_hop_dong':
                    return staff.loai_hop_dong_ref?.name || '';
                case 'ton_giao':
                    return staff.ton_giao_ref?.name || '';
                case 'noi_sinh_ward':
                    return staff.noi_sinh_ward?.name || staff.noi_sinh_thon || '';
                case 'que_quan_ward':
                    return staff.que_quan_ward?.name || staff.que_quan_thon || '';
                case 'noi_o_ward':
                    return staff.noi_o_ward?.name || staff.noi_o_thon || '';
                case 'so_qd_tuyen_dung':
                    return staff.so_qd_tuyen_dung || '';
                case 'ngay_tuyen_dung':
                    return staff.ngay_tuyen_dung ? dayjs(staff.ngay_tuyen_dung).format('YYYY-MM-DD') : '';
                case 'ma_ngach':
                    return staff.ma_ngach_ref?.name || '';
                case 'he_so_luong':
                    return staff.he_so_luong_ref?.name || '';
                case 'bac_luong':
                    return staff.bac_luong_ref?.name || '';
                case 'phu_cap_tnvk':
                    return staff.phu_cap_tnvk_ref?.name || '';
                case 'thoi_diem_nang_luong':
                    return staff.thoi_diem_nang_luong ? dayjs(staff.thoi_diem_nang_luong).format('YYYY-MM-DD') : '';
                case 'trang_thai':
                    return staff.trang_thai_ref?.name || 'Đang làm việc';
                case 'ngay_nghi_viec':
                    return (staff as any).ngay_nghi_viec ? dayjs((staff as any).ngay_nghi_viec).format('YYYY-MM-DD') : '';
                case 'so_qd_nghi_viec':
                    return staff.so_qd_nghi_viec || '';
                case 'ngay_qd_nghi_viec':
                    return staff.ngay_qd_nghi_viec ? dayjs(staff.ngay_qd_nghi_viec).format('YYYY-MM-DD') : '';
                case 'don_vi_chuyen_den':
                    return staff.don_vi_chuyen_den || '';
                case 'ly_do_nghi_viec':
                    return staff.ly_do_nghi_viec || '';
                default:
                    return staff[key] !== undefined && staff[key] !== null ? String(staff[key]) : '';
            }
        };

        // Đổ dữ liệu từng nhân sự
        for (const staff of staffList) {
            const row = columnKeys.map(key => getFieldValue(staff, key));
            rows.push(row);
        }

        const ws = xlsx.utils.aoa_to_sheet(rows);

        // Thiết lập độ rộng cột cho đẹp mắt
        const colWidths = columnKeys.map(k => {
            if (k === 'ma_nv') return { wch: 14 };
            if (k === 'ho_ten') return { wch: 25 };
            if (k.includes('ngay')) return { wch: 16 };
            if (k.includes('dia_chi') || k.includes('ly_do') || k.includes('don_vi')) return { wch: 30 };
            return { wch: 22 };
        });
        ws['!cols'] = colWidths;

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Update_Staff');

        const outBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(outBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="Danh_Sach_Nhan_Su_Cap_Nhat.xlsx"',
                'X-Staff-Count': staffList.length.toString()
            }
        });
    } catch (error: any) {
        console.error('Lỗi xuất file mẫu nhân sự kèm dữ liệu:', error);
        return NextResponse.json({ error: error.message || 'Lỗi khi tạo file mẫu' }, { status: 500 });
    }
}

