import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFIG_KEY = 'clinical_scheduling_buffer_time';
const DEPT_HOURS_KEY = 'clinical_scheduling_dept_hours';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Lấy cấu hình Buffer Time
        const bufferTimeConfig = await prisma.systemConfig.findUnique({
            where: { key: CONFIG_KEY }
        });
        const bufferTime = bufferTimeConfig ? parseInt(bufferTimeConfig.value, 10) : 5; // Mặc định 5 phút

        // Lấy cấu hình Giờ làm việc theo Khoa
        const deptHoursConfigRecord = await prisma.systemConfig.findUnique({
            where: { key: DEPT_HOURS_KEY }
        });
        const deptHours = deptHoursConfigRecord ? JSON.parse(deptHoursConfigRecord.value) : {};

        // Lấy danh sách Khoa Lâm sàng / Cận lâm sàng
        const departments = await prisma.department.findMany({
            select: { ma_khoa: true, ten_khoa: true },
            orderBy: { ten_khoa: 'asc' }
        });

        // Map lại các key sang MA_KHOA và TEN_KHOA để UI dùng
        const mappedDepartments = departments.map(d => ({
            MA_KHOA: d.ma_khoa,
            TEN_KHOA: d.ten_khoa
        }));

        // Lấy danh sách dịch vụ Mau05 (Chỉ lấy các trường cần thiết)
        const services = await prisma.mau05Catalog.findMany({
            where: { isActive: true },
            select: {
                id: true,
                MA_DICH_VU: true,
                TEN_DICH_VU: true,
                thoigian_thuc_hien: true,
                yeu_cau_trinh_do: true,
                buffer_time: true,
                is_concurrent: true,
                yeu_cau_may_moc: true
            },
            orderBy: { MA_DICH_VU: 'asc' }
        });

        // Lấy danh mục Trình độ chuyên môn, Chức danh, Loại máy
        const qualifications = await prisma.systemCategory.findMany({
            where: { type: { in: ['TRINH_DO', 'CHUC_DANH', 'LOAI_MAY'] }, isActive: true },
            select: { name: true, type: true, code: true },
            orderBy: { name: 'asc' }
        });

        return NextResponse.json({
            success: true,
            bufferTime,
            deptHours,
            departments: mappedDepartments,
            services,
            qualifications
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { bufferTime, updatedServices, deptHours } = body;

        // Cập nhật Buffer Time
        if (bufferTime !== undefined) {
            await prisma.systemConfig.upsert({
                where: { key: CONFIG_KEY },
                update: { value: bufferTime.toString() },
                create: {
                    key: CONFIG_KEY,
                    value: bufferTime.toString(),
                    description: 'Khoảng cách nghỉ giữa 2 dịch vụ (Buffer Time) tính bằng phút'
                }
            });
        }

        // Cập nhật Cấu hình giờ làm việc theo Khoa
        if (deptHours) {
            await prisma.systemConfig.upsert({
                where: { key: DEPT_HOURS_KEY },
                update: { value: JSON.stringify(deptHours) },
                create: {
                    key: DEPT_HOURS_KEY,
                    value: JSON.stringify(deptHours),
                    description: 'Cấu hình giờ làm việc (Sáng/Chiều) theo từng khoa phòng'
                }
            });
        }

        // Cập nhật thời gian và trình độ cho Mau05
        if (updatedServices && Array.isArray(updatedServices) && updatedServices.length > 0) {
            // Sử dụng transaction để cập nhật hàng loạt an toàn
            await prisma.$transaction(
                updatedServices.map((service: any) => 
                    prisma.mau05Catalog.update({
                        where: { id: service.id },
                        data: {
                            ...(service.thoigian_thuc_hien !== undefined && { thoigian_thuc_hien: service.thoigian_thuc_hien }),
                            ...(service.yeu_cau_trinh_do !== undefined && { yeu_cau_trinh_do: service.yeu_cau_trinh_do }),
                            ...(service.buffer_time !== undefined && { buffer_time: service.buffer_time !== '' ? service.buffer_time : null }),
                            ...(service.is_concurrent !== undefined && { is_concurrent: service.is_concurrent }),
                            ...(service.yeu_cau_may_moc !== undefined && { yeu_cau_may_moc: service.yeu_cau_may_moc !== '' ? service.yeu_cau_may_moc : null })
                        }
                    })
                )
            );
        }

        return NextResponse.json({ success: true, message: 'Lưu cấu hình thành công' });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
