import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await request.json();
        const {
            ma_khoa = 'KP046',
            date, // 'YYYY-MM-DD'
            code = 'x',
            overwrite = false // Nếu true thì ghi đè cả các ô đã có, false thì chỉ điền ô còn trống
        } = body;

        if (!date) {
            return NextResponse.json({ error: 'Thiếu ngày chấm công (date)' }, { status: 400 });
        }

        // Kiểm tra ngày nghỉ cuối tuần (Thứ 7 & Chủ Nhật)
        const dayOfWeek = new Date(date).getDay(); // 0: Chủ Nhật, 6: Thứ 7
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            // Kiểm tra xem có phải ngày làm bù được cấu hình toàn viện không
            let isMakeupWorkday = false;
            try {
                const hospitalConfigRule = await prisma.specializedRule.findUnique({
                    where: { slug: 'hospital-attendance-config' }
                });
                if (hospitalConfigRule && hospitalConfigRule.logicConfig) {
                    const makeupList: any[] = (hospitalConfigRule.logicConfig as any).makeupWorkdays || [];
                    if (makeupList.some((m: any) => m.date === date)) {
                        isMakeupWorkday = true;
                    }
                }
            } catch (errConfig) {
                console.error('Lỗi kiểm tra makeupWorkdays trong bulk-daily:', errConfig);
            }

            if (!isMakeupWorkday) {
                return NextResponse.json({ 
                    error: `Ngày ${date} là ngày nghỉ cuối tuần (${dayOfWeek === 0 ? 'Chủ Nhật' : 'Thứ 7'}), không có công đi làm hành chính! Nếu cán bộ có làm việc, vui lòng chấm bên tab Bảng Trực hoặc Chấm Thêm Giờ.` 
                }, { status: 400 });
            }
        }

        const staffList = await prisma.staff.findMany({
            where: { ma_khoa },
            include: {
                chuc_vu_ref: true,
                user: true
            }
        });

        if (staffList.length === 0) {
            return NextResponse.json({ error: 'Không tìm thấy nhân sự trong khoa phòng' }, { status: 404 });
        }

        const todayStr = new Date().toISOString().split('T')[0];
        let updatedCount = 0;

        for (const st of staffList) {
            const existing = await prisma.staffAttendanceRecord.findFirst({
                where: {
                    staffId: st.id,
                    workDate: date,
                    session: 'FULL_DAY'
                }
            });

            if (!existing || overwrite) {
                await prisma.staffAttendanceRecord.upsert({
                    where: {
                        staffId_workDate_session: {
                            staffId: st.id,
                            workDate: date,
                            session: 'FULL_DAY'
                        }
                    },
                    update: {
                        code,
                        value: 1.0,
                        updatedBy: user.id
                    },
                    create: {
                        staffId: st.id,
                        ma_khoa,
                        workDate: date,
                        code,
                        session: 'FULL_DAY',
                        value: 1.0,
                        updatedBy: user.id
                    }
                });
                updatedCount++;
            }

            // Tự động BẬT isAvailable cho Kỹ thuật viên nếu là ngày hôm nay và đi làm đủ
            if (date === todayStr && st.user && code === 'x') {
                const explicitLevel = (st.chuc_vu_ref as any)?.level;
                const cvCode = (st.chuc_vu_ref?.code || '').toUpperCase();
                const cvName = (st.chuc_vu_ref?.name || '').toUpperCase();
                const isLeader = explicitLevel === 'LEVEL_1_BGD' ||
                    explicitLevel === 'LEVEL_2_LEADER' ||
                    cvCode.includes('TRUONG_PHONG') ||
                    cvCode.includes('PHO_TRUONG_PHONG') ||
                    cvCode.includes('TRUONG_KHOA') ||
                    cvName.includes('TRƯỞNG PHÒNG') ||
                    cvName.includes('PHÓ TRƯỞNG PHÒNG');

                if (!isLeader) {
                    await prisma.user.update({
                        where: { id: st.user.id },
                        data: { isAvailable: true }
                    });
                }
            }

            // Tự động đồng bộ sang Lịch Lâm Sàng (StaffAttendance: Bật DVKT)
            try {
                await prisma.staffAttendance.upsert({
                    where: {
                        staffId_workDate: { staffId: st.id, workDate: date }
                    },
                    update: {
                        is_thuc_hien_dvkt: true
                    },
                    create: {
                        staffId: st.id,
                        workDate: date,
                        is_thuc_hien_dvkt: true
                    }
                });
            } catch (eClin) {
                // bỏ qua lỗi nếu có
            }
        }

        return NextResponse.json({
            success: true,
            message: `Đã chấm công nhanh cho ${updatedCount} cán bộ ngày ${date}!`,
            updatedCount
        });
    } catch (error: any) {
        console.error('Error bulk daily attendance:', error);
        return NextResponse.json({ error: error.message || 'Lỗi khi chấm công hàng loạt' }, { status: 500 });
    }
}
