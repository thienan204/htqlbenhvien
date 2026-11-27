import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeApiRequest } from '@/lib/deleteProtection';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> } // Params is a Promise in Next 15+
) {
    try {
        const auth = await authorizeApiRequest(request, { requireAdmin: true });
        if (auth.errorResponse) return auth.errorResponse;

        const { id } = await params;
        const body = await request.json();
        const action = body.action; // 'approve'

        if (action === 'approve') {
            const draft = await prisma.draftRule.findUnique({
                where: { id },
            });

            if (!draft) {
                return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
            }

            // Move to ValidationRule
            // Exclude id, createdAt, updatedAt to let new record have its own
            const { id: _, createdAt, updatedAt, ...ruleData } = draft;

            const newRule = await prisma.validationRule.create({
                data: ruleData,
            });

            // Delete draft
            await prisma.draftRule.delete({
                where: { id },
            });

            return NextResponse.json(newRule);
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Error processing draft:', error);
        return NextResponse.json({ error: 'Failed to process draft' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await authorizeApiRequest(request, { requireAdmin: true });
        if (auth.errorResponse) return auth.errorResponse;

        const { id } = await params;
        await prisma.draftRule.delete({
            where: { id },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting draft:', error);
        return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
    }
}
