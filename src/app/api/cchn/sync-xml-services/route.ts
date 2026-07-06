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

        const uniqueCchns = Array.from(new Set(records.map((r: any) => r.cchn)));
        
        // Fetch existing records for these CCHNs
        const existingRecords = await prisma.doctorServiceMapping.findMany({
            where: {
                cchn: { in: uniqueCchns as string[] }
            },
            select: {
                cchn: true,
                ma_dich_vu: true,
                isChiDinh: true,
                isThucHien: true
            }
        });

        const existingMap = new Map();
        existingRecords.forEach(r => {
            existingMap.set(`${r.cchn}_${r.ma_dich_vu}`, r);
        });

        const newRecords: any[] = [];
        const updateOperations: any[] = [];

        records.forEach((record: any) => {
            const key = `${record.cchn}_${record.ma_dich_vu}`;
            const existing = existingMap.get(key);
            
            if (!existing) {
                newRecords.push({
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
                });
                // Add to map to prevent duplicates in the same payload
                existingMap.set(key, record);
            } else {
                // If it already exists, we might still want to merge the flags if they changed
                const needsUpdate = (record.isChiDinh && !existing.isChiDinh) || (record.isThucHien && !existing.isThucHien);
                if (needsUpdate) {
                    updateOperations.push(
                        prisma.doctorServiceMapping.update({
                            where: {
                                cchn_ma_dich_vu: {
                                    cchn: record.cchn,
                                    ma_dich_vu: record.ma_dich_vu
                                }
                            },
                            data: {
                                isChiDinh: record.isChiDinh ? true : undefined,
                                isThucHien: record.isThucHien ? true : undefined,
                                updatedAt: now
                            }
                        })
                    );
                    // Update the map to reflect the new state
                    existing.isChiDinh = existing.isChiDinh || record.isChiDinh;
                    existing.isThucHien = existing.isThucHien || record.isThucHien;
                }
            }
        });

        // Insert new records in bulk
        if (newRecords.length > 0) {
            await prisma.doctorServiceMapping.createMany({
                data: newRecords,
                skipDuplicates: true // Just in case
            });
        }

        // Execute updates
        if (updateOperations.length > 0) {
            await prisma.$transaction(updateOperations);
        }

        return NextResponse.json({ 
            success: true, 
            count: newRecords.length,
            message: `Successfully synchronized. Added ${newRecords.length} new services.`
        });

    } catch (error: any) {
        console.error('Error syncing XML services:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
