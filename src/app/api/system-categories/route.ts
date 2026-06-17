import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/actions/auth';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        
        const whereClause = type ? { type } : {};
        
        const categories = await prisma.systemCategory.findMany({
            where: whereClause,
            orderBy: [
                { type: 'asc' },
                { order: 'asc' },
                { name: 'asc' }
            ]
        });
        
        return NextResponse.json(categories);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const body = await request.json();
        
        if (Array.isArray(body)) {
            // Bulk insert
            const validData = body.filter(item => item.type && item.code && item.name).map(item => ({
                type: item.type,
                code: item.code,
                name: item.name,
                description: item.description || null,
                order: item.order || 0,
                isActive: item.isActive !== undefined ? item.isActive : true
            }));
            
            if (validData.length === 0) return NextResponse.json({ error: 'No valid data to import' }, { status: 400 });
            
            const result = await prisma.systemCategory.createMany({
                data: validData,
                skipDuplicates: true
            });
            
            return NextResponse.json({ success: true, count: result.count }, { status: 201 });
        } else {
            // Single insert
            const { type, code, name, description, order } = body;

            if (!type || !code || !name) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
            }

            const category = await prisma.systemCategory.create({
                data: { type, code, name, description, order: order || 0 }
            });

            return NextResponse.json(category, { status: 201 });
        }
    } catch (error: any) {
        if (error.code === 'P2002') return NextResponse.json({ error: 'Mã (Code) đã tồn tại trong loại danh mục này' }, { status: 400 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const body = await request.json();
        const { id, code, name, description, order, isActive } = body;

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const category = await prisma.systemCategory.update({
            where: { id },
            data: { code, name, description, order, isActive }
        });

        return NextResponse.json(category);
    } catch (error: any) {
        if (error.code === 'P2002') return NextResponse.json({ error: 'Mã (Code) đã tồn tại' }, { status: 400 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        // Lấy thông tin danh mục sắp xóa
        const categoryToDelete = await prisma.systemCategory.findUnique({ where: { id } });
        if (!categoryToDelete) return NextResponse.json({ error: 'Không tìm thấy danh mục' }, { status: 404 });

        // Nếu đang xóa một Nhóm danh mục (CATEGORY_GROUP)
        if (categoryToDelete.type === 'CATEGORY_GROUP') {
            const childCount = await prisma.systemCategory.count({
                where: { type: categoryToDelete.code }
            });
            
            if (childCount > 0) {
                return NextResponse.json({ error: `Không thể xóa nhóm này vì đang chứa ${childCount} danh mục con` }, { status: 400 });
            }
        }

        // Check foreign keys across models
        const staffCount = await prisma.staff.count({
            where: {
                OR: [
                    { trinh_do_id: id },
                    { chuc_danh_id: id },
                    { vi_tri_viec_lam_id: id },
                    { chuc_vu_id: id },
                    { loai_hop_dong_id: id },
                    { gioi_tinh_id: id }
                ]
            }
        });

        const equipmentCount = await prisma.equipment.count({
            where: {
                OR: [
                    { category_id: id },
                    { group_id: id },
                    { type_id: id },
                    { manufacturer_id: id },
                    { country_id: id },
                    { production_year_id: id },
                    { funding_source_id: id }
                ]
            }
        });

        const voucherDetailCount = await prisma.inventoryVoucherDetail.count({
            where: {
                OR: [
                    { category_id: id },
                    { group_id: id },
                    { type_id: id },
                    { manufacturer_id: id },
                    { country_id: id },
                    { funding_source_id: id }
                ]
            }
        });

        if (staffCount > 0 || equipmentCount > 0 || voucherDetailCount > 0) {
            let msgParts = [];
            if (staffCount > 0) msgParts.push(`${staffCount} Nhân sự`);
            if (equipmentCount > 0) msgParts.push(`${equipmentCount} Thiết bị/Vật tư`);
            if (voucherDetailCount > 0) msgParts.push(`${voucherDetailCount} Chi tiết phiếu kho`);
            return NextResponse.json({ 
                error: `Không thể xóa vì Danh mục này đang được dùng bởi ${msgParts.join(', ')}.` 
            }, { status: 400 });
        }

        await prisma.systemCategory.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Delete category error:", error);
        const errStr = String(error?.message || '');
        if (error?.code === 'P2003' || errStr.includes('foreign key constraint') || errStr.includes('23001')) {
            return NextResponse.json({ error: 'Không thể xóa vì Danh mục này đang được dùng bởi dữ liệu khác!' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Lỗi khi xóa: ' + (error?.message || 'Unknown error') }, { status: 500 });
    }
}
