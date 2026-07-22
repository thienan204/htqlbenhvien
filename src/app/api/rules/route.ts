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

        const rules = await prisma.validationRule.findMany({
            orderBy: {
                createdAt: 'asc'
            }
        });
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
