import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET all mappings for a specific ma_pham_vi
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const ma_pham_vi = searchParams.get('ma_pham_vi');

        if (!ma_pham_vi) {
            return NextResponse.json({ error: 'ma_pham_vi is required' }, { status: 400 });
        }

        const mappings = await prisma.scopeServiceMapping.findMany({
            where: { ma_pham_vi },
            select: { ma_dich_vu: true }
        });

        return NextResponse.json(mappings.map(m => m.ma_dich_vu));
    } catch (error) {
        console.error('Error fetching mappings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST update mappings for a specific ma_pham_vi
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ma_pham_vi, ma_dich_vu_list } = body;

        if (!ma_pham_vi || !Array.isArray(ma_dich_vu_list)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // Transaction: Delete existing, then insert new
        await prisma.$transaction(async (tx) => {
            await tx.scopeServiceMapping.deleteMany({
                where: { ma_pham_vi }
            });

            if (ma_dich_vu_list.length > 0) {
                // Ensure distinct ma_dich_vu to avoid unique constraint violations
                const uniqueServices = Array.from(new Set(ma_dich_vu_list));
                
                await tx.scopeServiceMapping.createMany({
                    data: uniqueServices.map(ma_dich_vu => ({
                        id: crypto.randomUUID(),
                        ma_pham_vi,
                        ma_dich_vu: String(ma_dich_vu),
                        updatedAt: new Date()
                    })),
                    skipDuplicates: true
                });
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating mappings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE all mappings (either for multiple ma_pham_vi or globally)
export async function DELETE(request: Request) {
    try {
        let ma_pham_vi_list: string[] = [];
        try {
            const body = await request.json();
            if (body && Array.isArray(body.ma_pham_vi_list)) {
                ma_pham_vi_list = body.ma_pham_vi_list;
            }
        } catch (e) {
            // Ignore JSON parse errors if body is empty
        }

        // Also fallback to searchParams if provided (for backwards compatibility)
        const { searchParams } = new URL(request.url);
        const single_ma_pham_vi = searchParams.get('ma_pham_vi');
        if (single_ma_pham_vi && ma_pham_vi_list.length === 0) {
            ma_pham_vi_list = [single_ma_pham_vi];
        }

        if (ma_pham_vi_list.length > 0) {
            await prisma.scopeServiceMapping.deleteMany({
                where: { ma_pham_vi: { in: ma_pham_vi_list } }
            });
        } else {
            // Global reset
            await prisma.scopeServiceMapping.deleteMany({});
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting mappings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
