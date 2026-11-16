import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ValidationRule } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log('API Rules GET: Accessing prisma...');
        console.log('Prisma keys:', Object.keys(prisma));
        // keys might be hidden, try accessing directly or non-enumerable
        console.log('validationRule in prisma:', 'validationRule' in prisma);

        let rules = await prisma.validationRule.findMany({
            orderBy: {
                createdAt: 'asc'
            }
        });

        // Tự động bổ sung hoặc cập nhật rule_bed_days_audit vào DB nếu chưa có/chưa có loại trừ
        const existingBedRule = rules.find(r => r.id === 'rule_bed_days_audit');
        if (existingBedRule) {
            const needUpdate = !existingBedRule.excludeConditionField || !existingBedRule.excludeConditionValue || !existingBedRule.name?.includes('24/24h');
            if (needUpdate) {
                try {
                    await prisma.validationRule.update({
                        where: { id: 'rule_bed_days_audit' },
                        data: {
                            name: 'Kiểm soát Tiền ngày giường Nội trú (24/24h) (XML1 vs XML3)',
                            excludeConditionField: 'MA_BENH_CHINH',
                            excludeConditionValue: 'Z38.0,Z38,Z38.1,Z38.2,Z38.3,Z38.4,Z38.5,Z38.6,Z38.7,Z38.8'
                        }
                    });
                    existingBedRule.name = 'Kiểm soát Tiền ngày giường Nội trú (24/24h) (XML1 vs XML3)';
                    existingBedRule.excludeConditionField = 'MA_BENH_CHINH';
                    existingBedRule.excludeConditionValue = 'Z38.0,Z38,Z38.1,Z38.2,Z38.3,Z38.4,Z38.5,Z38.6,Z38.7,Z38.8';
                } catch (updateErr) {
                    console.warn('Could not update rule_bed_days_audit:', updateErr);
                }
            }
        } else if (rules.length > 0) {
            try {
                const created = await prisma.validationRule.create({
                    data: {
                        id: 'rule_bed_days_audit',
                        active: true,
                        type: 'Xuất toán',
                        xmlType: 'XML1',
                        field: 'SO_NGAY_DTRI',
                        name: 'Kiểm soát Tiền ngày giường Nội trú (24/24h) (XML1 vs XML3)',
                        description: 'Đối chiếu số ngày giường nội trú chuẩn (mã KCB 03, 09) theo 4 nhóm ca (T <= 4h, cùng ngày > 4h, khác ngày ra viện thường, khác ngày tử vong/chuyển viện) với tổng số lượng giường XML3 (nhóm 14, 15).',
                        code: 'CHECK_BED_DAYS(MA_LOAI_KCB, NGAY_VAO_NOI_TRU, NGAY_RA, KET_QUA_DTRI, MA_LOAI_RV)',
                        conditionField: 'MA_NHOM',
                        conditionValue: '14,15',
                        excludeConditionField: 'MA_BENH_CHINH',
                        excludeConditionValue: 'Z38.0,Z38,Z38.1,Z38.2,Z38.3,Z38.4,Z38.5,Z38.6,Z38.7,Z38.8',
                        errorMessage: 'Lệch số lượng ngày giường nội trú chuẩn so với thực tế kê khai trong XML3',
                        checkNotNull: false
                    }
                });
                rules = [created, ...rules];
            } catch (seedErr) {
                console.warn('Could not auto-seed rule_bed_days_audit:', seedErr);
            }
        }

        // Tự động bổ sung rule_bed_days_daycare_audit vào DB nếu chưa có
        const existingDaycareRule = rules.find(r => r.id === 'rule_bed_days_daycare_audit');
        if (!existingDaycareRule && rules.length > 0) {
            try {
                const created = await prisma.validationRule.create({
                    data: {
                        id: 'rule_bed_days_daycare_audit',
                        active: true,
                        type: 'Xuất toán',
                        xmlType: 'XML1',
                        field: 'SO_NGAY_DTRI',
                        name: 'Kiểm soát Tiền ngày giường Điều trị ban ngày (07h - 17h) (XML1 vs XML3)',
                        description: 'Đối chiếu số ngày giường điều trị ban ngày (mã KCB 04) trong khung giờ hành chính (07:00 - 17:00). Mốc tính 1 ngày giường là ≥ 4 giờ trong giờ hành chính.',
                        code: 'CHECK_BED_DAYS_DAYCARE(MA_LOAI_KCB, NGAY_VAO, NGAY_RA)',
                        conditionField: 'MA_NHOM',
                        conditionValue: '14,15',
                        errorMessage: 'Lệch số lượng ngày giường điều trị ban ngày chuẩn (khung giờ HC 07h-17h) so với thực tế kê khai trong XML3',
                        checkNotNull: false
                    }
                });
                rules = [created, ...rules];
            } catch (seedErr) {
                console.warn('Could not auto-seed rule_bed_days_daycare_audit:', seedErr);
            }
        }

        // Tự động bổ sung rule_bhyt_rate_audit vào DB nếu chưa có
        const existingBhytRateRule = rules.find(r => r.id === 'rule_bhyt_rate_audit');
        if (!existingBhytRateRule && rules.length > 0) {
            try {
                const created = await prisma.validationRule.create({
                    data: {
                        id: 'rule_bhyt_rate_audit',
                        active: true,
                        type: 'Xuất toán',
                        xmlType: 'XML1',
                        field: 'MA_THE_BHYT',
                        name: 'Kiểm soát Tỷ lệ thanh toán BHYT (XML1 vs XML2, XML3)',
                        description: 'Đối chiếu tỷ lệ thanh toán BHYT (TYLE_TT_BH) trên XML2 và XML3 theo ký tự thứ 3 của thẻ BHYT (1,2,5=100%, 3=95%, 4=80%), thời hạn thẻ và mốc miễn cùng chi trả (NGAY_MIEN_CCT).',
                        code: 'CHECK_TYLE_TT_BHYT(MA_THE_BHYT, GT_THE_TU, GT_THE_DEN, NGAY_MIEN_CCT)',
                        errorMessage: 'Sai lệch tỷ lệ thanh toán BHYT giữa thẻ và chi tiết dịch vụ/thuốc (XML2, XML3)',
                        checkNotNull: false
                    }
                });
                rules = [created, ...rules];
            } catch (seedErr) {
                console.warn('Could not auto-seed rule_bhyt_rate_audit:', seedErr);
            }
        }

        // Đảm bảo rule kiểm tra MA_MAY (1768445961548) luôn được cập nhật logic chuẩn
        const machineRule = rules.find(r => r.id === '1768445961548');
        if (machineRule && (!machineRule.code || !machineRule.code.includes('Mau05_REQUIRE_MACHINE') || !machineRule.active)) {
            try {
                await prisma.validationRule.update({
                    where: { id: '1768445961548' },
                    data: {
                        active: true,
                        code: "EXISTS_IN('Mau05_REQUIRE_MACHINE', MA_DICH_VU) && MA_MAY == null",
                        errorMessage: 'Dịch vụ kỹ thuật [TEN_DICH_VU] (Mã: [MA_DICH_VU]) bắt buộc phải có Mã máy thực hiện (MA_MAY) theo quy định BHXH nhưng trong XML3 đang để trống'
                    }
                });
                machineRule.active = true;
                machineRule.code = "EXISTS_IN('Mau05_REQUIRE_MACHINE', MA_DICH_VU) && MA_MAY == null";
                machineRule.errorMessage = 'Dịch vụ kỹ thuật [TEN_DICH_VU] (Mã: [MA_DICH_VU]) bắt buộc phải có Mã máy thực hiện (MA_MAY) theo quy định BHXH nhưng trong XML3 đang để trống';
            } catch (err) {
                console.warn('Could not auto-update rule 1768445961548:', err);
            }
        }

        return NextResponse.json(rules);
    } catch (error) {
        console.error('Error fetching rules:', error);

        // Debugging info
        const debugInfo = {
            prismaKeys: Object.keys(prisma),
            hasValidationRule: 'validationRule' in prisma,
            protoKeys: Object.keys(Object.getPrototypeOf(prisma) || {}),
            instanceId: (prisma as any)._instanceId
        };

        return NextResponse.json({
            error: 'Failed to fetch rules',
            details: error instanceof Error ? error.message : String(error),
            debug: debugInfo
        }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (!Array.isArray(body)) {
            return NextResponse.json({ error: 'Invalid data format. Expected array of rules.' }, { status: 400 });
        }

        // Transaction: Replace all rules with new set to ensure synchronization
        // Implementation detail: We treat the frontend state as the source of truth for the configuration
        // In a more complex system, we might want purely additive/update logic.
        const result = await prisma.$transaction(async (tx) => {
            // Option 1: Delete all and recreate (Risky if table grows large, but fine for config)
            await tx.validationRule.deleteMany({});

            // Prepare data, ensuring IDs are strings or undefined (let DB generate if not provided, but here we want to persist what FE sends)
            // But Prisma schema has `id String @id @default(cuid())`.
            // If FE sends ID, we use it. If collision, it will fail (unlikely if strictly sequential or guids).
            const rulesToCreate = body.map((rule: any) => ({
                id: rule.id || undefined,
                active: rule.active,
                type: rule.type,
                xmlType: rule.xmlType,
                field: rule.field,
                name: rule.name,
                description: rule.description,
                code: rule.code,
                mathExpression: rule.mathExpression,
                checkNotNull: rule.checkNotNull,
                conditionField: rule.conditionField,
                conditionValue: rule.conditionValue,
                conditionMaDichVu: rule.conditionMaDichVu,
                conditionMaDichVuValue: rule.conditionMaDichVuValue,
                excludeConditionField: rule.excludeConditionField,
                excludeConditionValue: rule.excludeConditionValue,
                errorMessage: rule.errorMessage,
                isGroupCount: rule.isGroupCount,
                minCountVal: rule.minCountVal,
                maxCountVal: rule.maxCountVal
            }));

            return await tx.validationRule.createMany({
                data: rulesToCreate
            });
        });

        return NextResponse.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Error saving rules:', error);
        return NextResponse.json({
            error: 'Failed to save rules',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
