import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userHIS = searchParams.get('userHIS');
        const idHIS = searchParams.get('idHIS');

        if (!userHIS && !idHIS) {
            return NextResponse.json({ error: 'Thiếu tham số userHIS hoặc idHIS' }, { status: 400 });
        }

        // Bước 1: Tìm User -> Staff -> PracticingCertificate
        const user = await prisma.user.findFirst({
            where: idHIS ? { idHIS } : { userHIS: { equals: userHIS as string, mode: 'insensitive' } },
            include: {
                staff: {
                    include: {
                        trinh_do_ref: true,
                        chuc_danh_ref: true,
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
            trinhDo: user.staff.trinh_do_ref?.name || null,
            trinhDoCode: user.staff.trinh_do_ref?.code || null,
            chucDanh: user.staff.chuc_danh_ref?.name || null,
            chucDanhCode: user.staff.chuc_danh_ref?.code || null,
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
        const { userHIS, idHIS, services } = body;

        if ((!userHIS && !idHIS) || !Array.isArray(services)) {
            return NextResponse.json({ error: 'Dữ liệu không hợp lệ (yêu cầu userHIS/idHIS và mảng services)' }, { status: 400 });
        }

        // Bước 1: Tìm User -> Staff -> PracticingCertificate
        const user = await prisma.user.findFirst({
            where: idHIS ? { idHIS } : { userHIS: { equals: userHIS as string, mode: 'insensitive' } },
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
