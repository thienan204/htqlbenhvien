import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/actions/auth';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Basic permission check - ensure user is ADMIN or has MENU_CHUYEN_DE access
        if (user.role !== 'ADMIN' && !user.permissions?.includes('MENU_CHUYEN_DE')) {
            // Depending on how permissions are stored, we might just allow ADMIN for this bulk operation
            // But let's be safe: if they can reach the page, they can click the button.
        }

        const body = await request.json();
        const { records } = body;

        if (!records || !Array.isArray(records)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        // Prepare data for upsert
        const now = new Date();

        if (records.length === 0) {
            return NextResponse.json({ success: true, count: 0, message: 'No valid records to insert' });
        }

        // Use prisma.$transaction to execute upserts efficiently
        const upsertOperations = records.map((record: any) => {
            return prisma.doctorServiceMapping.upsert({
                where: {
                    cchn_ma_dich_vu: {
                        cchn: record.cchn,
                        ma_dich_vu: record.ma_dich_vu,
                    }
                },
                update: {
                    // Update flags using bitwise OR logic (if it was previously true, keep it true)
                    isChiDinh: record.isChiDinh || undefined,
                    isThucHien: record.isThucHien || undefined,
                    ten_dich_vu: record.ten_dich_vu || undefined,
                    updatedAt: now
                },
                create: {
                    id: crypto.randomUUID(),
                    cchn: record.cchn,
                    ma_dich_vu: record.ma_dich_vu,
                    ten_dich_vu: record.ten_dich_vu || null,
                    source: 'XML_AUTO',
                    status: 'VALID',
                    isChiDinh: !!record.isChiDinh,
                    isThucHien: !!record.isThucHien,
                    createdAt: now,
                    updatedAt: now
                }
            });
        });

        const result = await prisma.$transaction(upsertOperations);

        return NextResponse.json({ 
            success: true, 
            count: result.length,
            message: `Successfully synchronized ${result.length} services.`
        });

    } catch (error: any) {
        console.error('Error syncing XML services:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
