import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Certificate ID is required' }, { status: 400 });
        }

        const cert = await prisma.practicingCertificate.findUnique({
            where: { id },
            include: { scopes: true }
        });

        if (!cert) {
            return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
        }

        // Lấy danh sách mã phạm vi hành nghề
        const maPhamViList = cert.scopes.map(s => s.ma_pham_vi);
        let mappedServiceIds: string[] = [];

        if (maPhamViList.length > 0) {
            const mappings = await prisma.scopeServiceMapping.findMany({
                where: { ma_pham_vi: { in: maPhamViList } },
                select: { ma_dich_vu: true }
            });
            mappedServiceIds = mappings.map(m => m.ma_dich_vu);
        }

        // Lấy danh sách dịch vụ kỹ thuật khác
        let otherServiceIds: string[] = [];
        if (cert.dich_vu_ky_thuat) {
            otherServiceIds = cert.dich_vu_ky_thuat.split(',').map(s => s.trim()).filter(Boolean);
        }

        // Loại bỏ trùng lặp nếu có (mặc dù nên tách biệt)
        const uniqueMappedIds = Array.from(new Set(mappedServiceIds));
        const uniqueOtherIds = Array.from(new Set(otherServiceIds));

        // Fetch details from Mau05Catalog
        const mappedServices = uniqueMappedIds.length > 0 ? await prisma.mau05Catalog.findMany({
            where: { MA_DICH_VU: { in: uniqueMappedIds } },
            select: { id: true, MA_DICH_VU: true, TEN_DICH_VU: true, DON_GIA: true }
        }) : [];

        const otherServices = uniqueOtherIds.length > 0 ? await prisma.mau05Catalog.findMany({
            where: { MA_DICH_VU: { in: uniqueOtherIds } },
            select: { id: true, MA_DICH_VU: true, TEN_DICH_VU: true, DON_GIA: true }
        }) : [];

        // Nếu mã dịch vụ khác nhập tay không nằm trong Mau05, có thể trả về string gốc
        // Nhưng ở đây chỉ hiển thị những cái map được. Nếu muốn hiện cả text thì có thể thêm vào:
        const missingOtherIds = uniqueOtherIds.filter(id => !otherServices.some(s => s.MA_DICH_VU === id));
        const missingOtherServices = missingOtherIds.map(id => ({ id, MA_DICH_VU: id, TEN_DICH_VU: 'Dịch vụ nhập tay (chưa có trong Mẫu 05)', DON_GIA: null }));

        return NextResponse.json({
            mappedServices,
            otherServices: [...otherServices, ...missingOtherServices]
        });
    } catch (error) {
        console.error('Error fetching certificate services:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
