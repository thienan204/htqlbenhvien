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
            if (!existingBedRule.excludeConditionField || !existingBedRule.excludeConditionValue) {
                try {
                    await prisma.validationRule.update({
                        where: { id: 'rule_bed_days_audit' },
                        data: {
                            excludeConditionField: 'MA_BENH_CHINH',
                            excludeConditionValue: 'Z38.0,Z38,Z38.1,Z38.2,Z38.3,Z38.4,Z38.5,Z38.6,Z38.7,Z38.8'
                        }
                    });
                    existingBedRule.excludeConditionField = 'MA_BENH_CHINH';
                    existingBedRule.excludeConditionValue = 'Z38.0,Z38,Z38.1,Z38.2,Z38.3,Z38.4,Z38.5,Z38.6,Z38.7,Z38.8';
                } catch (updateErr) {
                    console.warn('Could not update excludeCondition for rule_bed_days_audit:', updateErr);
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
                        name: 'Kiểm soát Tiền ngày giường (XML1 vs XML3)',
                        description: 'Đối chiếu số ngày giường chuẩn theo 4 nhóm ca (T <= 4h, cùng ngày > 4h, khác ngày ra viện thường, khác ngày tử vong/chuyển viện) với tổng số lượng giường XML3 (nhóm 14, 15) và mã KCB 03, 09.',
                        code: 'CHECK_BED_DAYS(MA_LOAI_KCB, NGAY_VAO_NOI_TRU, NGAY_RA, KET_QUA_DTRI, MA_LOAI_RV)',
                        conditionField: 'MA_NHOM',
                        conditionValue: '14,15',
                        excludeConditionField: 'MA_BENH_CHINH',
                        excludeConditionValue: 'Z38.0,Z38,Z38.1,Z38.2,Z38.3,Z38.4,Z38.5,Z38.6,Z38.7,Z38.8',
                        errorMessage: 'Lệch số lượng ngày giường chuẩn so với thực tế kê khai trong XML3',
                        checkNotNull: false
                    }
                });
                rules = [created, ...rules];
            } catch (seedErr) {
                console.warn('Could not auto-seed rule_bed_days_audit:', seedErr);
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
