import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const searchParams = new URL(req.url).searchParams;
        const maTheBHYT = searchParams.get('maTheBHYT');
        const limitParam = searchParams.get('limit');
        
        const limit = limitParam ? parseInt(limitParam) : 10;

        if (!maTheBHYT) {
            return NextResponse.json(
                { success: false, error: 'Thiếu tham số maTheBHYT' },
                { status: 400 }
            );
        }

        // Truy vấn dữ liệu từ Xml1, giới hạn số lượng và sắp xếp theo ngày vào giảm dần
        const records = await (prisma as any).xml1.findMany({
            where: {
                MA_THE_BHYT: {
                    contains: maTheBHYT
                }
            },
            orderBy: {
                NGAY_VAO: 'desc'
            },
            take: limit,
            include: {
                xml14Records: true
            }
        });

        // Ánh xạ dữ liệu để trả về 4 trường rút gọn
        const formattedData = records.map((record: any) => {
            // Lấy thông tin giấy hẹn khám lại từ bản ghi Xml14 đầu tiên (nếu có)
            let soGiayHenKhamLai = null;
            if (record.xml14Records && record.xml14Records.length > 0) {
                soGiayHenKhamLai = record.xml14Records[0].SO_GIAYHEN_KL;
            }

            return {
                maBn: record.MA_BN,
                ngayVao: record.NGAY_VAO,
                ngayRa: record.NGAY_RA,
                soGiayHenKhamLai: soGiayHenKhamLai
            };
        });

        return NextResponse.json({
            success: true,
            data: formattedData
        });

    } catch (error: any) {
        console.error('Error fetching patient history:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server khi lấy lịch sử khám bệnh' },
            { status: 500 }
        );
    }
}
