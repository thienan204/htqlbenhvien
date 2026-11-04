import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

const CONFIG_SLUG = 'hospital-leave-policy-config';

/**
 * API: Cấu hình hạn chốt phép năm & Đối soát tiền phép do thiếu nhân lực
 * GET /api/staff/leave-management/config
 * POST /api/staff/leave-management/config
 */
export async function GET(request: Request) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const configRule = await prisma.specializedRule.findUnique({
            where: { slug: CONFIG_SLUG }
        });

        const defaultPolicy = {
            carryOverCutoffDate: '03-30', // Ngày 30 tháng 3 năm kế tiếp
            cutoffDescription: 'Ngày hết hạn sử dụng phép năm trước (Mặc định 30/03)',
            allowCashCompensationOnShortage: true,
            cashDailyRateFormula: 'SALARY_DIV_22' // Lương cơ bản / 22 ngày công chuẩn
        };

        const config = (configRule?.logicConfig as any) || defaultPolicy;

        // Lấy danh sách các đơn bị từ chối do thiếu nhân lực (đủ điều kiện đề xuất thanh toán tiền)
        const eligibleCashRequests = await prisma.staffLeaveRequest.findMany({
            where: {
                isEligibleForCashPayout: true,
                rejectReasonType: 'THIEU_NHAN_LUC'
            },
            include: {
                staff: {
                    select: {
                        id: true,
                        ma_nv: true,
                        ho_ten: true,
                        ma_khoa: true,
                        department: { select: { ten_khoa: true } },
                        chuc_vu_ref: { select: { name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({
            success: true,
            config,
            eligibleCashRequests
        });
    } catch (error: any) {
        console.error('Lỗi GET leave-management/config:', error);
        return NextResponse.json({ error: error.message || 'Lỗi đọc cấu hình' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await request.json();
        const { carryOverCutoffDate, allowCashCompensationOnShortage, cashDailyRateFormula } = body;

        const updatedConfig = {
            carryOverCutoffDate: carryOverCutoffDate || '03-30',
            allowCashCompensationOnShortage: allowCashCompensationOnShortage !== false,
            cashDailyRateFormula: cashDailyRateFormula || 'SALARY_DIV_22',
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.username || currentUser.id
        };

        await prisma.specializedRule.upsert({
            where: { slug: CONFIG_SLUG },
            create: {
                slug: CONFIG_SLUG,
                name: 'Cấu hình Chính sách Nghỉ phép & Quyết toán tiền phép Bệnh viện',
                description: 'Quy định hạn chốt phép cống hiến 30/03 và chi trả tiền không nghỉ phép do thiếu nhân lực',
                ruleType: 'SYSTEM_CONFIG',
                isActive: true,
                logicConfig: updatedConfig
            },
            update: {
                logicConfig: updatedConfig,
                updatedAt: new Date()
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Đã lưu cấu hình chính sách nghỉ phép thành công',
            config: updatedConfig
        });
    } catch (error: any) {
        console.error('Lỗi POST leave-management/config:', error);
        return NextResponse.json({ error: error.message || 'Lỗi lưu cấu hình' }, { status: 500 });
    }
}
