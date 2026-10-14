import { NextRequest, NextResponse } from 'next/server';
import * as xlsx from 'xlsx';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { summary, xml1Diff = [], xml2Diff = [], xml3Diff = [] } = body;

        if (!summary) {
            return NextResponse.json({ error: 'Thiếu dữ liệu so sánh' }, { status: 400 });
        }

        const wb = xlsx.utils.book_new();

        // 1. Sheet Tổng quan & XML1
        const tongQuanRows: any[] = [
            ['BÁO CÁO ĐỐI CHIẾU THAY ĐỔI DỮ LIỆU BỆNH ÁN (TRƯỚC & SAU SỬA TRÊN HIS)'],
            ['Mã Liên kết:', summary.maLk, 'Mã Bệnh nhân:', summary.maBn],
            ['Họ và tên:', summary.hoTen, 'Khoa điều trị:', summary.editDept || ''],
            ['Ngày ĐNTT Cổng BHYT:', summary.ngayDeNghiTT || 'Chưa rõ', 'Lý do xin sửa:', summary.editReason || ''],
            ['Người lưu bản trước sửa:', summary.preEditSavedBy || '', 'Thời gian lưu:', summary.preEditSavedAt ? new Date(summary.preEditSavedAt).toLocaleString('vi-VN') : ''],
            [],
            ['BẢNG TỔNG HỢP BIẾN ĐỘNG CHI PHÍ'],
            ['Khoản mục', 'Bản trước sửa (VNĐ)', 'Bản sau sửa (VNĐ)', 'Chênh lệch (+/- VNĐ)'],
            ['Tổng chi phí KCB', summary.preTongChi, summary.postTongChi, summary.diffTongChi],
            ['Bảo hiểm y tế thanh toán (BHTT)', summary.preBhtt, summary.postBhtt, summary.diffBhtt],
            ['Bệnh nhân thanh toán (BNTT)', summary.preBntt, summary.postBntt, summary.diffBntt],
            ['Bệnh nhân cùng chi trả (BNCCT)', summary.preBncct, summary.postBncct, summary.diffBncct],
            [],
            ['CHI TIẾT THAY ĐỔI THÔNG TIN HÀNH CHÍNH & CHẨN ĐOÁN (XML1)'],
            ['Chỉ số / Trường thông tin', 'Giá trị Bản trước sửa', 'Giá trị Bản sau sửa', 'Trạng thái thay đổi']
        ];

        xml1Diff.forEach((item: any) => {
            tongQuanRows.push([
                item.label,
                item.preValue,
                item.postValue,
                item.isChanged ? 'CÓ THAY ĐỔI' : 'Không đổi'
            ]);
        });

        const wsTongQuan = xlsx.utils.aoa_to_sheet(tongQuanRows);
        xlsx.utils.book_append_sheet(wb, wsTongQuan, 'Tổng quan & XML1');

        // 2. Sheet Thuốc (XML2)
        const thuocRows: any[] = [
            ['CHI TIẾT BIẾN ĐỘNG THUỐC (XML2)'],
            ['Trạng thái', 'Mã thuốc', 'Tên thuốc', 'Đơn vị tính', 'Đơn giá', 'SL Trước sửa', 'SL Sau sửa', 'Chênh lệch SL', 'Tiền Trước sửa', 'Tiền Sau sửa', 'Chênh lệch Tiền', 'Ngày Y lệnh']
        ];

        xml2Diff.forEach((item: any) => {
            let statusText = 'Không đổi';
            if (item.type === 'ADDED') statusText = 'THÊM MỚI';
            else if (item.type === 'REMOVED') statusText = 'BỊ XÓA BỎ';
            else if (item.type === 'MODIFIED') statusText = 'ĐÃ SỬA ĐỔI';

            thuocRows.push([
                statusText,
                item.maThuoc,
                item.tenThuoc,
                item.donViTinh || '',
                item.donGia,
                item.preSoLuong,
                item.postSoLuong,
                item.diffSoLuong,
                item.preThanhTien,
                item.postThanhTien,
                item.diffThanhTien,
                item.ngayYl || ''
            ]);
        });

        const wsThuoc = xlsx.utils.aoa_to_sheet(thuocRows);
        xlsx.utils.book_append_sheet(wb, wsThuoc, 'Biến động Thuốc (XML2)');

        // 3. Sheet DVKT & Vật tư (XML3)
        const dvktRows: any[] = [
            ['CHI TIẾT BIẾN ĐỘNG DỊCH VỤ KỸ THUẬT & VẬT TƯ (XML3)'],
            ['Trạng thái', 'Mã DV/VT', 'Tên dịch vụ / Vật tư', 'Khoa chỉ định', 'Đơn giá', 'SL Trước sửa', 'SL Sau sửa', 'Chênh lệch SL', 'Tiền Trước sửa', 'Tiền Sau sửa', 'Chênh lệch Tiền', 'Ngày Y lệnh']
        ];

        xml3Diff.forEach((item: any) => {
            let statusText = 'Không đổi';
            if (item.type === 'ADDED') statusText = 'THÊM MỚI';
            else if (item.type === 'REMOVED') statusText = 'BỊ XÓA BỎ';
            else if (item.type === 'MODIFIED') statusText = 'ĐÃ SỬA ĐỔI';

            dvktRows.push([
                statusText,
                item.maDichVu,
                item.tenDichVu,
                item.maKhoa || '',
                item.donGia,
                item.preSoLuong,
                item.postSoLuong,
                item.diffSoLuong,
                item.preThanhTien,
                item.postThanhTien,
                item.diffThanhTien,
                item.ngayYl || ''
            ]);
        });

        const wsDvkt = xlsx.utils.aoa_to_sheet(dvktRows);
        xlsx.utils.book_append_sheet(wb, wsDvkt, 'Biến động DVKT (XML3)');

        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(buf, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="BienBan_DoiChieu_SuaBA_${summary.maLk}.xlsx"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        });

    } catch (error: any) {
        console.error('Lỗi export-diff-excel:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
