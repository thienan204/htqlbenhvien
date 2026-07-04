import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const staffId = searchParams.get('staffId');

        if (!staffId) {
            // Lấy toàn bộ CCHN (Dùng cho màn hình Quản lý CCHN chung)
            const allCerts = await prisma.practicingCertificate.findMany({
                include: { 
                    staff: { include: { department: true } },
                    TT32Category: true 
                },
                orderBy: { createdAt: 'desc' }
            });
            return NextResponse.json(allCerts);
        }

        const certs = await prisma.practicingCertificate.findMany({
            where: { staffId },
            include: { TT32Category: true },
            orderBy: { createdAt: 'desc' }
        });
        
        return NextResponse.json(certs);
    } catch (error) {
        console.error('Error fetching certificates:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { 
            staffId, so_cchn, ngay_cap, chuc_danh_cchn, 
            pham_vi_hanh_nghe, pham_vi_bo_sung, dich_vu_ky_thuat, isActive, tt32_category_id
        } = body;

        if (!staffId || !so_cchn) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // If this one is active, deactivate others
        if (isActive) {
            await prisma.practicingCertificate.updateMany({
                where: { staffId },
                data: { isActive: false }
            });
        }

        const created = await prisma.practicingCertificate.create({
            data: {
                staffId, so_cchn, ngay_cap, chuc_danh_cchn, 
                pham_vi_hanh_nghe, pham_vi_bo_sung, dich_vu_ky_thuat, 
                isActive: isActive ?? true, tt32_category_id
            }
        });

        return NextResponse.json(created);
    } catch (error: any) {
        console.error('Error creating certificate:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { 
            id, staffId, so_cchn, ngay_cap, chuc_danh_cchn, 
            pham_vi_hanh_nghe, pham_vi_bo_sung, dich_vu_ky_thuat, isActive, tt32_category_id
        } = body;

        if (!id || !staffId || !so_cchn) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // If this one is active, deactivate others
        if (isActive) {
            await prisma.practicingCertificate.updateMany({
                where: { staffId, id: { not: id } },
                data: { isActive: false }
            });
        }

        const updated = await prisma.practicingCertificate.update({
            where: { id },
            data: {
                so_cchn, ngay_cap, chuc_danh_cchn, 
                pham_vi_hanh_nghe, pham_vi_bo_sung, dich_vu_ky_thuat, 
                isActive: isActive ?? true, tt32_category_id
            }
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Error updating certificate:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing certificate ID' }, { status: 400 });
        }

        await prisma.practicingCertificate.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting certificate:', error);
        return NextResponse.json({ error: 'Lỗi khi xóa: ' + (error?.message || 'Unknown error') }, { status: 500 });
    }
}
