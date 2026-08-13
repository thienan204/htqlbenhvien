import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userHIS, ma_giuong, tu_ngay, den_ngay, ma_lk_hien_tai, ma_nhom } = body;

        // 1. Validate Input
        if (!userHIS || !ma_giuong || !tu_ngay || !den_ngay) {
            return NextResponse.json({ 
                error: 'Thiếu các tham số bắt buộc: userHIS, ma_giuong, tu_ngay, den_ngay' 
            }, { status: 400 });
        }

        // 2. Tìm mã khoa (ma_khoa) từ userHIS
        const user = await prisma.user.findUnique({
            where: { userHIS },
            include: { staff: true }
        });

        if (!user || !user.staff || !user.staff.ma_khoa) {
            return NextResponse.json({ 
                error: 'Không tìm thấy thông tin khoa của bác sĩ tương ứng với userHIS này' 
            }, { status: 404 });
        }

        const ma_khoa = user.staff.ma_khoa;

        // 3. Xây dựng điều kiện truy vấn kiểm tra trùng lặp thời gian
        const overlapCondition: any = {
            MA_KHOA: ma_khoa,
            MA_GIUONG: ma_giuong,
            MA_NHOM: ma_nhom || '15', // Nhận ma_nhom từ Client, mặc định là 15 (Tiền giường)
            NGAY_TH_YL: { lte: den_ngay }, // Ngày bắt đầu của giường cũ <= Ngày kết thúc của form
            NGAY_KQ: { gte: tu_ngay }      // Ngày kết thúc của giường cũ >= Ngày bắt đầu của form
        };

        // Nếu có truyền lên mã liên kết hiện tại, bỏ qua mã đó (tránh tự báo trùng với chính mình)
        if (ma_lk_hien_tai) {
            overlapCondition.MA_LK = { not: ma_lk_hien_tai };
        }

        // 4. Thực thi truy vấn vào bảng Xml3
        const overlappedBeds = await prisma.xml3.findMany({
            where: overlapCondition,
            include: {
                xml1: {
                    select: {
                        MA_BN: true,
                        HO_TEN: true
                    }
                }
            }
        });

        // 5. Trả kết quả
        if (overlappedBeds.length > 0) {
            // Nhặt thông tin trả về
            const overlapDetails = overlappedBeds.map(bed => ({
                ma_lk: bed.MA_LK,
                ma_bn: bed.xml1?.MA_BN || 'N/A',
                ho_ten: bed.xml1?.HO_TEN || 'Chưa cập nhật',
                tu_ngay: bed.NGAY_TH_YL,
                den_ngay: bed.NGAY_KQ,
                ten_dich_vu: bed.TEN_DICH_VU
            }));

            return NextResponse.json({
                isOverlapped: true,
                message: `Giường ${ma_giuong} (Khoa ${ma_khoa}) đã có bệnh nhân nằm trong khoảng thời gian này!`,
                overlapDetails
            });
        }

        // Nếu không có trùng lặp
        return NextResponse.json({
            isOverlapped: false,
            message: "Giường hợp lệ, không bị trùng."
        });

    } catch (error) {
        console.error('Lỗi khi kiểm tra trùng giường:', error);
        return NextResponse.json({ error: 'Lỗi hệ thống Server (Internal Server Error)' }, { status: 500 });
    }
}
