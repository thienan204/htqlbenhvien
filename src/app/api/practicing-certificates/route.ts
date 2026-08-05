import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUserFromRequest } from '@/actions/auth';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const staffId = searchParams.get('staffId');
        
        const user = await getCurrentUserFromRequest(request);
        const whereClause: any = {};
        
        if (user && user.role !== 'ADMIN') {
            if (user.role === 'KHOA_PHONG' && user.staffId) {
                whereClause.staffId = user.staffId;
            } else if (user.ma_khoa) {
                whereClause.staff = {
                    ma_khoa: user.ma_khoa
                };
            }
        }

        if (staffId) {
            whereClause.staffId = staffId;
        }

        const certs = await prisma.practicingCertificate.findMany({
            where: whereClause,
            include: { 
                staff: { include: { department: true } },
                TT32Category: true,
                noi_cap_cchn_ref: true,
                scopes: { include: { scope: true } }
            },
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
            pham_vi_hanh_nghe_ids, pham_vi_bo_sung, dich_vu_ky_thuat, isActive, tt32_category_id,
            noi_cap_cchn_id, vb_phan_cong, thoi_gian_dang_ky, thoi_gian_ngay, thoi_gian_tuan,
            cskcb_khac, cskcb_cgkt, qd_cgkt, tu_ngay, den_ngay
        } = body;

        if (!staffId || !so_cchn) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (isActive) {
            await prisma.practicingCertificate.updateMany({
                where: { staffId },
                data: { isActive: false }
            });
        }

        const scopesData = pham_vi_hanh_nghe_ids && Array.isArray(pham_vi_hanh_nghe_ids) 
            ? pham_vi_hanh_nghe_ids.map((ma: string) => ({ scope: { connect: { ma_pham_vi: ma } } })) 
            : [];

        const created = await prisma.practicingCertificate.create({
            data: {
                staffId, so_cchn, ngay_cap, chuc_danh_cchn, 
                pham_vi_bo_sung, dich_vu_ky_thuat, 
                isActive: isActive ?? true, tt32_category_id,
                noi_cap_cchn_id, vb_phan_cong, thoi_gian_dang_ky, thoi_gian_ngay, thoi_gian_tuan,
                cskcb_khac, cskcb_cgkt, qd_cgkt, tu_ngay, den_ngay,
                scopes: {
                    create: scopesData
                }
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
            pham_vi_hanh_nghe_ids, pham_vi_bo_sung, dich_vu_ky_thuat, isActive, tt32_category_id,
            noi_cap_cchn_id, vb_phan_cong, thoi_gian_dang_ky, thoi_gian_ngay, thoi_gian_tuan,
            cskcb_khac, cskcb_cgkt, qd_cgkt, tu_ngay, den_ngay
        } = body;

        if (!id || !staffId || !so_cchn) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (isActive) {
            await prisma.practicingCertificate.updateMany({
                where: { staffId, id: { not: id } },
                data: { isActive: false }
            });
        }

        // Xóa tất cả scopes cũ
        await prisma.cCHNScopeMapping.deleteMany({
            where: { cchn_id: id }
        });

        const scopesData = pham_vi_hanh_nghe_ids && Array.isArray(pham_vi_hanh_nghe_ids) 
            ? pham_vi_hanh_nghe_ids.map((ma: string) => ({ scope: { connect: { ma_pham_vi: ma } } })) 
            : [];

        const updated = await prisma.practicingCertificate.update({
            where: { id },
            data: {
                so_cchn, ngay_cap, chuc_danh_cchn, 
                pham_vi_bo_sung, dich_vu_ky_thuat, 
                isActive: isActive ?? true, tt32_category_id,
                noi_cap_cchn_id, vb_phan_cong, thoi_gian_dang_ky, thoi_gian_ngay, thoi_gian_tuan,
                cskcb_khac, cskcb_cgkt, qd_cgkt, tu_ngay, den_ngay,
                scopes: {
                    create: scopesData
                }
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
