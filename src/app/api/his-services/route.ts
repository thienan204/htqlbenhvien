import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userHIS = searchParams.get('userHIS');

        if (!userHIS) {
            return NextResponse.json({ error: 'Thiếu tham số userHIS' }, { status: 400 });
        }

        // Bước 1: Tìm User -> Staff -> PracticingCertificate
        const user = await prisma.user.findUnique({
            where: { userHIS },
            include: {
                staff: {
                    include: {
                        certificates: {
                            where: { isActive: true },
                            orderBy: { createdAt: 'desc' }
                        }
                    }
                }
            }
        });

        if (!user || !user.staff) {
            return NextResponse.json({ error: 'Không tìm thấy nhân viên ứng với userHIS này' }, { status: 404 });
        }

        const certificates = user.staff.certificates || [];
        const cchnList = certificates.map(c => c.so_cchn);

        if (cchnList.length === 0) {
            return NextResponse.json({ 
                success: true,
                message: 'Nhân viên không có chứng chỉ hành nghề nào được ghi nhận',
                cchnList: [],
                services: []
            });
        }

        // Bước 2: Dùng cchnList để query DoctorServiceMapping
        const services = await prisma.doctorServiceMapping.findMany({
            where: {
                cchn: { in: cchnList }
            },
            select: {
                cchn: true,
                ma_dich_vu: true,
                ten_dich_vu: true,
                isChiDinh: true,
                isThucHien: true,
                status: true
            },
            orderBy: {
                ma_dich_vu: 'asc'
            }
        });

        return NextResponse.json({
            success: true,
            userHIS,
            cchnList,
            totalServices: services.length,
            services
        });

    } catch (error) {
        console.error('Error fetching his services:', error);
        return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userHIS, services } = body;

        if (!userHIS || !Array.isArray(services)) {
            return NextResponse.json({ error: 'Dữ liệu không hợp lệ (yêu cầu userHIS và mảng services)' }, { status: 400 });
        }

        // Bước 1: Tìm User -> Staff -> PracticingCertificate
        const user = await prisma.user.findUnique({
            where: { userHIS },
            include: {
                staff: {
                    include: {
                        certificates: {
                            where: { isActive: true },
                            orderBy: { createdAt: 'desc' }
                        }
                    }
                }
            }
        });

        if (!user || !user.staff) {
            return NextResponse.json({ error: 'Không tìm thấy nhân viên ứng với userHIS này' }, { status: 404 });
        }

        const certificates = user.staff.certificates || [];
        if (certificates.length === 0) {
            return NextResponse.json({ error: 'Nhân viên không có chứng chỉ hành nghề nào đang hoạt động' }, { status: 400 });
        }

        // Lấy CCHN ưu tiên (mới nhất)
        const primaryCCHN = certificates[0].so_cchn;

        // Chuẩn bị dữ liệu để insert
        const dataToInsert = services.map((srv: any) => ({
            id: crypto.randomUUID(),
            cchn: primaryCCHN,
            ma_dich_vu: srv.ma_dich_vu,
            ten_dich_vu: srv.ten_dich_vu || '',
            isChiDinh: srv.isChiDinh || false,
            isThucHien: srv.isThucHien || false,
            source: 'API_HIS',
            status: 'APPROVED',
            updatedAt: new Date()
        }));

        // Bước 2: Insert với skipDuplicates = true (Bỏ qua mã đã có)
        const created = await prisma.doctorServiceMapping.createMany({
            data: dataToInsert,
            skipDuplicates: true
        });

        return NextResponse.json({
            success: true,
            userHIS,
            cchnApplied: primaryCCHN,
            servicesReceived: services.length,
            servicesAdded: created.count,
            message: `Đã cấp thêm ${created.count} mã dịch vụ mới (bỏ qua ${services.length - created.count} mã trùng).`
        });

    } catch (error) {
        console.error('Error creating his services:', error);
        return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
    }
}
